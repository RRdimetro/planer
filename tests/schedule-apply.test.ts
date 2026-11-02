import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
test("schedule apply rejects stale previews and rolls back conflicts as one transaction", () => {
  const db = new Store(":memory:");
  const task = newItem("task", "Plan");
  db.command({ type: "save", item: task });
  const revision = db.state().revision;
  db.command({ type: "settings", key: "dailyCapacity", value: 300 });
  expect(() =>
    db.command({
      type: "applySchedule",
      items: [{ ...task, date: "2026-11-02", time: "09:00" }],
      expectedRevision: revision,
    }),
  ).toThrow();
  const rev = db.state().revision;
  const event = {
    ...newItem("event", "Class"),
    category: "university",
    date: "2026-11-02",
    time: "09:00",
    estimate: 60,
  };
  db.command({ type: "save", item: event });
  const before = db.dump();
  expect(() =>
    db.command({
      type: "applySchedule",
      items: [{ ...task, date: "2026-11-02", time: "09:00" }],
      expectedRevision: db.state().revision,
    }),
  ).toThrow();
  expect(db.dump()).toBe(before);
  expect(rev).toBeGreaterThan(revision);
  db.command({
    type: "applySchedule",
    items: [{ ...task, date: "2026-11-02", time: "10:00" }],
    expectedRevision: db.state().revision,
  });
  expect(db.state().items.find((t) => t.id === task.id)?.time).toBe("10:00");
  db.close();
});
