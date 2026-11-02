import Database from "better-sqlite3";
import { writeFileSync } from "node:fs";
import { sql } from "./0002_normalized";
import { NormalizedRepository } from "../normalized";
function canonical(x: any): string {
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  if (x && typeof x === "object")
    return (
      "{" +
      Object.keys(x)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(x[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(x);
}
export function applyV2(db: Database.Database) {
  db.transaction(() => {
    db.pragma("defer_foreign_keys=ON");
    db.exec(sql);
    const legacy = db
      .prepare("SELECT id,kind,payload FROM records ORDER BY rowid")
      .all() as { id: string; kind: string; payload: string }[];
    const repository = new NormalizedRepository(db);
    repository.load(legacy);
    const actual = new Map(
      repository.records().map((r) => [r.id, canonical(JSON.parse(r.payload))]),
    );
    for (const r of legacy)
      if (actual.get(r.id) !== canonical(JSON.parse(r.payload)))
        throw Error(
          `Миграция изменила запись ${r.kind} ${r.id}; оригинал сохранён`,
        );
    if ((db.pragma("foreign_key_check") as unknown[]).length)
      throw Error("Нарушены связи после миграции");
    db.prepare("INSERT INTO schema_migrations VALUES(2,?)").run(
      new Date().toISOString(),
    );
  })();
}
export function migrate(db: Database.Database, path: string) {
  const current = (
    db.prepare("SELECT max(version) v FROM schema_migrations").get() as {
      v: number;
    }
  ).v;
  if (current > 2) throw Error("База создана более новой версией приложения");
  if (current === 2) return null;
  let backupPath: string | null = null;
  if (path !== ":memory:") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path + `.pre-v2-${stamp}.sqlite`;
    const checkPath = path + `.migration-check-${stamp}.sqlite`;
    const bytes = db.serialize();
    writeFileSync(backupPath, bytes, { flag: "wx" });
    writeFileSync(checkPath, bytes, { flag: "wx" });
    const copy = new Database(checkPath);
    copy.pragma("foreign_keys=ON");
    try {
      applyV2(copy);
      if (copy.pragma("integrity_check", { simple: true }) !== "ok")
        throw Error("Копия не прошла integrity_check");
    } finally {
      copy.close();
    }
    // Verify that the original pre-migration copy remains recoverable as schema v1.
    const recovery = new Database(backupPath, { readonly: true });
    try {
      if (recovery.pragma("integrity_check", { simple: true }) !== "ok")
        throw Error("Резервная копия не прошла проверку");
      if (
        (
          recovery
            .prepare("SELECT max(version) v FROM schema_migrations")
            .get() as { v: number }
        ).v !== 1
      )
        throw Error("Неверная версия копии");
    } finally {
      recovery.close();
    }
  }
  applyV2(db);
  return backupPath;
}
