import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
test("normalized SQL constraints reject orphan tasks, invalid counts and cross-group stages", () => {
  const db = new Store(":memory:");
  db.command({ type: "importStudy" });
  expect(() =>
    db.command({
      type: "save",
      item: { ...newItem("task", "Orphan"), projectId: crypto.randomUUID() },
    }),
  ).toThrow();
  expect(db.state().items).toHaveLength(0);
  expect(() =>
    db.db.prepare("UPDATE study_aggregate_counts SET completed=total+1").run(),
  ).toThrow();
  expect(() =>
    db.db.prepare("UPDATE study_stage_status SET status='false'").run(),
  ).toThrow();
  const groups = db.state().groups;
  expect(() =>
    db.db
      .prepare("INSERT INTO study_stage_status VALUES(?,?,?,?,?)")
      .run(
        groups[0].id,
        groups[0].id + ":work:0",
        groups[1].id + ":stage:0",
        "done",
        new Date().toISOString(),
      ),
  ).toThrow();
  expect(db.db.pragma("foreign_key_check")).toEqual([]);
  expect(db.db.prepare("SELECT count(*) n FROM records").get()).toEqual({
    n: 0,
  });
  db.close();
});
