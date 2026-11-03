import type { State, Item } from "../contracts";
import {
  dateInZone,
  dateOfTimestamp,
  deadlineDay,
  isOverdue,
  addDays,
  weekDays,
} from "../core";
import { metrics, dailyEfficiency } from ".";
import { fitnessMetrics } from "./fitness";
export function insightState(s: State, project = "", category = ""): State {
  const match = (i: Item) =>
    (!project || i.projectId === project) &&
    (!category || i.category === category);
  const ids = new Set(
    [...s.items, ...s.completions.map((c) => c.task)]
      .filter((i) => i.kind === "task" && match(i))
      .map((i) => i.id),
  );
  return {
    ...s,
    items: s.items
      .filter((i) =>
        i.kind === "task" || i.kind === "workout"
          ? match(i)
          : i.kind === "snapshot"
            ? true
            : false,
      )
      .map((i) =>
        i.kind === "snapshot"
          ? {
              ...i,
              data: JSON.stringify(
                (JSON.parse(i.data) as Item[]).filter(match),
              ),
            }
          : i,
      ),
    completions: s.completions.filter((c) => match(c.task)),
    sessions: s.sessions.filter(
      (x) => (!project && !category) || (!!x.taskId && ids.has(x.taskId)),
    ),
    movementDays: s.movementDays?.filter(
      (r) =>
        (!project || r.projectId === project) &&
        (!category || r.category === category),
    ),
  };
}
export function insights(s: State, from: string, to: string, now = new Date()) {
  const length = Math.floor((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (!Number.isFinite(length) || length < 1 || length > 366)
    throw Error("Выберите период от 1 до 366 дней");
  const zone = String(s.settings.timezone ?? "Europe/Moscow"),
    today = dateInZone(zone, now);
  const dayOf = (iso: string) => dateOfTimestamp(iso, zone);
  const m = metrics(s, from, to, now),
    previous = metrics(s, addDays(from, -length), addDays(from, -1), now);
  const tasks = s.items.filter((i) => i.kind === "task");
  const days = Array.from({ length }, (_, n) => {
    const date = addDays(from, n),
      work = m.sessions.filter((x) => dayOf(x.startedAt) === date);
    const planned = tasks.filter((t) => t.date === date);
    return {
      date,
      label: date.slice(5),
      done: m.done.filter((t) => dayOf(t.completedAt!) === date).length,
      focus: Math.round(work.reduce((a, x) => a + x.seconds / 60, 0)),
      planned: planned.reduce((a, t) => a + t.estimate, 0),
      score: dailyEfficiency(s, date, now).score,
    };
  });
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const dates = days.filter(
      (d) => (new Date(d.date + "T12:00Z").getUTCDay() + 6) % 7 === i,
    );
    const observed = dates.filter((d) => d.date <= today && d.score !== null);
    return {
      name: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][i],
      score: observed.length
        ? Math.round(
            observed.reduce((a, d) => a + d.score!, 0) / observed.length,
          )
        : null,
      observations: observed.length,
    };
  });
  const months = Array.from(new Set(days.map((d) => d.date.slice(0, 7)))).map(
    (month) => ({ month, days: days.filter((d) => d.date.startsWith(month)) }),
  );
  const moves = (s.movementDays ?? [])
    .filter((d) => d.day >= from && d.day <= to)
    .reduce((a, d) => a + d.count, 0);
  const overdue = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.due &&
      isOverdue(t.due, zone, now) &&
      deadlineDay(t.due, zone) >= from &&
      deadlineDay(t.due, zone) <= to,
  );
  const week = weekDays(to);
  return {
    m,
    previous,
    days,
    weekdays,
    months,
    moves,
    overdue,
    daily: dailyEfficiency(s, to, now),
    weekly: metrics(s, week[0], week[6], now),
    fitness: fitnessMetrics(s, from, to),
  };
}
