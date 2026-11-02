import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { sql } from "./0002_normalized";
import { sql as planningSQL } from "./0003_planning";
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
export function applyV3(db: Database.Database) {
  db.transaction(() => {
    db.exec(planningSQL);
    for (const a of db.prepare("SELECT id,content FROM attachments").all() as {
      id: string;
      content: Buffer;
    }[]) {
      const hash = createHash("sha256").update(a.content).digest("hex");
      db.prepare("INSERT OR IGNORE INTO attachment_blobs VALUES(?,?)").run(
        hash,
        a.content,
      );
      db.prepare("INSERT INTO attachment_digests VALUES(?,?)").run(a.id, hash);
    }
    for (const log of db
      .prepare("SELECT * FROM change_log ORDER BY id")
      .all() as {
      at: string;
      action: string;
      before_json: string | null;
      after_json: string | null;
    }[]) {
      if (!log.before_json || !log.after_json) continue;
      const prev = new Map(
        (JSON.parse(log.before_json).records ?? []).map(
          (r: { id: string; payload: string }) => [r.id, r.payload],
        ),
      );
      for (const r of JSON.parse(log.after_json).records ?? []) {
        if (
          !["task", "project", "event", "note", "workout"].includes(r.kind) ||
          prev.get(r.id) === r.payload ||
          !db.prepare("SELECT id FROM entities WHERE id=?").get(r.id)
        )
          continue;
        db.prepare("INSERT INTO entity_changes VALUES(?,?,?,?,?,?)").run(
          randomUUID(),
          r.id,
          log.at,
          log.action,
          prev.get(r.id) ?? null,
          r.payload,
        );
      }
    }
    db.prepare("INSERT INTO schema_migrations VALUES(3,?)").run(
      new Date().toISOString(),
    );
  })();
}
export function upgrade(db: Database.Database) {
  const current = (
    db.prepare("SELECT max(version) v FROM schema_migrations").get() as {
      v: number;
    }
  ).v;
  if (current === 1) applyV2(db);
  if (current < 3) applyV3(db);
}
export function migrate(db: Database.Database, path: string) {
  const current = (
    db.prepare("SELECT max(version) v FROM schema_migrations").get() as {
      v: number;
    }
  ).v;
  if (current > 3) throw Error("База создана более новой версией приложения");
  if (current === 3) return null;
  let backupPath: string | null = null;
  if (path !== ":memory:") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path + `.pre-v${current + 1}-${stamp}.sqlite`;
    const checkPath = path + `.migration-check-${stamp}.sqlite`;
    const bytes = db.serialize();
    writeFileSync(backupPath, bytes, { flag: "wx" });
    writeFileSync(checkPath, bytes, { flag: "wx" });
    const copy = new Database(checkPath);
    copy.pragma("foreign_keys=ON");
    try {
      upgrade(copy);
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
        ).v !== current
      )
        throw Error("Неверная версия копии");
    } finally {
      recovery.close();
    }
  }
  upgrade(db);
  return backupPath;
}
