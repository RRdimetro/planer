import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import type { Store } from "./index";
const digest = (data: string) =>
  createHash("sha256").update(data).digest("hex");
export function backupArchive(store: Store) {
  const data = store.dump(true);
  const history = JSON.stringify(
    store.db.prepare("SELECT * FROM change_log ORDER BY id").all(),
  );
  const zip = new AdmZip();
  zip.addFile(
    "manifest.json",
    Buffer.from(
      JSON.stringify({
        app: "FOCUS OS PRO",
        schema: 3,
        createdAt: new Date().toISOString(),
        sha256: digest(data),
        historySha256: digest(history),
      }),
    ),
  );
  zip.addFile("data.json", Buffer.from(data));
  zip.addFile("history.json", Buffer.from(history));
  zip.addFile("focus.sqlite", store.db.serialize());
  return zip;
}
export function restoreArchive(store: Store, zip: AdmZip) {
  if (zip.getEntries().some((e) => e.header.size > 64 * 1024 * 1024))
    throw Error("Слишком большой архив");
  const m = JSON.parse(zip.readAsText("manifest.json"));
  const data = zip.readAsText("data.json");
  const historyText = zip.readAsText("history.json");
  if (
    ![1, 2, 3].includes(m.schema) ||
    m.app !== "FOCUS OS PRO" ||
    digest(data) !== m.sha256 ||
    digest(historyText) !== m.historySha256
  )
    throw Error("Несовместимая или повреждённая копия");
  const history = JSON.parse(historyText);
  if (!Array.isArray(history) || history.length > 100000)
    throw Error("Повреждена история");
  store.db.transaction(() => {
    store.restore(data);
    store.db.exec("DELETE FROM change_log");
    for (const r of history) {
      if (typeof r.at !== "string" || typeof r.action !== "string")
        throw Error("Повреждена история");
      store.db
        .prepare(
          "INSERT INTO change_log(id,at,action,before_json,after_json) VALUES(?,?,?,?,?)",
        )
        .run(r.id, r.at, r.action, r.before_json, r.after_json);
    }
  })();
}
