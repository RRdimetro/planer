import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
test("M5: hostile restore fails atomically, settings reject invalid timezone/types", () => {
  const db = new Store(":memory:");
  db.command({ type: "save", item: newItem("task", "Keep") });
  const original = db.dump();
  const payload = JSON.parse(original);
  payload.records[0].payload = JSON.stringify({
    ...JSON.parse(payload.records[0].payload),
    title: "",
  });
  expect(() => db.restore(JSON.stringify(payload))).toThrow();
  expect(db.dump()).toBe(original);
  expect(() =>
    db.command({ type: "settings", key: "timezone", value: "Invalid/Zone" }),
  ).toThrow();
  expect(() =>
    db.command({ type: "settings", key: "weights", value: [-1] }),
  ).toThrow();
  expect(() =>
    db.command({ type: "settings", key: "dashboard", value: ["oops"] }),
  ).toThrow();
  expect(() =>
    db.command({
      type: "focusStart",
      taskId: crypto.randomUUID(),
      target: 1500,
    }),
  ).toThrow();
  db.close();
});
test("M4: editing completed deadline does not rewrite historical timeliness", async () => {
  const { metrics } = await import("../packages/analytics");
  const db = new Store(":memory:");
  const task = { ...newItem("task", "History"), due: "2099-01-01" };
  db.command({ type: "save", item: task });
  db.command({ type: "save", item: { ...task, status: "done" } });
  const saved = db.state().items.find((t) => t.id === task.id)!;
  db.command({ type: "save", item: { ...saved, due: "2000-01-01" } });
  expect(metrics(db.state()).components[1]).toBe(1);
  db.close();
});
