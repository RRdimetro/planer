import { CALENDAR_NAME, CalendarError } from "./types.ts";
import type { GoogleEvent } from "./types.ts";

const fail = (): never => { throw new CalendarError("invalid"); };
const text = (v: unknown, max = 4096): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const nullableText = (v: unknown, max = 16384) => v === null || text(v, max);
export function validZone(value: unknown): value is string {
  try { if (!text(value, 100)) return false; new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}
function validDate(value: unknown): value is string {
  try { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value; } catch { return false; }
}
function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length < 100 && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
}
function validPoint(value: any): boolean {
  return !!value && typeof value === "object" && (validDate(value.date) || validTimestamp(value.dateTime)) &&
    (value.timeZone === undefined || validZone(value.timeZone));
}
export function validateGoogleEvent(value: any): GoogleEvent {
  if (!value || typeof value !== "object" || !text(value.id, 2048)) fail();
  if (value.status !== undefined && !["confirmed", "tentative", "cancelled"].includes(value.status)) fail();
  for (const key of ["summary", "description", "location"])
    if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length > 1000000)) fail();
  if (value.recurringEventId !== undefined && !text(value.recurringEventId, 2048)) fail();
  if (value.originalStartTime !== undefined && !validPoint(value.originalStartTime)) fail();
  if (value.recurrence !== undefined && (!Array.isArray(value.recurrence) || value.recurrence.length > 256 || !value.recurrence.every((r: unknown) => text(r, 8192)))) fail();
  if (value.status !== "cancelled") {
    if (!validPoint(value.start) || !validPoint(value.end)) fail();
    if (value.start.date !== undefined) {
      if (!validDate(value.end.date) || value.end.date <= value.start.date) fail();
    } else if (!validTimestamp(value.end.dateTime) || Date.parse(value.end.dateTime) <= Date.parse(value.start.dateTime)) fail();
  }
  return value;
}
/** Validate every calendar, including hidden cached sources, before any restore writes. */
export function validateCalendarCache(cache: any, idFor: (key: string) => string): void {
  if (!cache || typeof cache !== "object" || !Array.isArray(cache.settings) || cache.settings.length !== 1 ||
    !Array.isArray(cache.sources) || cache.sources.length > 1000 || !Array.isArray(cache.events) || cache.events.length > 250000 ||
    !Array.isArray(cache.occurrences) || cache.occurrences.length > 250000) fail();
  const s = cache.settings[0];
  if (!s || s.id !== 1 || ![0, 1].includes(s.enabled) || !Number.isSafeInteger(s.generation) || s.generation < 0 ||
    ![s.commute_before, s.commute_after].every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 600) ||
    !Number.isInteger(s.interval_minutes) || s.interval_minutes < 5 || s.interval_minutes > 1440 || !nullableText(s.last_error, 4096)) fail();
  const sourceIds = new Set<string>();
  for (const source of cache.sources) {
    if (!source || !text(source.calendar_id) || sourceIds.has(source.calendar_id) || !nullableText(source.sync_token) ||
      !(source.last_success === null || validTimestamp(source.last_success)) ||
      !(source.window_start === null && source.window_end === null || validTimestamp(source.window_start) && validTimestamp(source.window_end) && Date.parse(source.window_end) > Date.parse(source.window_start))) fail();
    sourceIds.add(source.calendar_id);
  }
  if (s.calendar_json !== null) {
    if (!text(s.calendar_json, 16384)) fail();
    let c: any; try { c = JSON.parse(s.calendar_json); } catch { fail(); }
    if (!c || !text(c.id) || !sourceIds.has(c.id) || c.summary !== CALENDAR_NAME || !validZone(c.timeZone)) fail();
  }
  for (const [list, expanded] of [[cache.events, false], [cache.occurrences, true]] as const) {
    const ids = new Set<string>();
    for (const row of list) {
      if (!row || !sourceIds.has(row.calendar_id) || !text(row.event_id, 2048) || !text(row.raw_json, 4 * 1024 * 1024)) fail();
      const key = JSON.stringify([row.calendar_id, row.event_id]);
      if (ids.has(key)) fail(); ids.add(key);
      let event: GoogleEvent; try { event = validateGoogleEvent(JSON.parse(row.raw_json)); } catch { fail(); }
      if (event.id !== row.event_id) fail();
      if (expanded) {
        if (event.status === "cancelled" || row.local_id !== idFor(key) || row.recurring_event_id !== (event.recurringEventId ?? null)) fail();
        let original: unknown; try { original = row.original_start_json === null ? null : JSON.parse(row.original_start_json); } catch { fail(); }
        if (JSON.stringify(original) !== JSON.stringify(event.originalStartTime ?? null)) fail();
      }
    }
  }
}
