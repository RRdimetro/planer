import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { randomUUID } from "node:crypto";
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
  private undoStack: string[] = [];
  readonly repo: NormalizedRepository;
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
  state(): State {
    return {
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
        version: 2,
        integrity: String(this.db.pragma("quick_check", { simple: true })),
      },
    };
  }
  dump() {
    return JSON.stringify({
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
        "DELETE FROM attachments;DELETE FROM entity_changes;DELETE FROM completion_facts;DELETE FROM weekly_snapshot_items;DELETE FROM weekly_snapshots;DELETE FROM focus_sessions;DELETE FROM task_dependencies;DELETE FROM task_checklist;DELETE FROM recurrence_rules;DELETE FROM workout_sets;DELETE FROM program_exercises;DELETE FROM project_milestones;DELETE FROM tasks;DELETE FROM calendar_events;DELETE FROM notes;DELETE FROM workouts;DELETE FROM projects;DELETE FROM entities;DELETE FROM study_work_groups;DELETE FROM study_subjects;DELETE FROM settings;",
      );
      this.repo.load(d.records);
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
  command(input: Command): State {
    const c = commandSchema.parse(input);
    if (c.type === "file")
      throw Error("Файловая операция доступна только в desktop");
    if (c.type === "undo") {
      const prev = this.undoStack.pop();
      if (prev) this.restore(prev);
      return this.state();
    }
    const before = this.dump();
    this.db.transaction(() => {
      this.db.pragma("defer_foreign_keys=ON");
      switch (c.type) {
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
          const g = this.state().groups.find((g) => g.id === c.groupId);
          if (!g || g.values[c.row]?.[c.column] === undefined)
            throw Error("Этап не найден");
          g.values[c.row][c.column] = c.status;
          this.put("group", g);
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
                  (t.status === "week" ||
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
            this.state().sessions.some(
              (s) => s.state === "running" || s.state === "paused",
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
      this.db
        .prepare(
          "INSERT INTO change_log(at,action,before_json,after_json) VALUES(?,?,?,?)",
        )
        .run(new Date().toISOString(), c.type, before, this.dump());
    })();
    this.undoStack.push(before);
    if (this.undoStack.length > 30) this.undoStack.shift();
    return this.state();
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
