import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem, weekDays } from "../packages/core";
import { emptyTaskDetails } from "../packages/contracts";
import { backupArchive, restoreArchive } from "../packages/database/backup";
import { calendarLanes, freeWindows } from "../packages/core/calendar";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dailyEfficiency, metrics } from "../packages/analytics";
test("v3 to v4 is preflighted on a recoverable copy and preserves all 54 source cells", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-v4-migration-"));
  let db = new Store(join(dir, "focus.db"));
  try {
    db.command({ type: "importStudy" });
    db.command({ type: "save", item: newItem("note", "Keep data") });
    const before = db.repo.records();
    db.db.exec(
      "DROP TABLE event_occurrences;DROP TABLE event_series;DROP TABLE entity_links;DROP TABLE note_folder_membership;DROP TABLE note_folders;DROP TABLE session_kinds;DROP TABLE notification_receipts;DROP INDEX entity_changes_entity_time;DROP INDEX entities_due_active;DELETE FROM schema_migrations WHERE version=4;",
    );
    db.close();
    db = new Store(join(dir, "focus.db"));
    expect(db.migrationBackup).toBeTruthy();
    expect(db.repo.records()).toEqual(before);
    expect(db.state().groups.flatMap((g) => g.values.flat())).toHaveLength(54);
    expect(db.db.pragma("foreign_key_check")).toEqual([]);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("event series anchors month-end, persists independent exceptions and cannot duplicate", () => {
  const db = new Store(":memory:");
  try {
    const item = {
      ...newItem("event", "Monthly"),
      date: "2026-01-31",
      time: "09:00",
      estimate: 60,
    };
    db.command({
      type: "saveEvent",
      item,
      recurrence: { frequency: "monthly", interval: 1, until: null },
      count: 3,
    });
    const s = db.state();
    expect(s.items.map((i) => i.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    const second = s.items[1];
    db.command({ type: "save", item: { ...second, date: "2026-02-27" } });
    const snapshot = db.dump(true);
    expect(() =>
      db.command({
        type: "saveEvent",
        item,
        recurrence: { frequency: "daily", interval: 1, until: null },
        count: 5,
      }),
    ).toThrow();
    expect(db.dump(true)).toBe(snapshot);
    expect(
      db.state().eventOccurrences?.find((x) => x.eventId === second.id)
        ?.originalDate,
    ).toBe("2026-02-28");
    const copy = new Store(":memory:");
    restoreArchive(copy, backupArchive(db));
    expect(copy.state().eventOccurrences).toEqual(db.state().eventOccurrences);
    expect(copy.state().items).toEqual(db.state().items);
    copy.close();
  } finally {
    db.close();
  }
});
test("calendar lane partition reuses lanes and free windows merge occupied intervals", () => {
  const make = (title: string, time: string, estimate: number) => ({
    ...newItem("event", title),
    date: "2026-11-03",
    time,
    estimate,
  });
  const a = make("a", "09:00", 180),
    b = make("b", "09:30", 30),
    c = make("c", "10:00", 60),
    d = make("d", "13:00", 60);
  const lanes = calendarLanes([a, b, c, d]);
  expect(lanes[a.id].columns).toBe(2);
  expect(lanes[b.id].column).toBe(lanes[c.id].column);
  expect(lanes[d.id].columns).toBe(1);
  expect(freeWindows("2026-11-03", [a, b, c, d], 540, 900)).toEqual([
    { start: 720, end: 780 },
    { start: 840, end: 900 },
  ]);
});
test("moving a weekly task updates current membership, preserving frozen original plan", () => {
  const db = new Store(":memory:");
  try {
    const t = {
      ...newItem("task", "Move"),
      date: "2026-11-03",
      status: "week" as const,
    };
    db.command({
      type: "saveTask",
      item: t,
      details: { ...emptyTaskDetails(), weeklyWeek: "2026-11-02" },
    });
    db.command({ type: "snapshot", week: "2026-11-02" });
    const snap = db.state().items.find((i) => i.kind === "snapshot")!.data;
    db.command({ type: "save", item: { ...t, date: "2026-11-12" } });
    expect(db.state().taskDetails[t.id].weeklyWeek).toBe(
      weekDays("2026-11-12")[0],
    );
    expect(db.state().items.find((i) => i.kind === "snapshot")!.data).toBe(
      snap,
    );
  } finally {
    db.close();
  }
});
test("break sessions persist but are excluded from work efficiency and focus totals", () => {
  const db = new Store(":memory:");
  try {
    db.command({
      type: "focusStart",
      taskId: null,
      target: 300,
      kind: "break",
    });
    const session = db.state().sessions[0];
    db.put("session", { ...session, seconds: 180, state: "done" });
    expect(db.state().sessions[0].kind).toBe("break");
    expect(metrics(db.state()).focusMinutes).toBe(0);
    expect(
      dailyEfficiency(db.state(), session.startedAt.slice(0, 10)).score,
    ).toBeNull();
    const copy = new Store(":memory:");
    restoreArchive(copy, backupArchive(db));
    expect(copy.state().sessions).toEqual(db.state().sessions);
    copy.close();
  } finally {
    db.close();
  }
});
test("note folders and typed relationships survive verified backup and reject orphan links", () => {
  const db = new Store(":memory:");
  try {
    const n = newItem("note", "Note"),
      t = newItem("task", "Task"),
      folder = crypto.randomUUID();
    db.command({ type: "saveMany", items: [n, t] });
    db.command({ type: "folder", id: folder, name: "Study" });
    db.command({ type: "noteFolder", noteId: n.id, folderId: folder });
    db.command({ type: "link", sourceId: n.id, targetId: t.id });
    const before = db.dump(true);
    expect(() =>
      db.command({
        type: "link",
        sourceId: n.id,
        targetId: crypto.randomUUID(),
      }),
    ).toThrow();
    expect(db.dump(true)).toBe(before);
    const copy = new Store(":memory:");
    restoreArchive(copy, backupArchive(db));
    expect(copy.state().noteMembership).toEqual(db.state().noteMembership);
    expect(copy.state().links).toEqual(db.state().links);
    copy.close();
  } finally {
    db.close();
  }
});
