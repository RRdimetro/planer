import type { State } from "../contracts";
import { addDays, dateInZone, weekDays } from "../core";
import { metrics } from "./index";

export function dashboardData(s: State, now = new Date()) {
  const zone = String(
    s.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const today = dateInZone(zone, now);
  const days = weekDays(today);
  const tasks = s.items.filter((i) => i.kind === "task");
  const todayTasks = tasks.filter((t) => t.date === today);
  const projects = s.items.filter(
    (i) => i.kind === "project" && i.status !== "done",
  );
  const current = metrics(s, days[0], days[6], now);
  const previous = metrics(s, addDays(days[0], -7), addDays(days[0], -1), now);
  const daily = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(
    (date) => ({
      date,
      label: new Date(date + "T12:00:00Z").toLocaleDateString("ru-RU", {
        weekday: "short",
        timeZone: "UTC",
      }),
      completed: new Set(
        s.completions
          .filter((c) => dateInZone(zone, new Date(c.at)) === date)
          .map((c) => c.task.id),
      ).size,
      focus: Math.floor(
        s.sessions
          .filter((x) => dateInZone(zone, new Date(x.startedAt)) === date)
          .reduce((n, x) => n + x.seconds, 0) / 60,
      ),
    }),
  );
  const timeline = s.items
    .filter(
      (i) =>
        ["task", "event", "workout"].includes(i.kind) &&
        i.date === today &&
        i.time,
    )
    .sort((a, b) => a.time!.localeCompare(b.time!));
  const pending = todayTasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => b.priority - a.priority);
  const deadlines = tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.due &&
        t.due.slice(0, 10) >= today &&
        t.due.slice(0, 10) <= addDays(today, 7),
    )
    .sort((a, b) => a.due!.localeCompare(b.due!));
  const workouts = s.items.filter(
    (i) => i.kind === "workout" && i.date && days.includes(i.date),
  );
  const finishedWorkouts = workouts.filter((w) => w.status === "done");
  return {
    today,
    zone,
    days,
    tasks,
    todayTasks,
    projects,
    current,
    previous,
    daily,
    timeline,
    pending,
    deadlines,
    workouts,
    finishedWorkouts,
    doneToday: todayTasks.filter((t) => t.status === "done").length,
    focusToday: daily[6].focus,
    runningKm: finishedWorkouts
      .filter((w) => w.category === "running")
      .reduce((n, w) => n + (w.distance ?? 0), 0),
    workoutMinutes: finishedWorkouts.reduce((n, w) => n + w.duration, 0),
  };
}
