import { test, expect } from "vitest";
import {
  newItem,
  distribute,
  availableMinutes,
  conflicts,
} from "../packages/core";
import { emptyTaskDetails } from "../packages/contracts";
test("availability merges overlapping classes/commute and applies workdays/lecture policy", () => {
  const date = "2026-11-02";
  const cls = {
    ...newItem("event", "Class"),
    category: "university",
    date,
    time: "09:00",
    estimate: 120,
  };
  const road = {
    ...newItem("event", "Road"),
    category: "commute",
    date,
    time: "10:00",
    estimate: 120,
  };
  expect(availableMinutes(date, [cls, road], 9, 18, 540)).toBe(360);
  expect(
    availableMinutes(date, [cls, road], 9, 18, 540, { lectureWork: true }),
  ).toBe(420);
  expect(
    availableMinutes("2026-11-07", [], 9, 18, 540, {
      workDays: [1, 2, 3, 4, 5],
    }),
  ).toBe(0);
});
test("planner respects dependencies, no-complex periods, workouts and deadline", () => {
  const date = "2026-11-02";
  const a = { ...newItem("task", "First"), priority: 1, estimate: 60 };
  const b = { ...newItem("task", "Dependent"), priority: 4, estimate: 30 };
  const workout = {
    ...newItem("workout", "Workout"),
    date,
    time: "10:00",
    estimate: 60,
  };
  const options = {
    taskDetails: { [b.id]: { ...emptyTaskDetails(), dependencies: [a.id] } },
    allTasks: [a, b],
    afterWorkoutMinutes: 60,
    complexPriority: 3,
    workDays: [1, 2, 3, 4, 5],
  };
  const p = distribute([b, a], [workout], [date], 9, 18, 360, options);
  expect(p.result.map((i) => i.id)).toEqual([a.id, b.id]);
  expect(p.result[1].time).toBe("12:00");
  const overdue = { ...a, id: crypto.randomUUID(), due: "2026-11-01" };
  expect(distribute([overdue], [], [date], 9, 18, 360).rejected).toHaveLength(
    1,
  );
});
test("overlap is detected across midnight and projects never block slots", () => {
  const a = {
    ...newItem("event", "Night"),
    date: "2026-11-02",
    time: "23:45",
    estimate: 60,
  };
  const b = {
    ...newItem("task", "After midnight"),
    date: "2026-11-03",
    time: "00:15",
    estimate: 30,
  };
  expect(conflicts(b, [a])).toHaveLength(1);
  expect(conflicts(b, [{ ...a, kind: "project" }])).toHaveLength(0);
});
