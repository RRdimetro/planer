import { createHash } from "node:crypto";
import type { CalendarChoice, DatabaseLike, GoogleEvent } from "./types.ts";
import { CalendarError } from "./types.ts";
import { validateCalendarCache } from "./validation.ts";

export const calendarSQL = `
CREATE TABLE google_calendar_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), calendar_json TEXT CHECK(calendar_json IS NULL OR json_valid(calendar_json)),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)), generation INTEGER NOT NULL DEFAULT 0,
 commute_before INTEGER NOT NULL DEFAULT 90 CHECK(commute_before BETWEEN 0 AND 600),
 commute_after INTEGER NOT NULL DEFAULT 90 CHECK(commute_after BETWEEN 0 AND 600),
 interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK(interval_minutes BETWEEN 5 AND 1440), last_error TEXT
);
INSERT INTO google_calendar_settings(id) VALUES(1);
CREATE TABLE google_calendar_sources (
 calendar_id TEXT PRIMARY KEY, sync_token TEXT, last_success TEXT, window_start TEXT, window_end TEXT
);
CREATE TABLE google_calendar_events (
 calendar_id TEXT NOT NULL REFERENCES google_calendar_sources(calendar_id) ON DELETE CASCADE,
 event_id TEXT NOT NULL, raw_json TEXT NOT NULL CHECK(json_valid(raw_json)), PRIMARY KEY(calendar_id,event_id)
);
CREATE TABLE google_calendar_occurrences (
 calendar_id TEXT NOT NULL REFERENCES google_calendar_sources(calendar_id) ON DELETE CASCADE,
 event_id TEXT NOT NULL, local_id TEXT NOT NULL UNIQUE, recurring_event_id TEXT,
 original_start_json TEXT CHECK(original_start_json IS NULL OR json_valid(original_start_json)),
 raw_json TEXT NOT NULL CHECK(json_valid(raw_json)), PRIMARY KEY(calendar_id,event_id)
);`;

