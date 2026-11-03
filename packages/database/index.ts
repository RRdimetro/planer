import { auditDelta } from "./audit-delta";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { randomUUID } from "node:crypto";
import { Relations } from "./relations";
import {
  nextOccurrenceDate,
  dateInZone,
  weekDays,
  canSchedule,
  addDays,
} from "../core";
import * as schema from "./schema";
import { NormalizedRepository } from "./normalized";
import { migrate } from "./migrations";
import {
  commandSchema,
  recordSchema,
  subjectSchema,
  groupSchema,
  sessionSchema,
  validateSetting,
  type Command,
  type State,
  type Item,
} from "../contracts";
export class Store {
  readonly db: Database.Database;
  readonly orm;
  private undoStack: { snapshot: string; action: string }[] = [];
  private movementCache: {
    key: string;
    rows: NonNullable<State["movementDays"]>;
  } | null = null;
  readonly repo: NormalizedRepository;
  readonly relations: Relations;
  readonly migrationBackup: string | null;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode=WAL");
    this.db.pragma("foreign_keys=ON");
    this.orm = drizzle(this.db, { schema });
    this.db.transaction(() => {
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)));CREATE INDEX IF NOT EXISTS records_kind ON records(kind);CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,payload TEXT NOT NULL CHECK(json_valid(payload)));CREATE TABLE IF NOT EXISTS change_log(id INTEGER PRIMARY KEY,at TEXT NOT NULL,action TEXT NOT NULL,before_json TEXT,after_json TEXT);`,
      );
      this.db
        .prepare("INSERT OR IGNORE INTO schema_migrations VALUES(1,?)")
        .run(new Date().toISOString());
    })();
    try {
      this.migrationBackup = migrate(this.db, path);
    } catch (error) {
      this.db.close();
      throw error;
    }
    this.repo = new NormalizedRepository(this.db);
    this.relations = new Relations(this.db);
    this.db
      .prepare(
        "UPDATE focus_sessions SET state='interrupted' WHERE state='running'",
      )
      .run();
  }
  put<T extends { id: string }>(kind: string, item: T) {
    this.repo.put(kind, item);
  }
  list<T>(kind: string): T[] {
    return this.repo.list<T>(kind);
  }
  setting(key: string, value: unknown) {
    validateSetting(key, value);
    this.orm
      .insert(schema.settings)
      .values({ key, payload: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { payload: JSON.stringify(value) },
      })
      .run();
  }
  private movementDays(): NonNullable<State["movementDays"]> {
    const revision = (
      this.db.prepare("SELECT coalesce(max(id),0) n FROM change_log").get() as {
        n: number;
      }
    ).n;
    const pref = this.db
      .prepare("SELECT payload FROM settings WHERE key='timezone'")
      .get() as { payload: string } | undefined;
    const zone = pref
      ? JSON.parse(pref.payload)
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const key = `${revision}/${zone}`;
    if (this.movementCache?.key === key) return this.movementCache.rows;
    const rows = this.db
      .prepare(
        "SELECT at,json_extract(after_json,'$.projectId') projectId,json_extract(after_json,'$.category') category FROM entity_changes WHERE before_json IS NOT NULL AND json_extract(after_json,'$.kind')='task' AND json_extract(before_json,'$.date') IS NOT json_extract(after_json,'$.date')",
      )
      .all() as { at: string; projectId: string | null; category: string }[];
    const totals = new Map<
      string,
      NonNullable<State["movementDays"]>[number]
    >();
    for (const r of rows) {
      const day = dateInZone(zone, new Date(r.at));
      const key = JSON.stringify([day, r.projectId, r.category]);
      const total = totals.get(key);
      if (total) total.count++;
      else
        totals.set(key, {
          day,
          projectId: r.projectId,
          category: r.category,
          count: 1,
        });
    }
    const result = Array.from(totals.values()).sort((a, b) =>
      a.day.localeCompare(b.day),
    );
    this.movementCache = { key, rows: result };
    return result;
  }
  state(): State {
    return {
      revision: (
        this.db
          .prepare("SELECT coalesce(max(id),0) n FROM change_log")
          .get() as { n: number }
      ).n,
      ...this.relations.state(),
      ...this.relations.obsidianState(),
      movementDays: this.movementDays(),
      completions: this.list("completion"),
      items: ["task", "project", "event", "workout", "note", "snapshot"]
        .flatMap((k) => this.list<Item>(k))
        .filter((i) => !i.deletedAt),
      subjects: this.list("subject"),
      groups: this.list("group"),
      sessions: this.list("session"),
      settings: Object.fromEntries(
        this.orm
          .select()
          .from(schema.settings)
          .all()
          .map((r) => [r.key, JSON.parse(r.payload)]),
      ),
      diagnostics: {
        version: 5,
        integrity: String(this.db.pragma("quick_check", { simple: true })),
      },
    };
  }
  dump(includeBlobs = false) {
    return JSON.stringify({
      schema: 5,
      relations: this.relations.dump(includeBlobs),
      records: this.repo.records(),
      settings: this.orm.select().from(schema.settings).all(),
    });
  }
  restore(raw: string) {
    const d = JSON.parse(raw);
    if (
      !Array.isArray(d.records) ||
      !Array.isArray(d.settings) ||
      d.records.length > 100000
    )
      throw Error("Неверный формат резервной копии");
    for (const r of d.records) {
      const item = JSON.parse(r.payload);
      if (r.id !== item.id) throw Error("ID не совпадает");
      switch (r.kind) {
        case "subject":
          subjectSchema.parse(item);
          break;
        case "group":
          groupSchema.parse(item);
          break;
        case "session":
          sessionSchema.parse(item);
          break;
        case "snapshot":
          if (
            typeof item.data !== "string" ||
            !Array.isArray(JSON.parse(item.data))
          )
            throw Error("Неверный snapshot");
          break;
        case "completion":
          recordSchema.parse(item.task);
          break;
        case "task":
        case "project":
        case "event":
        case "note":
        case "workout":
          recordSchema.parse(item);
          if (item.kind !== r.kind) throw Error("Тип не совпадает");
          break;
        default:
          throw Error("Неизвестный тип записи");
      }
    }
    for (const setting of d.settings)
      validateSetting(setting.key, JSON.parse(setting.payload));
    const subjects = new Set(
      d.records
        .filter((r: { kind: string }) => r.kind === "subject")
        .map((r: { id: string }) => r.id),
    );
    for (const r of d.records.filter(
      (r: { kind: string }) => r.kind === "group",
    ))
      if (!subjects.has(JSON.parse(r.payload).subjectId))
        throw Error("Предмет группы не найден");
    this.db.transaction(() => {
      this.db.pragma("defer_foreign_keys=ON");
      this.db.exec(
        "DELETE FROM study_aggregate_bindings;DELETE FROM event_occurrences;DELETE FROM event_series;DELETE FROM entity_links;DELETE FROM note_folder_membership;DELETE FROM note_folders;DELETE FROM session_kinds;DELETE FROM notification_receipts;DELETE FROM attachments;DELETE FROM entity_changes;DELETE FROM completion_facts;DELETE FROM weekly_snapshot_items;DELETE FROM weekly_snapshots;DELETE FROM focus_sessions;DELETE FROM task_dependencies;DELETE FROM task_checklist;DELETE FROM recurrence_rules;DELETE FROM workout_sets;DELETE FROM program_exercises;DELETE FROM project_milestones;DELETE FROM tasks;DELETE FROM calendar_events;DELETE FROM notes;DELETE FROM workouts;DELETE FROM projects;DELETE FROM entities;DELETE FROM workout_programs;DELETE FROM exercises;DELETE FROM planning_constraints;DELETE FROM study_work_groups;DELETE FROM study_subjects;DELETE FROM settings;",
      );
      this.movementCache = null;
      this.repo.load(d.records);
      this.relations.load(d.relations);
      for (const s of d.settings) {
        JSON.parse(s.payload);
        this.db
          .prepare("INSERT INTO settings VALUES(?,?)")
          .run(s.key, s.payload);
      }
    })();
  }
  private saveItem(input: Item) {
    const row = this.db
      .prepare("SELECT kind FROM entities WHERE id=?")
      .get(input.id) as { kind: string } | undefined;
    if (row && row.kind !== input.kind)
      throw Error("Нельзя менять тип сущности");
    const old = this.repo.list<Item>(input.kind, input.id)[0];
    const item = {
      ...input,
      createdAt: old?.createdAt ?? input.createdAt,
      completedAt:
        input.status === "done"
          ? (old?.completedAt ?? new Date().toISOString())
          : null,
    };
    this.put(item.kind, item);
    if (item.kind === "note") {
      this.db
        .prepare(
          "DELETE FROM entity_links WHERE source_id=? AND relation='backlink'",
        )
        .run(item.id);
      const targets = new Set(
        Array.from(
          item.description.matchAll(/focus-note:([a-f0-9-]{36})/gi),
          (m) => m[1],
        ),
      );
      for (const id of targets)
        if (
          id !== item.id &&
          this.repo.list<Item>("note", id).some((n) => !n.deletedAt)
        )
          this.db
            .prepare(
              "INSERT OR IGNORE INTO entity_links VALUES(?,?,'backlink')",
            )
            .run(item.id, id);
    }

    if (item.kind === "task" && item.date && old?.date !== item.date)
      this.db
        .prepare(
          "UPDATE tasks SET weekly_week=? WHERE id=? AND weekly_week IS NOT NULL",
        )
        .run(weekDays(item.date)[0], item.id);
    if (
      item.kind === "task" &&
      item.status === "week" &&
      old?.status !== "week"
    ) {
      const row = this.db
        .prepare("SELECT weekly_week FROM tasks WHERE id=?")
        .get(item.id) as { weekly_week: string | null };
      if (!row.weekly_week)
        this.db
          .prepare("UPDATE tasks SET weekly_week=? WHERE id=?")
          .run(weekDays(item.date ?? this.currentDay())[0], item.id);
    }
    if (
      item.kind === "task" &&
      item.status === "done" &&
      old?.status !== "done"
    )
      this.put("completion", {
        id: randomUUID(),
        task: item,
        at: item.completedAt!,
      });
  }
  private currentDay() {
    const setting = this.db
      .prepare("SELECT payload FROM settings WHERE key='timezone'")
      .get() as { payload: string } | undefined;
    return dateInZone(
      setting
        ? JSON.parse(setting.payload)
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  }
  private generateRecurrences(before: string) {
    const previous = new Map<string, Item>(
      (JSON.parse(before).records as { kind: string; payload: string }[])
        .filter((r) => r.kind === "task")
        .map((r) => {
          const i = JSON.parse(r.payload);
          return [i.id, i];
        }),
    );
    const details = this.relations.taskDetails();
    const tasks = this.list<Item>("task");
    for (const t of tasks) {
      if (
        t.status !== "done" ||
        previous.get(t.id)?.status === "done" ||
        !details[t.id]?.recurrence
      )
        continue;
      const d = details[t.id];
      const rule = d.recurrence!;
      const row = this.db
        .prepare("SELECT recurrence_root_id FROM tasks WHERE id=?")
        .get(t.id) as { recurrence_root_id: string | null };
      const root = row.recurrence_root_id ?? t.id;
      const rootTask = this.repo.list<Item>("task", root)[0];
      const base =
        t.date ?? dateInZone(String(this.state().settings.timezone ?? "UTC"));
      const date = nextOccurrenceDate(
        base,
        rule,
        rootTask?.date ? Number(rootTask.date.slice(8)) : undefined,
      );
      if (!date) continue;
      const shiftedDue =
        t.due && /^\d{4}-\d{2}-\d{2}/.test(t.due)
          ? addDays(
              t.due.slice(0, 10),
              Math.round((Date.parse(date) - Date.parse(base)) / 86400000),
            ) + t.due.slice(10)
          : t.due;
      if (
        this.db
          .prepare(
            "SELECT id FROM tasks WHERE recurrence_root_id=? AND occurrence_date=?",
          )
          .get(root, date)
      )
        continue;
      this.db
        .prepare("UPDATE tasks SET recurrence_root_id=? WHERE id=?")
        .run(root, t.id);
      const next = {
        ...t,
        id: randomUUID(),
        date,
        due: shiftedDue,
        status: "week" as const,
        createdAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      };
      this.repo.put("task", next);
      this.relations.saveTask(next.id, {
        ...d,
        weeklyWeek: d.weeklyWeek ? weekDays(date)[0] : null,
        checklist: d.checklist.map((c) => ({
          ...c,
          id: randomUUID(),
          done: false,
        })),
      });
      this.db
        .prepare(
          "UPDATE tasks SET recurrence_root_id=?,occurrence_date=? WHERE id=?",
        )
        .run(root, date, next.id);
    }
  }
  private validateCompletedDependencies() {
    const invalid = this.db
      .prepare(
        "SELECT e.title FROM task_dependencies d JOIN entities e ON e.id=d.task_id JOIN entities parent ON parent.id=d.depends_on_id WHERE e.status='done' AND parent.status<>'done' AND e.deleted_at IS NULL LIMIT 1",
      )
      .get() as { title: string } | undefined;
    if (invalid)
      throw Error("Сначала завершите зависимости задачи: " + invalid.title);
  }
  command(input: Command): State {
    const c = commandSchema.parse(input);
    if (c.type === "workspace")
      throw Error("Операция доступна только в desktop");
    if (c.type === "file")
      throw Error("Файловая операция доступна только в desktop");
    if (c.type === "undo") {
      const prev = this.undoStack.at(-1);
      if (prev) {
        const before = this.dump();
        this.db.transaction(() => {
          const target = JSON.parse(prev.snapshot),
            current = JSON.parse(before);
          const known = new Set(
            target.records.map((r: { id: string }) => r.id),
          );
          for (const r of current.records)
            if (
              !known.has(r.id) &&
              ["task", "project", "event", "workout", "note"].includes(r.kind)
            )
              target.records.push({
                ...r,
                payload: JSON.stringify({
                  ...JSON.parse(r.payload),
                  deletedAt: new Date().toISOString(),
                }),
              });
          // Timer and background service state are independent of the edited task/note.
          target.records = target.records
            .filter((r: { kind: string }) => r.kind !== "session")
            .concat(
              current.records.filter(
                (r: { kind: string }) => r.kind === "session",
              ),
            );
          target.relations.sessionKinds = current.relations.sessionKinds;
          target.relations.notificationReceipts =
            current.relations.notificationReceipts;
          target.settings = target.settings
            .filter(
              (r: { key: string }) =>
                !["lastBackupAt", "lastBackupPath"].includes(r.key),
            )
            .concat(
              current.settings.filter((r: { key: string }) =>
                ["lastBackupAt", "lastBackupPath"].includes(r.key),
              ),
            );
          target.relations.entityChanges = this.db
            .prepare("SELECT * FROM entity_changes ORDER BY rowid")
            .all();
          this.restore(JSON.stringify(target));
          this.audit(before, "undo");
        })();
        this.undoStack.pop();
      }
      return this.state();
    }
    const before = this.dump();
    this.db.transaction(() => {
      this.db.pragma("defer_foreign_keys=ON");
      switch (c.type) {
        case "studyBinding":
          if (c.groupId)
            this.db
              .prepare(
                "INSERT INTO study_aggregate_bindings VALUES(?,?,?,?) ON CONFLICT(subject_id,kind) DO UPDATE SET group_id=excluded.group_id,stage_position=excluded.stage_position",
              )
              .run(c.subjectId, c.kind, c.groupId, c.stageRow);
          else
            this.db
              .prepare(
                "DELETE FROM study_aggregate_bindings WHERE subject_id=? AND kind=?",
              )
              .run(c.subjectId, c.kind);
          break;
        case "saveEvent": {
          if (!c.item.date) throw Error("Для повторов нужна дата");
          if (c.recurrence.until && c.recurrence.until < c.item.date)
            throw Error("Последняя дата серии раньше первой встречи");
          if (
            this.db
              .prepare("SELECT id FROM event_series WHERE id=?")
              .get(c.item.id)
          )
            throw Error(
              "Эта серия уже создана. Редактируйте отдельные события",
            );
          this.saveItem(c.item);
          this.db
            .prepare("INSERT INTO event_series VALUES(?,?,?,?)")
            .run(
              c.item.id,
              c.recurrence.frequency,
              c.recurrence.interval,
              c.recurrence.until,
            );
          let date = c.item.date;
          for (let n = 0; n < c.count; n++) {
            if (n) {
              const next = nextOccurrenceDate(
                date,
                c.recurrence,
                Number(c.item.date.slice(8)),
              );
              if (!next) break;
              date = next;
            }
            if (c.recurrence.until && date > c.recurrence.until) break;
            const item = n
              ? {
                  ...c.item,
                  id: randomUUID(),
                  date,
                  createdAt: new Date().toISOString(),
                }
              : c.item;
            if (n) this.saveItem(item);
            this.db
              .prepare("INSERT INTO event_occurrences VALUES(?,?,?)")
              .run(item.id, c.item.id, date);
          }
          break;
        }
        case "studyGroup": {
          const old = this.list<import("../contracts").StudyGroup>(
            "group",
          ).find((g) => g.id === c.group.id);
          if (!old) throw Error("Группа не найдена");
          if (
            c.group.subjectId !== old.subjectId ||
            c.group.stages.length < old.stages.length ||
            c.group.values[0].length < old.values[0].length
          )
            throw Error(
              "Существующие этапы и работы нельзя удалять этим редактором",
            );
          this.put("group", c.group);
          break;
        }
        case "studyWorkbook": {
          for (const subject of c.subjects) this.put("subject", subject);
          for (const group of c.groups) {
            const old = this.list<import("../contracts").StudyGroup>(
              "group",
            ).find((g) => g.id === group.id);
            if (
              old &&
              (group.subjectId !== old.subjectId ||
                group.stages.length < old.stages.length ||
                group.values[0].length < old.values[0].length)
            )
              throw Error("Excel не должен удалять существующие работы/этапы");
            this.put("group", group);
          }
          break;
        }
        case "folder":
          this.repo.upsert("note_folders", { id: c.id, name: c.name });
          break;
        case "noteFolder":
          if (c.folderId)
            this.repo.upsert("note_folder_membership", {
              note_id: c.noteId,
              folder_id: c.folderId,
            });
          else
            this.db
              .prepare("DELETE FROM note_folder_membership WHERE note_id=?")
              .run(c.noteId);
          break;
        case "link":
          if (c.remove)
            this.db
              .prepare(
                "DELETE FROM entity_links WHERE source_id=? AND target_id=? AND relation='related'",
              )
              .run(c.sourceId, c.targetId);
          else
            this.db
              .prepare(
                "INSERT OR IGNORE INTO entity_links VALUES(?,?,'related')",
              )
              .run(c.sourceId, c.targetId);
          break;
        case "applySchedule": {
          const state = this.state();
          if (state.revision !== c.expectedRevision)
            throw Error("Данные изменились. Постройте предпросмотр заново.");
          const ids = new Set(c.items.map((i) => i.id));
          const occupied = state.items.filter(
            (i) =>
              ["task", "event", "workout"].includes(i.kind) && !ids.has(i.id),
          );
          const options = {
            workDays: (state.settings.workDays as number[]) ?? [1, 2, 3, 4, 5],
            lectureWork: !!state.settings.lectureWork,
            afterWorkoutMinutes: Number(
              state.settings.afterWorkoutMinutes ?? 0,
            ),
            complexPriority: Number(state.settings.complexPriority ?? 3),
            constraints: state.constraints,
          };
          for (const item of c.items) {
            if (
              item.kind !== "task" ||
              !state.items.some((i) => i.id === item.id && i.kind === "task") ||
              !canSchedule(
                item,
                [...occupied, ...c.items.filter((i) => i.id !== item.id)],
                Number(state.settings.workStart ?? 9),
                Number(state.settings.workEnd ?? 18),
                options,
              )
            )
              throw Error("Расписание конфликтует с текущими ограничениями");
            const load = [...occupied, ...c.items]
              .filter((i) => i.kind === "task" && i.date === item.date)
              .reduce((a, i) => a + i.estimate, 0);
            if (load > Number(state.settings.dailyCapacity ?? 360))
              throw Error("Дневная ёмкость превышена");
            this.saveItem(item);
          }
          break;
        }
        case "saveTask":
          this.saveItem(c.item);
          this.relations.saveTask(c.item.id, {
            ...c.details,
            weeklyWeek:
              (c.item.date && c.details.weeklyWeek
                ? weekDays(c.item.date)[0]
                : c.details.weeklyWeek) ??
              (c.item.status === "week"
                ? weekDays(c.item.date ?? this.currentDay())[0]
                : null),
          });
          break;
        case "bulkTasks":
          for (const id of c.ids) {
            const item = this.repo.list<Item>("task", id)[0];
            if (!item) throw Error("Задача не найдена");
            const { weeklyWeek, deleted, ...patch } = c.patch;
            this.saveItem({
              ...item,
              ...patch,
              deletedAt: deleted ? new Date().toISOString() : item.deletedAt,
            });
            if (weeklyWeek !== undefined)
              this.db
                .prepare("UPDATE tasks SET weekly_week=? WHERE id=?")
                .run(weeklyWeek, id);
          }
          break;
        case "constraint": {
          const v = c.value;
          this.repo.upsert("planning_constraints", {
            id: v.id,
            label: v.label,
            date: v.date,
            weekday: v.weekday,
            start_min: v.start,
            end_min: v.end,
            kind: v.kind,
          });
          break;
        }
        case "removeConstraint":
          this.db
            .prepare("DELETE FROM planning_constraints WHERE id=?")
            .run(c.id);
          break;
        case "removeAttachment":
          this.db.prepare("DELETE FROM attachments WHERE id=?").run(c.id);
          break;
        case "exercise":
          this.repo.upsert("exercises", {
            id: c.value.id,
            name: c.value.name,
            muscle_group: c.value.muscleGroup,
          });
          break;
        case "program":
          this.relations.program(c.value);
          break;
        case "removeProgram":
          this.db
            .prepare("UPDATE workouts SET program_id=NULL WHERE program_id=?")
            .run(c.id);
          this.db.prepare("DELETE FROM workout_programs WHERE id=?").run(c.id);
          break;
        case "saveWorkout":
          this.saveItem(c.item);
          this.relations.sets(c.item.id, c.programId, c.sets);
          break;
        case "milestone": {
          const m = c.value;
          this.repo.upsert("project_milestones", {
            id: m.id,
            project_id: m.projectId,
            title: m.title,
            due: m.due,
            done: Number(m.done),
          });
          break;
        }
        case "removeMilestone":
          this.db
            .prepare("DELETE FROM project_milestones WHERE id=?")
            .run(c.id);
          break;
        case "save":
          this.saveItem(c.item);
          break;
        case "saveMany":
          for (const item of c.items) this.saveItem(item);
          break;
        case "remove": {
          this.db
            .prepare("UPDATE entities SET deleted_at=? WHERE id=?")
            .run(new Date().toISOString(), c.id);
          break;
        }
        case "settings":
          this.setting(c.key, c.value);
          break;
        case "importStudy":
          seedStudy(this);
          break;
        case "subject":
          this.put("subject", c.subject);
          break;
        case "removeSubject":
          this.db.prepare("DELETE FROM study_subjects WHERE id=?").run(c.id);
          break;
        case "stage": {
          const result = this.db
            .prepare(
              "UPDATE study_stage_status SET status=?,updated_at=? WHERE group_id=? AND work_id=(SELECT id FROM study_works WHERE group_id=? AND number=?) AND stage_id=(SELECT id FROM study_stage_definitions WHERE group_id=? AND position=?)",
            )
            .run(
              c.status,
              new Date().toISOString(),
              c.groupId,
              c.groupId,
              c.column + 1,
              c.groupId,
              c.row,
            );
          if (result.changes !== 1) throw Error("Этап не найден");
          break;
        }
        case "addGroup":
          if (!this.state().subjects.some((s) => s.id === c.subjectId))
            throw Error("Предмет не найден");
          this.put("group", {
            id: randomUUID(),
            subjectId: c.subjectId,
            name: c.name,
            stages: c.stages,
            values: c.stages.map(() => Array(c.count).fill("unknown")),
          });
          break;
        case "snapshot": {
          const existing = this.list<Item>("snapshot").some(
            (s) => s.date === c.week,
          );
          if (existing)
            throw Error("Исходный план этой недели уже зафиксирован");
          this.put("snapshot", {
            id: randomUUID(),
            kind: "snapshot",
            title: "Исходный план",
            date: c.week,
            data: JSON.stringify(
              this.state().items.filter(
                (t) =>
                  t.kind === "task" &&
                  (this.relations.taskDetails()[t.id]?.weeklyWeek === c.week ||
                    (!this.relations.taskDetails()[t.id]?.weeklyWeek &&
                      t.status === "week" &&
                      !t.date) ||
                    (t.date &&
                      t.date >= c.week &&
                      t.date <=
                        new Date(Date.parse(c.week) + 6 * 86400000)
                          .toISOString()
                          .slice(0, 10))),
              ),
            ),
          } as Item);
          break;
        }
        case "focusStart":
          if (
            c.taskId &&
            !this.state().items.some(
              (t) => t.id === c.taskId && t.kind === "task",
            )
          )
            throw Error("Задача фокуса не найдена");
          if (
            this.state().sessions.some((s) =>
              ["running", "paused", "interrupted"].includes(s.state),
            )
          )
            throw Error("Сначала завершите текущую сессию");
          this.put("session", {
            id: randomUUID(),
            taskId: c.taskId,
            startedAt: new Date().toISOString(),
            seconds: 0,
            state: "running",
            target: c.target,
            ...(c.kind ? { kind: c.kind } : {}),
          });
          break;
        case "focusAction": {
          const s = this.state().sessions.find((s) =>
            ["running", "paused", "interrupted"].includes(s.state),
          );
          if (!s) throw Error("Нет активной сессии");
          s.state =
            c.action === "finish"
              ? "done"
              : c.action === "pause"
                ? "paused"
                : "running";
          this.put("session", s);
          break;
        }
      }
      for (const b of this.db
        .prepare("SELECT * FROM study_aggregate_bindings")
        .all() as {
        subject_id: string;
        kind: string;
        group_id: string;
        stage_position: number;
      }[]) {
        const counts = this.db
          .prepare(
            "SELECT count(*) total,coalesce(sum(s.status='done'),0) completed FROM study_stage_status s JOIN study_stage_definitions d ON s.stage_id=d.id WHERE s.group_id=? AND d.position=?",
          )
          .get(b.group_id, b.stage_position) as {
          total: number;
          completed: number;
        };
        this.db
          .prepare(
            "UPDATE study_aggregate_counts SET total=?,completed=? WHERE subject_id=? AND kind=?",
          )
          .run(counts.total, counts.completed, b.subject_id, b.kind);
      }
      this.validateCompletedDependencies();
      this.generateRecurrences(before);
      this.audit(before, c.type);
    })();
    if (c.type !== "focusStart" && c.type !== "focusAction")
      this.undoStack.push({ snapshot: before, action: c.type });
    if (this.undoStack.length > 30) this.undoStack.shift();
    return this.state();
  }
  private audit(before: string, action: string) {
    const afterState = this.dump();
    const previous = JSON.parse(before).records as {
      id: string;
      kind: string;
      payload: string;
    }[];
    const prevMap = new Map(
      previous
        .filter((r) =>
          ["task", "project", "workout", "event", "note"].includes(r.kind),
        )
        .map((r) => [r.id, r.payload]),
    );
    for (const r of this.repo
      .records()
      .filter((r) =>
        ["task", "project", "workout", "event", "note"].includes(r.kind),
      ))
      if (prevMap.get(r.id) !== r.payload)
        this.db
          .prepare("INSERT INTO entity_changes VALUES(?,?,?,?,?,?)")
          .run(
            randomUUID(),
            r.id,
            new Date().toISOString(),
            action,
            prevMap.get(r.id) ?? null,
            r.payload,
          );
    this.db
      .prepare(
        "INSERT INTO change_log(at,action,before_json,after_json) VALUES(?,?,?,?)",
      )
      .run(new Date().toISOString(), action, ...auditDelta(before, afterState));
  }
  attach(entityId: string, name: string, mimeType: string, content: Buffer) {
    const before = this.dump();
    this.db.transaction(() => {
      this.relations.attach(entityId, name, mimeType, content);
      this.db
        .prepare("INSERT INTO entity_changes VALUES(?,?,?,?,?,?)")
        .run(
          randomUUID(),
          entityId,
          new Date().toISOString(),
          "attach",
          null,
          JSON.stringify({ name, size: content.length }),
        );
      this.db
        .prepare(
          "INSERT INTO change_log(at,action,before_json,after_json) VALUES(?,?,?,?)",
        )
        .run(
          new Date().toISOString(),
          "attach",
          ...auditDelta(before, this.dump()),
        );
    })();
    this.undoStack.push({ snapshot: before, action: "attach" });
    if (this.undoStack.length > 30) this.undoStack.shift();
  }
  resetUndo() {
    this.undoStack = [];
  }
  close() {
    this.db.close();
  }
}
export function seedStudy(store: Store) {
  if (store.state().subjects.length) return;
  const rows: [string, number, number, number, number][] = [
    ["АСОИУ", 0, 1, 0, 0],
    ["Англ яз", 1, 3, 1, 1],
    ["Модели данных", 0, 1, 0, 1],
    ["Программирование", 0, 2, 0, 1],
    ["Правоведение", 1, 2, 0, 1],
    ["Теорвер", 0, 3, 1, 3],
    ["Физика", 0, 2, 1, 4],
    ["Экология", 0, 2, 0, 2],
    ["Электротехника", 2, 4, 0, 1],
  ];
  const ids = rows.map(([name, rkDone, rkTotal, hwDone, hwTotal]) => {
    const id = randomUUID();
    store.put("subject", {
      id,
      name,
      rkDone,
      rkTotal,
      hwDone,
      hwTotal,
      exam: null,
      grade: null,
    });
    return id;
  });
  const defs: [string, number, string[], string[]][] = [
    [
      "Физика лабы",
      6,
      ["Написана", "Выполнена", "Защищена"],
      ["++++--", "++++--", "+++---"],
    ],
    [
      "Физика ДЗ",
      6,
      ["Решена", "Сдана", "Защита теор", "Защита прак"],
      ["++??", "++??", "+???", "++??"],
    ],
    ["ЭлТех лабы", 8, ["Выполнена", "Защищена"], ["++??", "++??"]],
    ["МД лабы", 2, ["Выполнена", "Защищена"], ["++----", "++----"]],
  ];
  for (const [name, index, stages, values] of defs)
    store.put("group", {
      id: randomUUID(),
      subjectId: ids[index],
      name,
      stages,
      values: values.map((row) =>
        [...row].map((s) =>
          s === "+" ? "done" : s === "-" ? "not_done" : "unknown",
        ),
      ),
    });
  store.setting("onboarded", true);
}
