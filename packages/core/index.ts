import type { Item, TaskDetails, PlanningConstraint } from "../contracts";
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekDays(date = localDate()) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return localDate(x);
  });
}
export function newItem(kind: Item["kind"], title: string): Item {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    description: "",
    status: "backlog",
    priority: 2,
    estimate: 30,
    weight: 1,
    date: null,
    time: null,
    due: null,
    projectId: null,
    category: "",
    tags: "",
    duration: 0,
    distance: null,
    data: "{}",
    createdAt: new Date().toISOString(),
    completedAt: null,
    deletedAt: null,
  };
}
export function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function timeLabel(value: number) {
  return (
    String(Math.floor(value / 60)).padStart(2, "0") +
    ":" +
    String(value % 60).padStart(2, "0")
  );
}
export function interval(item: Item) {
  if (!item.date || !item.time) return null;
  const start =
    Date.parse(item.date + "T00:00:00Z") / 60000 + minutes(item.time);
  return { start, end: start + item.estimate };
}
export function conflicts(item: Item, items: Item[]) {
  const a = interval(item);
  if (!a) return [];
  return items.filter((i) => {
    const b = interval(i);
    return (
      i.id !== item.id &&
      ["task", "event", "workout"].includes(i.kind) &&
      b &&
      a.start < b.end &&
      a.end > b.start
    );
  });
}
export interface PlannerOptions {
  workDays?: number[];
  lectureWork?: boolean;
  afterWorkoutMinutes?: number;
  complexPriority?: number;
  constraints?: PlanningConstraint[];
  taskDetails?: Record<string, TaskDetails>;
  allTasks?: Item[];
}
const lecture = (i: Item) =>
  i.kind === "event" &&
  ["university", "university class", "class", "lecture"].includes(i.category);
