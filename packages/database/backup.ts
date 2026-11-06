import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import type { Store } from "./index";
import { CalendarRepository } from "../google-calendar/repository.ts";
import { projectCalendarEvents } from "../google-calendar/projection.ts";
const digest = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
export function backupArchive(
  store: Store,
  workspace: "user" | "demo" = "user",
) {
  const data = JSON.stringify({ ...JSON.parse(store.dump(true)), workspace });
  const history = JSON.stringify(
    store.db.prepare("SELECT * FROM change_log ORDER BY id").all(),
  );
  const sqlite = store.db.serialize();
  const googleCalendar = JSON.stringify(new CalendarRepository(store.db).exportCache());
  if (
    [Buffer.byteLength(data), Buffer.byteLength(history), sqlite.length, Buffer.byteLength(googleCalendar)].some(
      (n) => n > 512 * 1024 * 1024,
    ) ||
    Buffer.byteLength(data) + Buffer.byteLength(history) + sqlite.length + Buffer.byteLength(googleCalendar) >
      1024 * 1024 * 1024
  )
    throw Error(
      "Архив превышает поддерживаемый размер (512 МБ на компонент, 1 ГБ суммарно)",
    );
  const zip = new AdmZip();
  zip.addFile(
    "manifest.json",
    Buffer.from(
      JSON.stringify({
        app: "FOCUS OS PRO",
        schema: 6,
        googleCalendarSha256: digest(googleCalendar),
        workspace,
        createdAt: new Date().toISOString(),
        sha256: digest(data),
        historySha256: digest(history),
        sqliteSha256: digest(sqlite),
      }),
    ),
  );
  zip.addFile("data.json", Buffer.from(data));
  zip.addFile("history.json", Buffer.from(history));
  zip.addFile("focus.sqlite", sqlite);
  zip.addFile("google-calendar.json", Buffer.from(googleCalendar));
  return zip;
}
export function restoreArchive(
  store: Store,
  zip: AdmZip,
  workspace: "user" | "demo" = "user",
) {
  if (
    zip.getEntries().some((e) => e.header.size > 512 * 1024 * 1024) ||
    zip.getEntries().reduce((a, e) => a + e.header.size, 0) > 1024 * 1024 * 1024
  )
    throw Error("Слишком большой архив");
  const m = JSON.parse(zip.readAsText("manifest.json"));
  if ((m.workspace ?? "user") !== workspace)
    throw Error(
      "Копия относится к другому режиму. Демо и рабочие данные не смешиваются.",
    );
  const data = zip.readAsText("data.json");
  const historyText = zip.readAsText("history.json");
  if (
    ![1, 2, 3, 4, 5, 6].includes(m.schema) ||
    m.app !== "FOCUS OS PRO" ||
    digest(data) !== m.sha256 ||
    digest(historyText) !== m.historySha256
  )
    throw Error("Несовместимая или повреждённая копия");
  if (
    m.sqliteSha256 &&
    digest(zip.readFile("focus.sqlite") ?? Buffer.alloc(0)) !== m.sqliteSha256
  )
    throw Error("Повреждён SQLite-компонент архива");
  const history = JSON.parse(historyText);
  const calendarText = m.schema === 6 ? zip.readAsText("google-calendar.json") : null;
  if (calendarText !== null && (!m.googleCalendarSha256 || digest(calendarText) !== m.googleCalendarSha256))
    throw Error("Повреждён кэш Google Calendar");
  if (!Array.isArray(history) || history.length > 100000)
    throw Error("Повреждена история");
  store.db.transaction(() => {
    store.restore(data);
    if(calendarText !== null) {
      const repo=new CalendarRepository(store.db);
      repo.restoreCache(JSON.parse(calendarText));
      const cfg=repo.settings();
      if(cfg.calendar) projectCalendarEvents(repo.occurrences(cfg.calendar.id),cfg.calendar,cfg.calendar.timeZone,0,0);
    }
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
  store.resetUndo();
}