export function stableCalendarId(key: string): string {
  const b = createHash("sha256").update("focus/google-calendar/v1/" + key).digest().subarray(0,16);
  b[6] = (b[6] & 15) | 80; b[8] = (b[8] & 63) | 128;
  const s=b.toString("hex");
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export class CalendarRepository {
  constructor(public db: DatabaseLike) {}
  settings() {
    const r = this.db.prepare("SELECT * FROM google_calendar_settings WHERE id=1").get();
    return { calendar: r.calendar_json ? JSON.parse(r.calendar_json) as CalendarChoice : null,
      enabled: Boolean(r.enabled), generation: Number(r.generation), commuteBefore: Number(r.commute_before),
      commuteAfter: Number(r.commute_after), intervalMinutes: Number(r.interval_minutes), error: r.last_error as string | null };
  }
  select(calendar: CalendarChoice) {
    this.db.transaction(() => {
      this.db.prepare("INSERT OR IGNORE INTO google_calendar_sources(calendar_id) VALUES(?)").run(calendar.id);
      this.db.prepare("UPDATE google_calendar_settings SET calendar_json=?, enabled=1, generation=generation+1,last_error=NULL WHERE id=1").run(JSON.stringify(calendar));
      this.invalidatePreview();
    })();
  }
  disconnect() {
    this.db.prepare("UPDATE google_calendar_settings SET enabled=0,generation=generation+1,last_error=NULL WHERE id=1").run();
  }
  configure(before: number, after: number, minutes: number) {
    if (![before, after, minutes].every(Number.isInteger) || before<0 || after<0 || before>600 || after>600 || minutes<5 || minutes>1440)
      throw new CalendarError("invalid");
    this.db.transaction(() => {
      this.db.prepare("UPDATE google_calendar_settings SET commute_before=?,commute_after=?,interval_minutes=?,generation=generation+1 WHERE id=1").run(before,after,minutes);
      this.invalidatePreview();
    })();
  }
  source(id: string) { return this.db.prepare("SELECT * FROM google_calendar_sources WHERE calendar_id=?").get(id) ?? {}; }
  occurrences(id: string): { localId: string; event: GoogleEvent }[] {
    return this.db.prepare("SELECT local_id,raw_json FROM google_calendar_occurrences WHERE calendar_id=? ORDER BY event_id").all(id)
      .map((r: any) => ({ localId:r.local_id, event:JSON.parse(r.raw_json) }));
  }
  error(generation: number, message: string) {
    this.db.prepare("UPDATE google_calendar_settings SET last_error=? WHERE id=1 AND generation=?").run(message,generation);
  }
  commit(input: { generation: number; calendarId: string; full: boolean; events: GoogleEvent[]; occurrences: GoogleEvent[]; syncToken: string; windowStart: string; windowEnd: string; now: string }) {
    this.db.transaction(() => {
      const cfg=this.settings();
      if (!cfg.enabled || cfg.generation!==input.generation || cfg.calendar?.id!==input.calendarId) throw new CalendarError("changed");
      const old = this.occurrences(input.calendarId).map(r=>JSON.stringify(r.event)).sort().join("\n");
      if (input.full) this.db.prepare("DELETE FROM google_calendar_events WHERE calendar_id=?").run(input.calendarId);
      for (const e of input.events) this.db.prepare("INSERT INTO google_calendar_events VALUES(?,?,?) ON CONFLICT(calendar_id,event_id) DO UPDATE SET raw_json=excluded.raw_json").run(input.calendarId,e.id,JSON.stringify(e));
      this.db.prepare("DELETE FROM google_calendar_occurrences WHERE calendar_id=?").run(input.calendarId);
      for (const e of input.occurrences) {
        if(e.status==="cancelled") continue;
        this.db.prepare("INSERT INTO google_calendar_occurrences VALUES(?,?,?,?,?,?)").run(input.calendarId,e.id,
          stableCalendarId(JSON.stringify([input.calendarId,e.id])),e.recurringEventId??null,e.originalStartTime?JSON.stringify(e.originalStartTime):null,JSON.stringify(e));
      }
      this.db.prepare("UPDATE google_calendar_sources SET sync_token=?,last_success=?,window_start=?,window_end=? WHERE calendar_id=?").run(input.syncToken,input.now,input.windowStart,input.windowEnd,input.calendarId);
      this.db.prepare("UPDATE google_calendar_settings SET last_error=NULL WHERE id=1").run();
      const next=this.occurrences(input.calendarId).map(r=>JSON.stringify(r.event)).sort().join("\n");
      if(old!==next) this.invalidatePreview();
    })();
  }
  private invalidatePreview() {
    this.db.prepare("INSERT INTO change_log(at,action,before_json,after_json) VALUES(?,'googleCalendar',NULL,NULL)").run(new Date().toISOString());
  }
  exportCache() {
    return { settings:this.db.prepare("SELECT * FROM google_calendar_settings").all(), sources:this.db.prepare("SELECT * FROM google_calendar_sources").all(),
      events:this.db.prepare("SELECT * FROM google_calendar_events").all(),occurrences:this.db.prepare("SELECT * FROM google_calendar_occurrences").all() };
  }
  restoreCache(cache: any) {
    validateCalendarCache(cache, stableCalendarId);
    this.db.transaction(() => {
      this.db.exec("DELETE FROM google_calendar_occurrences; DELETE FROM google_calendar_events; DELETE FROM google_calendar_sources;");
      for(const s of cache.sources) this.db.prepare("INSERT INTO google_calendar_sources VALUES(?,?,?,?,?)").run(s.calendar_id,s.sync_token,s.last_success,s.window_start,s.window_end);
      for(const e of cache.events) this.db.prepare("INSERT INTO google_calendar_events VALUES(?,?,?)").run(e.calendar_id,e.event_id,e.raw_json);
      for(const e of cache.occurrences) this.db.prepare("INSERT INTO google_calendar_occurrences VALUES(?,?,?,?,?,?)").run(e.calendar_id,e.event_id,e.local_id,e.recurring_event_id,e.original_start_json,e.raw_json);
      const s=cache.settings[0];
      this.configure(s.commute_before,s.commute_after,s.interval_minutes);
      if(s.calendar_json) { const c=JSON.parse(s.calendar_json); if(typeof c.id!=="string"||typeof c.summary!=="string")throw new CalendarError("invalid"); }
      this.db.prepare("UPDATE google_calendar_settings SET calendar_json=?,enabled=0,generation=generation+1,last_error=NULL WHERE id=1").run(s.calendar_json);
    })();
  }
}
