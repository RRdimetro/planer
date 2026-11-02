import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { backupArchive, restoreArchive } from "../packages/database/backup";
import { newItem } from "../packages/core";
test("M5: ZIP manifest, SQLite, history and complete restore; checksum tampering rejected", () => {
  const db = new Store(":memory:");
  db.command({ type: "importStudy" });
  db.command({ type: "save", item: newItem("task", "Persist") });
  const before = db.state();
  const count = db.db.prepare("SELECT count(*) n FROM change_log").get();
  const zip = backupArchive(db);
  expect(zip.getEntry("focus.sqlite")).toBeTruthy();
  db.command({ type: "remove", id: before.items[0].id });
  restoreArchive(db, zip);
  expect(db.state()).toEqual(before);
  expect(db.db.prepare("SELECT count(*) n FROM change_log").get()).toEqual(
    count,
  );
  zip.updateFile("data.json", Buffer.from("{}"));
  expect(() => restoreArchive(db, zip)).toThrow();
  expect(db.state()).toEqual(before);
  db.close();
});
