import type { Item, PlanningConstraint } from "../contracts";
import { interval } from "./index";
/** Interval partitioning: overlapping blocks receive stable adjacent lanes. */
export function calendarLanes(items: Item[]) {
  const sorted = items
    .map((item) => ({ item, range: interval(item) }))
    .filter(
      (x): x is { item: Item; range: { start: number; end: number } } =>
        !!x.range,
    )
    .sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);
  const result: Record<string, { column: number; columns: number }> = {};
  let group: { id: string; column: number }[] = [];
  let ends: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    for (const r of group)
      result[r.id] = { column: r.column, columns: ends.length };
    group = [];
    ends = [];
  };
  for (const { item, range } of sorted) {
    if (range.start >= groupEnd) flush();
    let column = ends.findIndex((end) => end <= range.start);
    if (column < 0) column = ends.length;
    ends[column] = range.end;
    group.push({ id: item.id, column });
    groupEnd = Math.max(groupEnd, range.end);
  }
  flush();
  return result;
}
export function freeWindows(
  day: string,
  items: Item[],
  from: number,
  to: number,
  constraints: PlanningConstraint[] = [],
) {
  const base = Date.parse(day + "T00:00:00Z") / 60000;
  const windows = items
    .map(interval)
    .filter((r): r is { start: number; end: number } => !!r)
    .map((r) => ({
      start: Math.max(from, r.start - base),
      end: Math.min(to, r.end - base),
    }));
  for (const c of constraints)
    if (
      c.kind === "blocked" &&
      (c.date
        ? c.date === day
        : c.weekday === (new Date(day + "T12:00:00Z").getUTCDay() || 7))
    )
      windows.push({
        start: Math.max(from, c.start),
        end: Math.min(to, c.end),
      });
  windows.sort((a, b) => a.start - b.start);
  let at = from;
  const free: { start: number; end: number }[] = [];
  for (const w of windows) {
    if (w.end <= w.start) continue;
    if (w.start > at) free.push({ start: at, end: w.start });
    at = Math.max(at, w.end);
  }
  if (at < to) free.push({ start: at, end: to });
  return free;
}
