import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem, distribute, conflicts, weekDays } from "../packages/core";
import { metrics, weightedScore } from "../packages/analytics";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("M1: persisted task identity, soft deletion, undo, immutable snapshot", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-"));
  const path = join(dir, "test.db");
  let db = new Store(path);
  const project = newItem("project", "Project");
  const task = {
    ...newItem("task", "Task"),
    status: "week" as const,
    projectId: project.id,
  };
  db.command({ type: "save", item: project });
  db.command({ type: "save", item: task });
  db.command({ type: "snapshot", week: "2026-11-02" });
  db.command({
    type: "save",
    item: { ...task, date: "2026-11-05", estimate: 300 },
  });
  expect(
    JSON.parse(db.state().items.find((t) => t.kind === "snapshot")!.data)[0]
      .estimate,
  ).toBe(30);
  db.close();
  db = new Store(path);
  expect(db.state().items.find((t) => t.id === task.id)?.date).toBe(
    "2026-11-05",
  );
  db.command({ type: "remove", id: task.id });
  expect(db.state().items.some((t) => t.id === task.id)).toBe(false);
  db.command({ type: "undo" });
  expect(db.state().items.some((t) => t.id === task.id)).toBe(true);
  expect(() => db.command({ type: "snapshot", week: "2026-11-02" })).toThrow();
  db.close();
  rmSync(dir, { recursive: true });
});
test("M1: overlap and Monday week", () => {
  expect(weekDays("2026-11-05")[0]).toBe("2026-11-02");
  const a = { ...newItem("task", "A"), date: "2026-11-02", time: "09:00" };
  expect(
    conflicts({ ...a, id: crypto.randomUUID(), time: "09:15" }, [a]),
  ).toHaveLength(1);
});
test("M4: empty analytics, renormalization, capacity and deterministic distribution", () => {
  const db = new Store(":memory:");
  expect(metrics(db.state()).score).toBeNull();
  expect(weightedScore([null, 0.8, null], [35, 25, 20])).toBe(80);
  const a = newItem("task", "A");
  const b = newItem("task", "B");
  const plan = distribute([a, b], [], ["2026-11-02"], 9, 10, 30);
  expect(plan.result).toHaveLength(1);
  expect(plan.rejected).toHaveLength(1);
  expect(plan.result[0].id).toBe(a.id);
  db.close();
});
