import { randomUUID } from "node:crypto";
import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
import { metrics } from "../packages/analytics";
import { insights, insightState } from "../packages/analytics/insights";
test("timezone governs completed dates, timeliness and sessions across midnight; break excluded", () => {
  const db = new Store(":memory:");
  try {
    db.setting("timezone", "Europe/Moscow");
    const task = {
      ...newItem("task", "Midnight"),
      date: "2026-11-03",
      due: "2026-11-02",
      status: "done" as const,
      completedAt: "2026-11-02T22:30:00.000Z",
    };
    db.put("task", task);
    db.put("session", {
      id: randomUUID(),
      taskId: task.id,
      startedAt: "2026-11-02T22:00:00.000Z",
      state: "done",
      seconds: 600,
      target: 600,
      kind: "work",
    });
    const m = metrics(db.state(), "2026-11-03", "2026-11-03");
    expect(m.done).toHaveLength(1);
    expect(m.focusMinutes).toBe(10);
    expect(m.components[1]).toBe(0);
    expect(metrics(db.state(), "2026-11-02", "2026-11-02").done).toHaveLength(
      0,
    );
  } finally {
    db.close();
  }
});
test("project/category filters include historical completions and filter frozen snapshots and focus", () => {
  const db = new Store(":memory:");
  try {
    const project = newItem("project", "P"),
      a = {
        ...newItem("task", "A"),
        projectId: project.id,
        category: "Учёба",
        date: "2026-11-03",
      },
      b = { ...newItem("task", "B"), date: "2026-11-03" };
    db.command({ type: "saveMany", items: [project, a, b] });
    db.command({ type: "snapshot", week: "2026-11-02" });
    db.command({ type: "save", item: { ...a, status: "done" } });
    const f = insightState(db.state(), project.id, "Учёба");
    expect(f.items.filter((i) => i.kind === "task")).toHaveLength(1);
    expect(f.completions).toHaveLength(1);
    expect(
      JSON.parse(f.items.find((i) => i.kind === "snapshot")!.data),
    ).toHaveLength(1);
    const m = insights(
      f,
      "2026-11-01",
      "2026-11-30",
      new Date("2026-11-03T12:00Z"),
    );
    expect(m.days).toHaveLength(30);
    expect(m.weekdays).toHaveLength(7);
    expect(m.months).toHaveLength(1);
    expect(() => insights(f, "2020-01-01", "2026-11-03")).toThrow();
  } finally {
    db.close();
  }
});
test("movement counts use actual task date changes in selected zone, survive cached reads and restore", () => {
  const db = new Store(":memory:");
  try {
    const a = { ...newItem("task", "A"), category: "Work", date: "2026-11-01" };
    db.command({ type: "save", item: a });
    db.command({ type: "save", item: { ...a, date: "2026-11-02" } });
    db.db
      .prepare(
        "UPDATE entity_changes SET at='2026-11-02T22:30:00.000Z' WHERE before_json IS NOT NULL",
      )
      .run();
    db.setting("timezone", "Europe/Moscow");
    expect(db.state().movementDays).toEqual([
      { day: "2026-11-03", count: 1, projectId: null, category: "Work" },
    ]);
    const text = db.dump(true);
    db.command({ type: "save", item: { ...a, date: "2026-11-04" } });
    db.restore(text);
    expect(db.state().movementDays?.reduce((a, d) => a + d.count, 0)).toBe(1);
  } finally {
    db.close();
  }
});
