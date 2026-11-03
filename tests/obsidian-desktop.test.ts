import { test, expect } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
import { SessionClock } from "../packages/core/session-clock";
import { dueReminders } from "../packages/core/reminders";
import {
  automaticBackup,
  verifiedBackup,
} from "../packages/database/backup-service";
import { backupArchive, restoreArchive } from "../packages/database/backup";
import AdmZip from "adm-zip";
test("monotonic session clock counts long busy gaps and excludes OS suspend/resume", () => {
  const c = new SessionClock(1000);
  expect(c.elapsed(2000)).toBe(1);
  expect(c.elapsed(12000)).toBe(10);
  expect(c.suspend(12500)).toBe(0.5);
  expect(c.elapsed(3600000)).toBe(0);
  c.resume(3700000);
  expect(c.elapsed(3701000)).toBe(1);
  expect(c.elapsed(0)).toBe(0);
});
test("local reminders cross midnight, use selected zone, ignore completed tasks and deduplicate by occurrence", () => {
  const t = {
    ...newItem("task", "T"),
    date: "2026-11-04",
    time: "00:05",
    due: "2026-11-03",
  };
  const now = new Date("2026-11-03T20:58:00Z");
  const n = dueReminders([t], "Europe/Moscow", 10, now);
  expect(n).toHaveLength(1);
  expect(n[0].key).toContain("2026-11-04/00:05");
  expect(
    dueReminders([{ ...t, status: "done" }], "Europe/Moscow", 10, now),
  ).toEqual([]);
  expect(dueReminders([t], "UTC", 10, now)).toEqual([]);
});
test("verified automatic backups restore all data and rotate only their own files after success", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-backup-F-")),
    db = new Store(":memory:"),
    copy = new Store(":memory:");
  try {
    db.setting("onboarded", true);
    db.setting("backupRetention", 2);
    db.setting("backupEveryHours", 1);
    db.command({ type: "save", item: newItem("task", "Kept") });
    writeFileSync(join(dir, "manual.zip"), "keep");
    writeFileSync(join(dir, "before-restore.zip"), "keep");
    const first = automaticBackup(
      db,
      dir,
      "user",
      new Date("2026-11-01T12:00Z"),
    );
    expect(first).toBeTruthy();
    expect(
      automaticBackup(db, dir, "user", new Date("2026-11-01T12:05Z")),
    ).toBe(null);
    automaticBackup(db, dir, "user", new Date("2026-11-02T12:00Z"));
    const last = automaticBackup(
      db,
      dir,
      "user",
      new Date("2026-11-03T12:00Z"),
    )!;
    expect(
      readdirSync(dir).filter((n) => n.startsWith("FOCUS-auto")),
    ).toHaveLength(2);
    expect(readFileSync(join(dir, "manual.zip"), "utf8")).toBe("keep");
    restoreArchive(copy, new AdmZip(last));
    expect(copy.state().items[0].title).toBe("Kept");
    expect(copy.db.pragma("foreign_key_check")).toEqual([]);
    const target = join(dir, "existing.zip");
    writeFileSync(target, "original");
    expect(() => verifiedBackup(db, target, "demo")).not.toThrow();
    expect(readFileSync(target).subarray(0, 2).toString()).toBe("PK");
    db.setting("autoBackup", false);
    expect(
      automaticBackup(db, dir, "user", new Date("2026-11-05T12:00Z")),
    ).toBe(null);
  } finally {
    db.close();
    copy.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("compact audit scales per changed entity, undo retains versions and attachments, ZIP keeps all history", () => {
  const db = new Store(":memory:"),
    copy = new Store(":memory:");
  try {
    const tasks = Array.from({ length: 1000 }, (_, i) =>
      newItem("task", "Long item " + i),
    );
    db.command({ type: "saveMany", items: tasks });
    const t = tasks[0];
    db.attach(t.id, "proof.txt", "text/plain", Buffer.from("real bytes"));
    db.command({ type: "save", item: { ...t, title: "Edited" } });
    const row = db.db
      .prepare(
        "SELECT before_json,after_json FROM change_log ORDER BY id DESC LIMIT 1",
      )
      .get() as { before_json: string; after_json: string };
    expect(row.before_json.length + row.after_json.length).toBeLessThan(15000);
    expect(JSON.parse(row.after_json).format).toBe("delta-v1");
    const count = (
      db.db.prepare("SELECT count(*) n FROM entity_changes").get() as {
        n: number;
      }
    ).n;
    db.command({ type: "undo" });
    expect(db.state().items.find((i) => i.id === t.id)?.title).toBe(t.title);
    expect(
      (
        db.db.prepare("SELECT count(*) n FROM entity_changes").get() as {
          n: number;
        }
      ).n,
    ).toBeGreaterThan(count);
    expect(db.state().attachments).toHaveLength(1);
    restoreArchive(copy, backupArchive(db));
    expect(copy.dump(true)).toBe(db.dump(true));
    expect(copy.db.pragma("foreign_key_check")).toEqual([]);
  } finally {
    db.close();
    copy.close();
  }
});

test("failed backup verification keeps the previous archive and does not rotate copies", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-backup-fail-")),
    db = new Store(":memory:");
  try {
    db.setting("onboarded", true);
    db.setting("backupRetention", 1);
    const t = newItem("task", "T");
    db.command({ type: "save", item: t });
    db.attach(t.id, "proof.txt", "text/plain", Buffer.from("original bytes"));
    const original = automaticBackup(
      db,
      dir,
      "user",
      new Date("2026-11-01T12:00Z"),
    )!;
    const bytes = readFileSync(original);
    const target = join(dir, "manual.zip");
    writeFileSync(target, bytes);
    db.db.exec("UPDATE attachment_blobs SET content=x'00'");
    expect(() => verifiedBackup(db, target)).toThrow();
    expect(readFileSync(target)).toEqual(bytes);
    expect(() =>
      automaticBackup(db, dir, "user", new Date("2026-11-02T12:00Z")),
    ).toThrow();
    expect(readFileSync(original)).toEqual(bytes);
    expect(readdirSync(dir).filter((n) => n.endsWith(".tmp"))).toHaveLength(0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("undoing an unrelated edit retains live timer seconds and service metadata", () => {
  const db = new Store(":memory:");
  try {
    const t = newItem("task", "Original");
    db.command({ type: "save", item: t });
    db.command({ type: "focusStart", taskId: t.id, target: 0 });
    db.command({ type: "save", item: { ...t, title: "Edited" } });
    db.put("session", { ...db.state().sessions[0], seconds: 127 });
    db.setting("lastBackupAt", "2026-11-03T12:00:00.000Z");
    db.command({ type: "undo" });
    expect(db.state().items.find((i) => i.id === t.id)?.title).toBe("Original");
    expect(db.state().sessions[0].seconds).toBe(127);
    expect(db.state().sessions[0].state).toBe("running");
    expect(db.state().settings.lastBackupAt).toBe("2026-11-03T12:00:00.000Z");
  } finally {
    db.close();
  }
});
