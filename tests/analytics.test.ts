import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem, distribute } from "../packages/core";
import { metrics, weightedScore } from "../packages/analytics";
test("M4: control dataset, original plan weights and rest days excluded", () => {
  const db = new Store(":memory:");
  const a = {
    ...newItem("task", "A"),
    status: "week" as const,
    weight: 3,
    due: "2099-01-01",
  };
  const b = { ...newItem("task", "B"), status: "week" as const, weight: 1 };
  db.command({ type: "save", item: a });
  db.command({ type: "save", item: b });
  db.command({ type: "snapshot", week: "2026-11-02" });
  db.command({ type: "save", item: { ...a, status: "done" } });
  db.command({ type: "save", item: { ...b, date: "2026-11-16", weight: 100 } });
  const m = metrics(db.state());
  expect(m.components[0]).toBe(0.75);
  expect(m.components[1]).toBe(1);
  expect(m.components[4]).toBeNull();
  expect(m.score).toBe(Math.round((100 * (0.75 * 35 + 25)) / 60));
  expect(weightedScore([1, null], [0, 100])).toBeNull();
  db.close();
});
test("M4: smart planner respects busy intervals, deadline priority and impossible capacity", () => {
  const busy = {
    ...newItem("event", "Class"),
    date: "2026-11-02",
    time: "09:00",
    estimate: 60,
  };
  const low = { ...newItem("task", "Low"), priority: 1 };
  const high = { ...newItem("task", "High"), priority: 4 };
  const preview = distribute([low, high], [busy], ["2026-11-02"], 9, 11, 120);
  expect(preview.result[0].id).toBe(high.id);
  expect(preview.result[0].time).toBe("10:00");
  expect(preview.result[1].time).toBe("10:30");
  expect(distribute([high], [], ["2026-11-02"], 18, 9, 360).result).toEqual([]);
});
