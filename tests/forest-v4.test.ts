import { test, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { designPreview } from "../packages/core/design-preview";
import { claimPreviewWorkspace } from "../packages/database/preview-workspace";
import { dashboardData } from "../packages/analytics/dashboard";
import { Store } from "../packages/database";
import { seedDesignPreview } from "../packages/database/demo";

test("preview routes are separate, opt-in and cannot select a concept in a user workspace", () => {
  expect(() => designPreview(false, "A", false)).toThrow();
  expect(() => designPreview(true, "D", false)).toThrow();
  const routes = ["A", "B", "C"].flatMap((c) => [
    designPreview(true, c, false).directory,
    designPreview(true, c, true).directory,
  ]);
  expect(new Set(routes).size).toBe(6);
  expect(routes).not.toContain(
    designPreview(false, undefined, false).directory,
  );
  expect(designPreview(false, undefined, true).empty).toBe(false);
});

test("preview claim refuses an existing unmarked user DB and mismatched concept before opening SQLite", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-v4-claim-"));
  try {
    const user = join(dir, "user");
    mkdirSync(user);
    writeFileSync(join(user, "focus.db"), "Existing user data");
    expect(() => claimPreviewWorkspace(user, "A", false)).toThrow();
    expect(readFileSync(join(user, "focus.db"), "utf8")).toBe(
      "Existing user data",
    );
    const demo = join(dir, "demo");
    claimPreviewWorkspace(demo, "A", false);
    expect(() => claimPreviewWorkspace(demo, "A", false)).not.toThrow();
    expect(() => claimPreviewWorkspace(demo, "B", false)).toThrow();
    expect(() => claimPreviewWorkspace(demo, "A", true)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty dashboard exposes no invented score, comparisons, activity or training", () => {
  const store = new Store(":memory:");
  try {
    const d = dashboardData(store.state(), new Date("2026-11-03T12:00:00Z"));
    expect(d.current.score).toBeNull();
    expect(d.previous.score).toBeNull();
    expect(d.daily.every((x) => x.focus === 0 && x.completed === 0)).toBe(true);
    expect(d.focusToday).toBe(0);
    expect(d.runningKm).toBe(0);
    expect(d.workoutMinutes).toBe(0);
    expect(d.projects).toHaveLength(0);
  } finally {
    store.close();
  }
});

test("dashboard uses real demo records, excludes planned training from actual and honors selected timezone", () => {
  const store = new Store(":memory:");
  try {
    seedDesignPreview(store, "demo", "2026-11-03");
    store.setting("timezone", "Europe/Moscow");
    const s = store.state();
    const d = dashboardData(s, new Date("2026-11-02T22:00:00Z"));
    expect(d.today).toBe("2026-11-03");
    expect(d.todayTasks).toHaveLength(3);
    expect(d.focusToday).toBe(25);
    expect(d.timeline).toHaveLength(7);
    expect(d.workouts).toHaveLength(1);
    expect(d.finishedWorkouts).toHaveLength(0);
    expect(d.workoutMinutes).toBe(0);
    expect(d.runningKm).toBe(0);
    expect(d.daily.reduce((n, x) => n + x.completed, 0)).toBe(4);
  } finally {
    store.close();
  }
});
