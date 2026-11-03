import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";
import { Store } from ".";
import { backupArchive, restoreArchive } from "./backup";
/** Verification completes before a previous destination can be replaced. */
export function verifiedBackup(
  store: Store,
  file: string,
  workspace: "user" | "demo" = "user",
) {
  if (
    store.db.pragma("integrity_check", { simple: true }) !== "ok" ||
    (store.db.pragma("foreign_key_check") as unknown[]).length
  )
    throw Error("Нарушена целостность исходной БД");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const pending = file + `.${randomUUID()}.tmp`;
  try {
    backupArchive(store, workspace).writeZip(pending);
    const copy = new Store(":memory:");
    try {
      restoreArchive(copy, new AdmZip(pending), workspace);
      if (
        copy.db.pragma("integrity_check", { simple: true }) !== "ok" ||
        (copy.db.pragma("foreign_key_check") as unknown[]).length
      )
        throw Error("Копия не прошла проверку восстановления");
    } finally {
      copy.close();
    }
    fs.renameSync(pending, file);
  } finally {
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
  }
  return file;
}
export function automaticBackup(
  store: Store,
  directory: string,
  workspace: "user" | "demo" = "user",
  now = new Date(),
) {
  const settings = Object.fromEntries(
    (
      store.db.prepare("SELECT key,payload FROM settings").all() as {
        key: string;
        payload: string;
      }[]
    ).map((s) => [s.key, JSON.parse(s.payload)]),
  );
  if (settings.autoBackup === false || !settings.onboarded) return null;
  const last = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : 0;
  if (
    now.getTime() - last < Number(settings.backupEveryHours ?? 24) * 3600000 &&
    settings.lastBackupPath &&
    fs.existsSync(settings.lastBackupPath)
  )
    return null;
  const file = path.join(
    directory,
    `FOCUS-auto-${now.toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.zip`,
  );
  verifiedBackup(store, file, workspace);
  store.setting("lastBackupAt", now.toISOString());
  store.setting("lastBackupPath", file);
  const copies = fs
    .readdirSync(directory)
    .filter((n) => /^FOCUS-auto-[\dT\-Z]+-[a-f\d]{8}\.zip$/.test(n))
    .sort()
    .reverse();
  for (const name of copies.slice(Number(settings.backupRetention ?? 7)))
    fs.unlinkSync(path.join(directory, name));
  return file;
}
