import { dateInZone, minutes } from "../core";
import type { State, Item } from "../contracts";
export function ratio(a: number, b: number): number | null {
  return b > 0 ? Math.min(1, Math.max(0, a / b)) : null;
}
export function weightedScore(values: (number | null)[], weights: number[]) {
  let total = 0,
    sum = 0;
  values.forEach((v, i) => {
    if (v !== null && Number.isFinite(v) && weights[i] > 0) {
      total += weights[i];
      sum += v * weights[i];
    }
  });
  return total ? Math.round((100 * sum) / total) : null;
}
export function metrics(
  s: State,
  from = "0000",
  to = "9999",
  now = new Date(),
) {
  const tasks = s.items.filter((i) => i.kind === "task");
  const recorded = new Set(s.completions.map((x) => x.task.id));
  const historical = [
    ...s.completions.map((x) => x.task),
    ...tasks.filter((t) => !recorded.has(t.id)),
  ];
  const done = [
    ...new Map(
      historical
        .filter(
          (i) =>
            i.completedAt &&
            i.completedAt.slice(0, 10) >= from &&
            i.completedAt.slice(0, 10) <= to,
        )
        .map((i) => [i.id, i]),
    ).values(),
  ];
  const due = done.filter((i) => i.due);
  const sessions = s.sessions.filter(
    (i) =>
      i.kind !== "break" &&
      i.startedAt.slice(0, 10) >= from &&
      i.startedAt.slice(0, 10) <= to,
  );
  const workouts = s.items.filter(
    (i) => i.kind === "workout" && i.date && i.date >= from && i.date <= to,
  );
  const snaps = s.items.filter(
    (i) => i.kind === "snapshot" && i.date && i.date >= from && i.date <= to,
  );
  const original: Item[] = snaps.flatMap((i) => JSON.parse(i.data));
  const planned = ratio(
    original
      .filter((t) => done.some((d) => d.id === t.id))
      .reduce((a, t) => a + t.weight, 0),
    original.reduce((a, t) => a + t.weight, 0),
  );
  const timely = ratio(
    due.filter((t) => t.completedAt!.slice(0, 10) <= t.due!.slice(0, 10))
      .length,
    due.length,
  );
  const targeted = sessions.filter((x) => x.target > 0);
  const focus = ratio(
    targeted.reduce((a, x) => a + Math.min(x.seconds, x.target), 0),
    targeted.reduce((a, x) => a + x.target, 0),
  );
  const estimated = done
    .map((t) => {
      const actual = s.sessions
        .filter((x) => x.kind !== "break" && x.taskId === t.id)
        .reduce((a, x) => a + x.seconds / 60, 0);
      return actual > 0 && t.estimate > 0
        ? Math.min(actual, t.estimate) / Math.max(actual, t.estimate)
        : null;
    })
    .filter((v): v is number => v !== null);
  const accuracy = estimated.length
    ? estimated.reduce((a, b) => a + b, 0) / estimated.length
    : null;
  const zone = String(
    s.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const today = dateInZone(zone, now);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const currentMinutes =
    Number(timeParts.find((p) => p.type === "hour")?.value) * 60 +
    Number(timeParts.find((p) => p.type === "minute")?.value);
  const observedWorkouts = workouts.filter(
    (w) =>
      w.status === "done" ||
      w.date! < today ||
      (w.date === today &&
        w.time &&
        minutes(w.time) + w.estimate <= currentMinutes),
  );
  const regularity = ratio(
    observedWorkouts.filter((w) => w.status === "done").length,
    observedWorkouts.length,
  );
  const components = [planned, timely, focus, accuracy, regularity];
  return {
    tasks,
    done,
    workouts,
    sessions,
    original,
    components,
    score: weightedScore(
      components,
      Array.isArray(s.settings.weights)
        ? (s.settings.weights as number[])
        : [35, 25, 20, 10, 10],
    ),
    focusMinutes: Math.floor(sessions.reduce((a, x) => a + x.seconds, 0) / 60),
  };
}

/** Daily plan is the current dated plan; the weekly score retains its frozen-plan definition. */
export function dailyEfficiency(s: State, day: string) {
  const m = metrics(s, day, day);
  const tasks = s.items.filter((i) => i.kind === "task" && i.date === day);
  const sum = tasks.reduce((n, t) => n + t.weight, 0);
  const completed = tasks
    .filter((t) => t.status === "done")
    .reduce((n, t) => n + t.weight, 0);
  const components = [ratio(completed, sum), ...m.components.slice(1)];
  return {
    components,
    score: weightedScore(
      components,
      Array.isArray(s.settings.weights)
        ? (s.settings.weights as number[])
        : [35, 25, 20, 10, 10],
    ),
  };
}
