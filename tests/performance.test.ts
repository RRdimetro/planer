import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
test("M5: batch 1000 tasks is atomic and state remains responsive", () => {
  const db = new Store(":memory:");
  const items = Array.from({ length: 1000 }, (_, i) =>
    newItem("task", "Task " + i),
  );
  const start = performance.now();
  db.command({ type: "saveMany", items });
  expect(db.state().items).toHaveLength(1000);
  const elapsed = performance.now() - start;
  console.log("1000 tasks batch/read ms:", Math.round(elapsed));
  expect(elapsed).toBeLessThan(5000);
  db.command({ type: "undo" });
  expect(db.state().items).toHaveLength(0);
  db.close();
});
