import { test, expect } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { Store as LegacyStore } from "./fixtures/legacy-store";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
import { backupArchive, restoreArchive } from "../packages/database/backup";
test("v1 → v2 copy preflight preserves every legacy record, settings, study statuses, history and recoverable original", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-migration-"));
  const file = join(dir, "focus.db");
  const old = new LegacyStore(file);
  old.command({ type: "importStudy" });
  const p = newItem("project", "Existing project");
  const task = {
    ...newItem("task", "Existing task"),
    projectId: p.id,
    date: "2026-11-05",
    status: "week" as const,
  };
  for (const item of [
    p,
    task,
    {
      ...newItem("note", "Old note"),
      projectId: p.id,
      description: "# Existing text",
    },
    {
      ...newItem("workout", "Old run"),
      duration: 45,
      distance: 7.5,
      date: "2026-11-03",
    },
    newItem("event", "Old class"),
  ])
    old.command({ type: "save", item });
  old.command({ type: "snapshot", week: "2026-11-02" });
  old.command({ type: "save", item: { ...task, status: "done" } });
  old.command({ type: "focusStart", taskId: task.id, target: 1500 });
  old.command({ type: "focusAction", action: "finish" });
  old.command({ type: "settings", key: "pomodoro", value: 35 });
  const g = old.state().groups[0];
  old.command({
    type: "stage",
    groupId: g.id,
    row: 2,
    column: 3,
    status: "done",
  });
  const legacyDump = JSON.parse(old.dump());
  const history = old.db.prepare("SELECT count(*) n FROM change_log").get();
  old.close();
  let db = new Store(file);
  expect(db.state().diagnostics.version).toBe(4);
  expect(db.db.pragma("foreign_key_check")).toEqual([]);
  expect(db.state().subjects).toHaveLength(9);
  expect(db.state().groups.flatMap((g) => g.values.flat())).toHaveLength(54);
  expect(db.state().groups[0].values[2][3]).toBe("done");
  const records = (d: any) =>
    d.records
      .map((r: any) => [r.id, r.kind, JSON.parse(r.payload)])
      .sort((a: any, b: any) => a[0].localeCompare(b[0]));
  expect(records(JSON.parse(db.dump()))).toEqual(records(legacyDump));
  expect(db.db.prepare("SELECT count(*) n FROM change_log").get()).toEqual(
    history,
  );
  expect(db.migrationBackup).toBeTruthy();
  const backupPath = db.migrationBackup!;
  const sha = createHash("sha256")
    .update(readFileSync(backupPath))
    .digest("hex");
  const recovery = new Database(backupPath, { readonly: true });
  expect(recovery.pragma("integrity_check", { simple: true })).toBe("ok");
  expect(
    (
      recovery
        .prepare("SELECT max(version) v FROM schema_migrations")
        .get() as any
    ).v,
  ).toBe(1);
  expect(
    recovery.prepare("SELECT id,kind,payload FROM records").all(),
  ).toHaveLength(legacyDump.records.length);
  recovery.close();
  const zip = backupArchive(db);
  db.command({ type: "removeSubject", id: db.state().subjects[0].id });
  restoreArchive(db, zip);
  expect(db.state().subjects).toHaveLength(9);
  db.close();
  db = new Store(file);
  expect(db.migrationBackup).toBeNull();
  expect(
    createHash("sha256").update(readFileSync(backupPath)).digest("hex"),
  ).toBe(sha);
  expect(db.state().groups[0].values[2][3]).toBe("done");
  db.close();
  rmSync(dir, { recursive: true });
});
test("invalid v1 foreign reference blocks migration on copy and leaves original schema/data untouched", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-invalid-migration-"));
  const file = join(dir, "focus.db");
  const old = new LegacyStore(file);
  old.command({
    type: "save",
    item: {
      ...newItem("task", "Keep orphan exactly"),
      projectId: crypto.randomUUID(),
    },
  });
  const before = old.dump();
  old.close();
  expect(() => new Store(file)).toThrow();
  const check = new LegacyStore(file);
  expect(check.dump()).toBe(before);
  expect(
    (
      check.db
        .prepare("SELECT max(version) v FROM schema_migrations")
        .get() as any
    ).v,
  ).toBe(1);
  expect(
    check.db.prepare("SELECT name FROM sqlite_master WHERE name='tasks'").get(),
  ).toBeUndefined();
  check.close();
  rmSync(dir, { recursive: true });
});
