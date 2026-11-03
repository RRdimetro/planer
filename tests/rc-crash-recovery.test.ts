import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("RC: actual process death during a spilled uncommitted WAL transaction preserves the last committed rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-rc-wal-")),
    file = join(dir, "focus.db");
  let db = new Store(file);
  try {
    const items = Array.from({ length: 100 }, (_, i) => ({
      ...newItem("task", "Committed " + i),
      description: "original ".repeat(300),
    }));
    db.command({ type: "saveMany", items });
    db.command({ type: "importStudy" });
    const before = db.state();
    db.close();
    const worker = join(process.cwd(), "release/rc-crash-worker.cjs");
    writeFileSync(
      worker,
      `const Database=require('better-sqlite3');const db=new Database(process.argv[2]);db.pragma('journal_mode=WAL');db.pragma('cache_size=2');db.exec('BEGIN IMMEDIATE');const rows=db.prepare('SELECT id FROM tasks').all();const update=db.prepare('UPDATE entities SET title=?,description=? WHERE id=?');for(const r of rows)update.run('Uncommitted','changed '.repeat(900),r.id);process.kill(process.pid,'SIGKILL');`,
    );
    const result = spawnSync(process.execPath, [worker, file], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    });
    expect(result.status !== 0 || result.signal !== null).toBe(true);
    expect(existsSync(file + "-wal")).toBe(true);
    expect(statSync(file + "-wal").size).toBeGreaterThan(0);
    db = new Store(file);
    expect(db.state().items).toEqual(before.items);
    expect(db.state().subjects).toEqual(before.subjects);
    expect(db.state().groups).toEqual(before.groups);
    expect(db.db.pragma("foreign_key_check")).toEqual([]);
    expect(db.state().diagnostics.integrity).toBe("ok");
  } finally {
    try {
      db.close();
    } catch {
      /* already closed after worker setup failure */
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
