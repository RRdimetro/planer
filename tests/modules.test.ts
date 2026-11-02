import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
test("M3: workouts, focus lifecycle, notes and backup round trip", () => {
  const db = new Store(":memory:");
  const task = newItem("task", "Reading");
  const note = {
    ...newItem("note", "Notes"),
    description: "# Notes\n<script>alert(1)</script>",
  };
  const run = {
    ...newItem("workout", "Run"),
    date: "2026-11-02",
    duration: 30,
    distance: 5,
    status: "done" as const,
  };
  for (const item of [task, note, run]) db.command({ type: "save", item });
  db.command({ type: "focusStart", taskId: task.id, target: 1500 });
  db.command({ type: "focusAction", action: "pause" });
  expect(db.state().sessions[0].state).toBe("paused");
  db.command({ type: "focusAction", action: "resume" });
  db.command({ type: "focusAction", action: "finish" });
  expect(db.state().sessions[0].state).toBe("done");
  const backup = db.dump();
  db.command({ type: "remove", id: note.id });
  db.restore(backup);
  expect(db.state().items.find((i) => i.id === note.id)?.description).toBe(
    note.description,
  );
  expect(() =>
    db.command({ type: "save", item: { ...run, distance: -1 } }),
  ).toThrow();
  expect(db.state().items.filter((i) => i.kind === "workout")).toHaveLength(1);
  expect(() => db.restore('{"records":[{}],"settings":[]}')).toThrow();
  expect(db.state().items).toHaveLength(3);
  db.close();
});
