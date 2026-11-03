import type Database from "better-sqlite3";
import {
  recordSchema,
  subjectSchema,
  groupSchema,
  sessionSchema,
  type Item,
  type Subject,
  type StudyGroup,
  type Session,
} from "../contracts";
type Row = Record<string, any>;
export class NormalizedRepository {
  constructor(readonly db: Database.Database) {}
  upsert(table: string, row: Row) {
    const columns = Object.keys(row);
    this.db
      .prepare(
        `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")}) ON CONFLICT(${columns[0]}) DO UPDATE SET ${columns
          .slice(1)
          .map((c) => `${c}=excluded.${c}`)
          .join(",")}`,
      )
      .run(...columns.map((k) => row[k]));
  }
  put(kind: string, value: any) {
    switch (kind) {
      case "project":
      case "task":
      case "event":
      case "note":
      case "workout": {
        const i = recordSchema.parse(value);
        if (kind !== i.kind) throw Error("Тип сущности не совпадает");
        const existing = this.db
          .prepare("SELECT kind FROM entities WHERE id=?")
          .get(i.id) as Row | undefined;
        if (existing && existing.kind !== kind)
          throw Error("Нельзя менять тип сущности");
        this.upsert("entities", {
          id: i.id,
          kind,
          title: i.title,
          description: i.description,
          status: i.status,
          priority: i.priority,
          estimate: i.estimate,
          weight: i.weight,
          planned_date: i.date,
          planned_time: i.time,
          due: i.due,
          category: i.category,
          tags: i.tags,
          metadata: JSON.stringify({
            data: i.data,
            duration: i.duration,
            distance: i.distance,
          }),
          created_at: i.createdAt,
          completed_at: i.completedAt,
          deleted_at: i.deletedAt,
        });
        const link = i.projectId;
        if (kind === "project")
          this.upsert("projects", { id: i.id, linked_project_id: link });
        if (kind === "task") {
          this.db
            .prepare(
              "INSERT INTO tasks(id,project_id) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id",
            )
            .run(i.id, link);
        }
        if (kind === "event")
          this.upsert("calendar_events", {
            id: i.id,
            project_id: link,
            event_type: i.category || "personal",
          });
        if (kind === "note")
          this.upsert("notes", { id: i.id, project_id: link });
        if (kind === "workout")
          this.db
            .prepare(
              "INSERT INTO workouts(id,project_id,duration,distance) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,duration=excluded.duration,distance=excluded.distance",
            )
            .run(i.id, link, i.duration, i.distance);
        break;
      }
      case "subject": {
        const s = subjectSchema.parse(value);
        this.upsert("study_subjects", {
          id: s.id,
          name: s.name,
          exam: s.exam,
          grade: s.grade,
        });
        for (const [kind, completed, total] of [
          ["rk", s.rkDone, s.rkTotal],
          ["hw", s.hwDone, s.hwTotal],
        ])
          this.db
            .prepare(
              "INSERT INTO study_aggregate_counts VALUES(?,?,?,?) ON CONFLICT(subject_id,kind) DO UPDATE SET total=excluded.total,completed=excluded.completed",
            )
            .run(s.id, kind, total, completed);
        break;
      }
      case "group": {
        const g = groupSchema.parse(value);
        this.upsert("study_work_groups", {
          id: g.id,
          subject_id: g.subjectId,
          name: g.name,
        });
        g.stages.forEach((name, r) => {
          const id = `${g.id}:stage:${r}`;
          this.upsert("study_stage_definitions", {
            id,
            group_id: g.id,
            name,
            position: r,
          });
        });
        g.values[0].forEach((_, c) =>
          this.upsert("study_works", {
            id: `${g.id}:work:${c}`,
            group_id: g.id,
            number: c + 1,
          }),
        );
        g.values.forEach((row, r) =>
          row.forEach((status, c) =>
            this.db
              .prepare(
                "INSERT INTO study_stage_status VALUES(?,?,?,?,?) ON CONFLICT(work_id,stage_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at WHERE study_stage_status.status<>excluded.status",
              )
              .run(
                g.id,
                `${g.id}:work:${c}`,
                `${g.id}:stage:${r}`,
                status,
                new Date().toISOString(),
              ),
          ),
        );
        break;
      }
      case "session": {
        const s = sessionSchema.parse(value);
        this.upsert("focus_sessions", {
          id: s.id,
          task_id: s.taskId,
          started_at: s.startedAt,
          seconds: s.seconds,
          state: s.state,
          target: s.target,
        });
        if (s.kind)
          this.upsert("session_kinds", { session_id: s.id, kind: s.kind });
        break;
      }
      case "snapshot": {
        const items = JSON.parse(value.data) as Item[];
        this.upsert("weekly_snapshots", {
          id: value.id,
          week: value.date,
          title: value.title,
          created_at: value.createdAt ?? new Date().toISOString(),
          metadata: JSON.stringify(
            Object.fromEntries(
              Object.entries(value).filter(([k]) => k !== "data"),
            ),
          ),
        });
        this.db
          .prepare("DELETE FROM weekly_snapshot_items WHERE snapshot_id=?")
          .run(value.id);
        for (const i of items)
          this.db
            .prepare("INSERT INTO weekly_snapshot_items VALUES(?,?,?,?,?,?,?)")
            .run(
              value.id,
              i.id,
              i.weight,
              i.estimate,
              i.due,
              i.title,
              JSON.stringify(i),
            );
        break;
      }
      case "completion": {
        const i = recordSchema.parse(value.task);
        this.upsert("completion_facts", {
          id: value.id,
          task_id: i.id,
          at: value.at,
          title: i.title,
          estimate: i.estimate,
          weight: i.weight,
          due: i.due,
          details: JSON.stringify(i),
        });
        break;
      }
      default:
        throw Error("Неизвестный тип записи: " + kind);
    }
  }
  list<T>(kind: string, id?: string): T[] {
    let rows: any[] = [];
    switch (kind) {
      case "project":
      case "task":
      case "event":
      case "note":
      case "workout": {
        const table = {
          project: "projects",
          task: "tasks",
          event: "calendar_events",
          note: "notes",
          workout: "workouts",
        }[kind];
        rows = (
          this.db
            .prepare(
              `SELECT e.*,s.${kind === "project" ? "linked_project_id" : "project_id"} AS project_id${kind === "workout" ? ",s.duration,s.distance" : ""} FROM entities e JOIN ${table} s ON s.id=e.id WHERE e.kind=? ${id ? "AND e.id=?" : ""} ORDER BY e.rowid`,
            )
            .all(...(id ? [kind, id] : [kind])) as Row[]
        ).map((r) => ({
          id: r.id,
          kind: r.kind,
          title: r.title,
          description: r.description,
          status: r.status,
          priority: r.priority,
          estimate: r.estimate,
          weight: r.weight,
          date: r.planned_date,
          time: r.planned_time,
          due: r.due,
          projectId: r.project_id,
          category: r.category,
          tags: r.tags,
          duration: r.duration ?? JSON.parse(r.metadata).duration ?? 0,
          distance: r.distance ?? JSON.parse(r.metadata).distance ?? null,
          data: JSON.parse(r.metadata).data ?? "{}",
          createdAt: r.created_at,
          completedAt: r.completed_at,
          deletedAt: r.deleted_at,
        }));
        break;
      }
      case "subject":
        rows = (
          this.db
            .prepare(
              `SELECT s.*,r.completed rkDone,r.total rkTotal,h.completed hwDone,h.total hwTotal FROM study_subjects s JOIN study_aggregate_counts r ON r.subject_id=s.id AND r.kind='rk' JOIN study_aggregate_counts h ON h.subject_id=s.id AND h.kind='hw' ORDER BY s.rowid`,
            )
            .all() as Row[]
        ).map((r) => ({
          id: r.id,
          name: r.name,
          exam: r.exam,
          grade: r.grade,
          rkDone: r.rkDone,
          rkTotal: r.rkTotal,
          hwDone: r.hwDone,
          hwTotal: r.hwTotal,
        }));
        break;
      case "group":
        rows = (
          this.db
            .prepare("SELECT * FROM study_work_groups ORDER BY rowid")
            .all() as Row[]
        ).map((r) => {
          const stages = this.db
            .prepare(
              "SELECT * FROM study_stage_definitions WHERE group_id=? ORDER BY position",
            )
            .all(r.id) as Row[];
          const works = this.db
            .prepare(
              "SELECT * FROM study_works WHERE group_id=? ORDER BY number",
            )
            .all(r.id) as Row[];
          const statuses = this.db
            .prepare("SELECT * FROM study_stage_status WHERE group_id=?")
            .all(r.id) as Row[];
          const map = new Map(
            statuses.map((s) => [s.work_id + ":" + s.stage_id, s.status]),
          );
          return {
            id: r.id,
            subjectId: r.subject_id,
            name: r.name,
            stages: stages.map((s) => s.name),
            values: stages.map((s) =>
              works.map((w) => map.get(w.id + ":" + s.id) ?? "unknown"),
            ),
          };
        });
        break;
      case "session":
        rows = (
          this.db
            .prepare(
              `SELECT f.*, ${this.db.prepare("SELECT name FROM sqlite_master WHERE name='session_kinds'").get() ? "(SELECT kind FROM session_kinds WHERE session_id=f.id)" : "NULL"} AS session_kind FROM focus_sessions f ORDER BY f.rowid`,
            )
            .all() as Row[]
        ).map((r) => ({
          id: r.id,
          taskId: r.task_id,
          startedAt: r.started_at,
          seconds: r.seconds,
          state: r.state,
          target: r.target,
          ...(r.session_kind ? { kind: r.session_kind } : {}),
        }));
        break;
      case "snapshot":
        rows = (
          this.db
            .prepare("SELECT * FROM weekly_snapshots ORDER BY rowid")
            .all() as Row[]
        ).map((r) => ({
          ...JSON.parse(r.metadata),
          id: r.id,
          kind: "snapshot",
          title: r.title,
          date: r.week,
          data: JSON.stringify(
            (
              this.db
                .prepare(
                  "SELECT details FROM weekly_snapshot_items WHERE snapshot_id=? ORDER BY rowid",
                )
                .all(r.id) as Row[]
            ).map((i) => JSON.parse(i.details)),
          ),
        }));
        break;
      case "completion":
        rows = (
          this.db
            .prepare("SELECT * FROM completion_facts ORDER BY rowid")
            .all() as Row[]
        ).map((r) => ({ id: r.id, at: r.at, task: JSON.parse(r.details) }));
        break;
    }
    return rows as T[];
  }
  records() {
    return [
      "project",
      "task",
      "event",
      "workout",
      "note",
      "snapshot",
      "subject",
      "group",
      "session",
      "completion",
    ].flatMap((kind) =>
      this.list<{ id: string }>(kind).map((item) => ({
        id: item.id,
        kind,
        payload: JSON.stringify(item),
      })),
    );
  }
  load(records: { kind: string; payload: string }[]) {
    for (const kind of [
      "project",
      "task",
      "event",
      "workout",
      "note",
      "subject",
      "group",
      "session",
      "snapshot",
      "completion",
    ])
      for (const r of records.filter((r) => r.kind === kind))
        this.put(kind, JSON.parse(r.payload));
  }
}
export type { Subject, StudyGroup, Session };
