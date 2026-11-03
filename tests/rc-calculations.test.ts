import { test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Store } from "../packages/database";
import { newItem, dateOfTimestamp, onTime, isOverdue } from "../packages/core";
import { metrics, dailyEfficiency } from "../packages/analytics";
import { dashboardData } from "../packages/analytics/dashboard";
import { projectMetrics } from "../packages/analytics/projects";
import { dueReminders } from "../packages/core/reminders";
test("RC: Home and Insights agree on real work minutes, exclude breaks and include legacy completion fallback", () => {
  const db = new Store(":memory:");
  try {
    db.setting("timezone", "Europe/Moscow");
    const now = new Date("2026-11-03T12:00Z"),
      t = {
        ...newItem("task", "Legacy done"),
        status: "done" as const,
        date: "2026-11-03",
        completedAt: "2026-11-03T09:00:00.000Z",
      };
    db.put("task", t);
    for (const kind of ["work", "break"])
      db.put("session", {
        id: randomUUID(),
        taskId: t.id,
        startedAt: "2026-11-03T09:00:00.000Z",
        seconds: 600,
        target: 600,
        state: "done",
        kind,
      });
    const d = dashboardData(db.state(), now);
    expect(d.focusToday).toBe(10);
    expect(d.daily[6].completed).toBe(1);
    expect(d.current.focusMinutes).toBe(10);
    expect(
      metrics(db.state(), "2026-11-03", "2026-11-03", now).focusMinutes,
    ).toBe(10);
  } finally {
    db.close();
  }
});
test("RC: no observations, all-zero weights and zero-estimate projects never invent percentages", () => {
  const db = new Store(":memory:");
  try {
    expect(dailyEfficiency(db.state(), "2026-11-03").score).toBe(null);
    db.setting("weights", [0, 0, 0, 0, 0]);
    const p = newItem("project", "P");
    db.put("project", p);
    db.put("task", {
      ...newItem("task", "T"),
      projectId: p.id,
      estimate: 0,
      status: "done",
    });
    expect(projectMetrics(db.state(), p.id).percent).toBe(null);
    expect(metrics(db.state()).score).toBe(null);
  } finally {
    db.close();
  }
});
test("RC: timed deadlines compare actual instants; date-only deadlines use selected timezone", () => {
  expect(
    onTime("2026-11-03T11:00:00Z", "2026-11-03T10:00:00Z", "Europe/Moscow"),
  ).toBe(false);
  expect(onTime("2026-11-02T22:00:00Z", "2026-11-02", "Europe/Moscow")).toBe(
    false,
  );
  expect(
    isOverdue("2026-11-03T10:00Z", "UTC", new Date("2026-11-03T11:00Z")),
  ).toBe(true);
  expect(isOverdue("2026-11-03", "UTC", new Date("2026-11-03T23:59Z"))).toBe(
    false,
  );
  const t = { ...newItem("task", "Due"), due: "2026-11-03T21:05:00Z" };
  expect(
    dueReminders([t], "Europe/Moscow", 10, new Date("2026-11-03T20:58Z"))[0]
      .body,
  ).toContain("2026-11-04 00:05");
});
test("RC: cached calendar conversion stays correct across timezone and DST boundaries", () => {
  for (let i = 0; i < 3; i++) {
    expect(dateOfTimestamp("2026-11-02T22:30Z", "Europe/Moscow")).toBe(
      "2026-11-03",
    );
    expect(dateOfTimestamp("2026-11-02T22:30Z", "UTC")).toBe("2026-11-02");
    expect(dateOfTimestamp("2026-03-29T01:30Z", "Europe/Berlin")).toBe(
      "2026-03-29",
    );
  }
});
test("RC: supplied observation time governs future workout components consistently", () => {
  const db = new Store(":memory:");
  try {
    db.setting("timezone", "UTC");
    db.put("workout", {
      ...newItem("workout", "Later"),
      date: "2026-11-03",
      time: "18:00",
      estimate: 60,
      status: "week",
    });
    expect(
      dailyEfficiency(db.state(), "2026-11-03", new Date("2026-11-03T12:00Z"))
        .components[4],
    ).toBe(null);
  } finally {
    db.close();
  }
});
test("RC: forecasts require distinct past completions and never use future facts", () => {
  const db = new Store(":memory:");
  try {
    const p = newItem("project", "P"),
      t = { ...newItem("task", "T"), projectId: p.id };
    db.put("project", p);
    db.put("task", t);
    for (let i = 0; i < 3; i++)
      db.put("completion", {
        id: randomUUID(),
        task: { ...t, status: "done", completedAt: "2026-11-01T12:00:00Z" },
        at: "2026-11-01T12:00:00Z",
      });
    expect(
      projectMetrics(db.state(), p.id, new Date("2026-11-03T12:00Z")).forecast,
    ).toBe(null);
    for (let i = 0; i < 3; i++) {
      const future = {
        ...t,
        id: randomUUID(),
        status: "done" as const,
        completedAt: "2026-11-05T12:00:00Z",
      };
      db.put("task", future);
      db.put("completion", {
        id: randomUUID(),
        task: future,
        at: future.completedAt,
      });
    }
    expect(
      projectMetrics(db.state(), p.id, new Date("2026-11-03T12:00Z")).forecast,
    ).toBe(null);
  } finally {
    db.close();
  }
});