export function constraintsFor(day: string, rules: PlanningConstraint[]) {
  const weekday = new Date(day + "T12:00:00Z").getUTCDay() || 7;
  return rules.filter((c) => (c.date ? c.date === day : c.weekday === weekday));
}
export function availableMinutes(
  day: string,
  occupied: Item[],
  start: number,
  end: number,
  capacity: number,
  options: PlannerOptions = {},
) {
  const weekday = new Date(day + "T12:00:00Z").getUTCDay() || 7;
  if (options.workDays && !options.workDays.includes(weekday)) return 0;
  const base = Date.parse(day + "T00:00:00Z") / 60000;
  const intervals = occupied
    .filter((i) => !lecture(i) || !options.lectureWork)
    .map(interval)
    .filter((i): i is { start: number; end: number } => !!i)
    .map((i) => ({
      start: Math.max(start * 60, i.start - base),
      end: Math.min(end * 60, i.end - base),
    }));
  for (const c of constraintsFor(day, options.constraints ?? []).filter(
    (c) => c.kind === "blocked",
  ))
    intervals.push({
      start: Math.max(start * 60, c.start),
      end: Math.min(end * 60, c.end),
    });
  const merged = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  let blocked = 0,
    lastEnd = start * 60;
  for (const i of merged) {
    blocked += Math.max(0, i.end - Math.max(lastEnd, i.start));
    lastEnd = Math.max(lastEnd, i.end);
  }
  return Math.max(0, Math.min(capacity, (end - start) * 60 - blocked));
}
export function canSchedule(
  task: Item,
  occupied: Item[],
  start: number,
  end: number,
  options: PlannerOptions = {},
) {
  if (!task.date || !task.time || task.estimate <= 0) return false;
  const day = task.date;
  const weekday = new Date(day + "T12:00:00Z").getUTCDay() || 7;
  const t = minutes(task.time);
  if (
    (options.workDays && !options.workDays.includes(weekday)) ||
    t < start * 60 ||
    t + task.estimate > end * 60
  )
    return false;
  if (task.due && day > task.due.slice(0, 10)) return false;
  const busy = occupied.filter((i) => !(lecture(i) && options.lectureWork));
  if (conflicts(task, busy).length) return false;
  for (const c of constraintsFor(day, options.constraints ?? []))
    if (
      (c.kind === "blocked" ||
        task.priority >= (options.complexPriority ?? 3)) &&
      t < c.end &&
      t + task.estimate > c.start
    )
      return false;
  if (
    task.priority >= (options.complexPriority ?? 3) &&
    (options.afterWorkoutMinutes ?? 0) > 0
  ) {
    const a = interval(task)!;
    for (const w of occupied.filter((w) => w.kind === "workout")) {
      const b = interval(w);
      if (b && a.start < b.end + options.afterWorkoutMinutes! && a.end > b.end)
        return false;
    }
  }
  return true;
}
export function distribute(
  tasks: Item[],
  occupied: Item[],
  days: string[],
  start = 9,
  end = 18,
  capacity = 360,
  options: PlannerOptions = {},
) {
  const result: Item[] = [];
  const rejected: Item[] = [];
  const reasons: Record<string, string> = {};
  const all = new Map(
    [...(options.allTasks ?? []), ...occupied, ...tasks].map((i) => [i.id, i]),
  );
  let pending = [...tasks].sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
      a.createdAt.localeCompare(b.createdAt),
  );
  let attempts = 0;
  while (pending.length && attempts++ <= tasks.length) {
    const waiting: Item[] = [];
    let progress = false;
    for (const task of pending) {
      const deps = options.taskDetails?.[task.id]?.dependencies ?? [];
      const unfinished = deps
        .map((id) => all.get(id))
        .filter((d) => !d || d.status !== "done");
      if (
        unfinished.some(
          (d) =>
            !d || (!result.some((r) => r.id === d.id) && (!d.date || !d.time)),
        )
      ) {
        waiting.push(task);
        reasons[task.id] = "Сначала запланируйте зависимости";
        continue;
      }
      let found = false;
      for (const date of days) {
        const taskLoad = [...occupied, ...result]
          .filter(
            (i) => i.kind === "task" && i.date === date && i.id !== task.id,
          )
          .reduce((a, i) => a + i.estimate, 0);
        if (taskLoad + task.estimate > capacity) continue;
        for (let t = start * 60; t + task.estimate <= end * 60; t += 15) {
          const item = {
            ...task,
            date,
            time: timeLabel(t),
            status: "today" as const,
          };
          const a = interval(item)!;
          if (
            unfinished.some((d) => {
              const planned = result.find((r) => r.id === d!.id) ?? d!;
              const b = interval(planned);
              return !b || a.start < b.end;
            })
          )
            continue;
          if (
            canSchedule(item, [...occupied, ...result], start, end, options)
          ) {
            result.push(item);
            found = true;
            progress = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        waiting.push(task);
        reasons[task.id] =
          task.estimate <= 0
            ? "Укажите оценку длительности"
            : "Нет свободного интервала до дедлайна с учётом ограничений";
      }
    }
    if (!progress) {
      rejected.push(...waiting);
      break;
    }
    pending = waiting;
  }
  return { result, rejected, reasons };
}
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const timestampDays = new Map<string, string>();
export function dateOfTimestamp(iso: string, zone: string) {
  const key = zone + "/" + iso;
  let day = timestampDays.get(key);
  if (day === undefined) {
    day = dateInZone(zone, new Date(iso));
    if (timestampDays.size >= 20000) timestampDays.clear();
    timestampDays.set(key, day);
  }
  return day;
}
export function deadlineDay(due: string, zone: string) {
  return due.includes("T") ? dateOfTimestamp(due, zone) : due.slice(0, 10);
}
export function isOverdue(due: string, zone: string, now = new Date()) {
  return due.includes("T")
    ? Date.parse(due) < now.getTime()
    : due.slice(0, 10) < dateInZone(zone, now);
}
export function onTime(completedAt: string, due: string, zone: string) {
  return due.includes("T")
    ? Date.parse(completedAt) <= Date.parse(due)
    : dateOfTimestamp(completedAt, zone) <= due.slice(0, 10);
}
export function dateInZone(timeZone: string, date = new Date()) {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (dateFormatters.size >= 32)
      dateFormatters.delete(dateFormatters.keys().next().value!);
    dateFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function addDays(date: string, count: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function nextOccurrenceDate(
  date: string,
  rule: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    until: string | null;
  },
  anchorDay?: number,
) {
  let next: string;
  if (rule.frequency === "monthly") {
    const d = new Date(date + "T12:00:00Z");
    const original = anchorDay ?? d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + rule.interval);
    const max = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(original, max));
    next = d.toISOString().slice(0, 10);
  } else
    next = addDays(date, rule.interval * (rule.frequency === "weekly" ? 7 : 1));
  return rule.until && next > rule.until ? null : next;
}
