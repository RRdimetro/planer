import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
import { fitnessMetrics } from "../packages/analytics/fitness";
import { backupArchive, restoreArchive } from "../packages/database/backup";
test("programs/sets, actual volume, running distance and PR are calculated only from confirmed completed records", () => {
  const db = new Store(":memory:");
  const exercise = {
    id: crypto.randomUUID(),
    name: "Присед",
    muscleGroup: "Ноги",
  };
  db.command({ type: "exercise", value: exercise });
  const program = {
    id: crypto.randomUUID(),
    name: "Программа A",
    description: "",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: exercise.id,
        sets: 3,
        reps: 8,
        weight: 60,
      },
    ],
  };
  db.command({ type: "program", value: program });
  const workout = {
    ...newItem("workout", "Силовая"),
    date: "2026-11-02",
    category: "strength",
    duration: 45,
    status: "week" as const,
  };
  const sets = [
    {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      reps: 8,
      weight: 60,
      done: false,
    },
    {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      reps: 8,
      weight: 60,
      done: false,
    },
    {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      reps: 10,
      weight: 30,
      done: false,
    },
  ];
  db.command({
    type: "saveWorkout",
    item: workout,
    programId: program.id,
    sets,
  });
  expect(fitnessMetrics(db.state()).volume).toBe(0);
  expect(fitnessMetrics(db.state()).records).toHaveLength(0);
  db.command({
    type: "saveWorkout",
    item: { ...workout, status: "done" },
    programId: program.id,
    sets: sets.map((s, i) => ({ ...s, done: i < 2 })),
  });
  const run = {
    ...newItem("workout", "Бег"),
    date: "2026-11-03",
    category: "running",
    duration: 30,
    distance: 5,
    status: "done" as const,
  };
  db.command({ type: "saveWorkout", item: run, programId: null, sets: [] });
  const m = fitnessMetrics(db.state());
  expect(m.volume).toBe(960);
  expect(m.distance).toBe(5);
  expect(m.duration).toBe(75);
  expect(m.days).toBe(2);
  expect(m.records[0].maxWeight).toBe(60);
  expect(m.records[0].bestReps).toBe(8);
  expect(m.records[0].estimated1RM).toBeCloseTo(76);
  const zip = backupArchive(db);
  const before = db.state();
  db.command({ type: "removeProgram", id: program.id });
  expect(db.state().workoutPrograms[workout.id]).toBeNull();
  expect(fitnessMetrics(db.state()).volume).toBe(960);
  restoreArchive(db, zip);
  expect(db.state()).toEqual(before);
  expect(db.db.pragma("foreign_key_check")).toEqual([]);
  db.close();
});
test("invalid set and unknown exercise roll back the workout atomically", () => {
  const db = new Store(":memory:");
  const workout = { ...newItem("workout", "Keep"), date: "2026-11-02" };
  expect(() =>
    db.command({
      type: "saveWorkout",
      item: workout,
      programId: null,
      sets: [
        {
          id: crypto.randomUUID(),
          exerciseId: crypto.randomUUID(),
          reps: 10,
          weight: 20,
          done: true,
        },
      ],
    }),
  ).toThrow();
  expect(db.state().items).toHaveLength(0);
  expect(() =>
    db.command({
      type: "saveWorkout",
      item: workout,
      programId: null,
      sets: [
        {
          id: crypto.randomUUID(),
          exerciseId: crypto.randomUUID(),
          reps: -1,
          weight: 20,
          done: true,
        },
      ],
    }),
  ).toThrow();
  expect(db.state().items).toHaveLength(0);
  db.close();
});
