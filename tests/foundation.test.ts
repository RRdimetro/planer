import { test, expect } from "vitest";
import { Store } from "../packages/database";
test("M0: migration, integrity and empty persistent store", () => {
  const db = new Store(":memory:");
  expect(db.state().diagnostics).toEqual({ version: 2, integrity: "ok" });
  expect(db.state().items).toEqual([]);
  db.close();
});
