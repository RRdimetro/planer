import type Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  emptyTaskDetails,
  taskDetailsSchema,
  programSchema,
  exerciseSchema,
  workoutSetSchema,
  constraintSchema,
  milestoneSchema,
  type TaskDetails,
  type AttachmentInfo,
  type State,
  type Program,
  type WorkoutSet,
} from "../contracts";
type Row = Record<string, any>;
export class Relations {
  constructor(readonly db: Database.Database) {}
  taskDetails(): Record<string, TaskDetails> {
    const result: Record<string, TaskDetails> = {};
    for (const t of this.db
      .prepare("SELECT * FROM tasks ORDER BY rowid")
      .all() as Row[]) {
      const rule = this.db
        .prepare("SELECT * FROM recurrence_rules WHERE task_id=?")
        .get(t.id) as Row | undefined;
      result[t.id] = {
        parentId: t.parent_id,
        weeklyWeek: t.weekly_week,
        recurrence: rule
          ? {
              frequency: rule.frequency,
              interval: rule.interval,
              until: rule.until_date,
            }
          : null,
        dependencies: (
          this.db
            .prepare(
              "SELECT depends_on_id FROM task_dependencies WHERE task_id=? ORDER BY rowid",
            )
            .all(t.id) as Row[]
        ).map((d) => d.depends_on_id),
        checklist: (
          this.db
            .prepare(
              "SELECT * FROM task_checklist WHERE task_id=? ORDER BY position",
            )
            .all(t.id) as Row[]
        ).map((c) => ({ id: c.id, title: c.title, done: !!c.done })),
      };
    }
    return result;
  }
  saveTask(id: string, input: TaskDetails) {
    const d = taskDetailsSchema.parse(input);
    this.db
      .prepare("UPDATE tasks SET parent_id=?,weekly_week=? WHERE id=?")
      .run(d.parentId, d.weeklyWeek, id);
    this.db.prepare("DELETE FROM task_checklist WHERE task_id=?").run(id);
    d.checklist.forEach((c, i) =>
      this.db
        .prepare("INSERT INTO task_checklist VALUES(?,?,?,?,?)")
        .run(c.id, id, c.title, Number(c.done), i),
    );
    this.db.prepare("DELETE FROM task_dependencies WHERE task_id=?").run(id);
    for (const dep of [...new Set(d.dependencies)])
      this.db.prepare("INSERT INTO task_dependencies VALUES(?,?)").run(id, dep);
    this.db.prepare("DELETE FROM recurrence_rules WHERE task_id=?").run(id);
    if (d.recurrence)
      this.db
        .prepare("INSERT INTO recurrence_rules VALUES(?,?,?,?)")
        .run(
          id,
          d.recurrence.frequency,
          d.recurrence.interval,
          d.recurrence.until,
        );
  }
  attachments(): AttachmentInfo[] {
    return (
      this.db
        .prepare(
          "SELECT a.id,a.entity_id,a.name,a.mime_type,a.size,a.created_at,d.sha256 FROM attachments a JOIN attachment_digests d ON d.id=a.id ORDER BY a.rowid",
        )
        .all() as Row[]
    ).map((r) => ({
      id: r.id,
      entityId: r.entity_id,
      name: r.name,
      mimeType: r.mime_type,
      size: r.size,
      createdAt: r.created_at,
      sha256: r.sha256,
    }));
  }
  attach(entityId: string, name: string, mimeType: string, content: Buffer) {
    if (
      !this.db
        .prepare("SELECT id FROM entities WHERE id=? AND deleted_at IS NULL")
        .get(entityId)
    )
      throw Error("Сначала сохраните сущность");
    if (content.length > 25 * 1024 * 1024)
      throw Error("Максимальный размер вложения — 25 МБ");
    const id = randomUUID();
    const hash = createHash("sha256").update(content).digest("hex");
    this.db.transaction(() => {
      this.db
        .prepare("INSERT OR IGNORE INTO attachment_blobs VALUES(?,?)")
        .run(hash, content);
      this.db
        .prepare("INSERT INTO attachments VALUES(?,?,?,?,?,?,?)")
        .run(
          id,
          entityId,
          name,
          mimeType,
          content.length,
          content,
          new Date().toISOString(),
        );
      this.db
        .prepare("INSERT INTO attachment_digests VALUES(?,?)")
        .run(id, hash);
    })();
    return id;
  }
  state(): Pick<
    State,
    | "taskDetails"
    | "attachments"
    | "constraints"
    | "exercises"
    | "programs"
    | "workoutSets"
    | "workoutPrograms"
    | "milestones"
  > {
    return {
      taskDetails: this.taskDetails(),
      attachments: this.attachments(),
      constraints: (
        this.db
          .prepare("SELECT * FROM planning_constraints ORDER BY rowid")
          .all() as Row[]
      ).map((r) => ({
        id: r.id,
        label: r.label,
        date: r.date,
        weekday: r.weekday,
        start: r.start_min,
        end: r.end_min,
        kind: r.kind,
      })),
      exercises: (
        this.db.prepare("SELECT * FROM exercises ORDER BY rowid").all() as Row[]
      ).map((r) => ({ id: r.id, name: r.name, muscleGroup: r.muscle_group })),
      programs: (
        this.db
          .prepare("SELECT * FROM workout_programs ORDER BY rowid")
          .all() as Row[]
      ).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        exercises: (
          this.db
            .prepare(
              "SELECT * FROM program_exercises WHERE program_id=? ORDER BY position",
            )
            .all(r.id) as Row[]
        ).map((x) => ({
          id: x.id,
          exerciseId: x.exercise_id,
          sets: x.target_sets,
          reps: x.target_reps,
          weight: x.target_weight,
        })),
      })),
      workoutSets: (
        this.db
          .prepare("SELECT * FROM workout_sets ORDER BY rowid")
          .all() as Row[]
      ).map((r) => ({
        id: r.id,
        workoutId: r.workout_id,
        exerciseId: r.exercise_id,
        reps: r.reps,
        weight: r.weight,
        done: !!r.done,
      })),
      workoutPrograms: Object.fromEntries(
        (
          this.db.prepare("SELECT id,program_id FROM workouts").all() as Row[]
        ).map((r) => [r.id, r.program_id]),
      ),
      milestones: (
        this.db
          .prepare("SELECT * FROM project_milestones ORDER BY rowid")
          .all() as Row[]
      ).map((r) => ({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        due: r.due,
        done: !!r.done,
      })),
    };
  }
  program(p: Program) {
    programSchema.parse(p);
    this.db
      .prepare(
        "INSERT INTO workout_programs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description",
      )
      .run(p.id, p.name, p.description);
    this.db
      .prepare("DELETE FROM program_exercises WHERE program_id=?")
      .run(p.id);
    p.exercises.forEach((x, i) =>
      this.db
        .prepare("INSERT INTO program_exercises VALUES(?,?,?,?,?,?,?)")
        .run(x.id, p.id, x.exerciseId, x.sets, x.reps, x.weight, i),
    );
  }
  sets(
    workoutId: string,
    programId: string | null,
    sets: Omit<WorkoutSet, "workoutId">[],
  ) {
    this.db
      .prepare("UPDATE workouts SET program_id=? WHERE id=?")
      .run(programId, workoutId);
    this.db
      .prepare("DELETE FROM workout_sets WHERE workout_id=?")
      .run(workoutId);
    const positions = new Map<string, number>();
    for (const input of sets) {
      const s = workoutSetSchema.parse(input);
      const index = positions.get(s.exerciseId) ?? 0;
      positions.set(s.exerciseId, index + 1);
      this.db
        .prepare("INSERT INTO workout_sets VALUES(?,?,?,?,?,?,?)")
        .run(
          s.id,
          workoutId,
          s.exerciseId,
          index,
          s.reps,
          s.weight,
          Number(s.done),
        );
    }
  }
  dump(includeBlobs = false) {
    const state = this.state();
    return {
      ...state,
      entityChanges: this.db
        .prepare("SELECT * FROM entity_changes ORDER BY rowid")
        .all(),
      blobs: includeBlobs
        ? (
            this.db
              .prepare("SELECT * FROM attachment_blobs ORDER BY sha256")
              .all() as Row[]
          ).map((r) => ({
            sha256: r.sha256,
            content: r.content.toString("base64"),
          }))
        : [],
    };
  }
  load(raw: any) {
    if (!raw) return;
    for (const b of raw.blobs ?? []) {
      const content = Buffer.from(b.content, "base64");
      if (
        content.length > 25 * 1024 * 1024 ||
        createHash("sha256").update(content).digest("hex") !== b.sha256
      )
        throw Error("Повреждено вложение");
      this.db
        .prepare("INSERT OR IGNORE INTO attachment_blobs VALUES(?,?)")
        .run(b.sha256, content);
    }
    for (const x of raw.exercises ?? []) {
      const e = exerciseSchema.parse(x);
      this.db
        .prepare(
          "INSERT INTO exercises VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,muscle_group=excluded.muscle_group",
        )
        .run(e.id, e.name, e.muscleGroup);
    }
    for (const p of raw.programs ?? []) this.program(programSchema.parse(p));
    for (const [id, d] of Object.entries(raw.taskDetails ?? {}))
      this.saveTask(id, taskDetailsSchema.parse(d));
    for (const w of this.db.prepare("SELECT id FROM workouts").all() as Row[])
      this.sets(
        w.id,
        raw.workoutPrograms?.[w.id] ?? null,
        (raw.workoutSets ?? []).filter((s: WorkoutSet) => s.workoutId === w.id),
      );
    for (const value of raw.constraints ?? []) {
      const c = constraintSchema.parse(value);
      this.db
        .prepare("INSERT INTO planning_constraints VALUES(?,?,?,?,?,?,?)")
        .run(c.id, c.label, c.date, c.weekday, c.start, c.end, c.kind);
    }
    for (const value of raw.milestones ?? []) {
      const m = milestoneSchema.parse(value);
      this.db
        .prepare("INSERT INTO project_milestones VALUES(?,?,?,?,?)")
        .run(m.id, m.projectId, m.title, m.due, Number(m.done));
    }
    for (const a of raw.attachments ?? []) {
      const blob = this.db
        .prepare("SELECT content FROM attachment_blobs WHERE sha256=?")
        .get(a.sha256) as Row | undefined;
      if (!blob) throw Error("Отсутствуют байты вложения");
      if (blob.content.length !== a.size)
        throw Error("Размер вложения не совпадает");
      this.db
        .prepare("INSERT INTO attachments VALUES(?,?,?,?,?,?,?)")
        .run(
          a.id,
          a.entityId,
          a.name,
          a.mimeType,
          a.size,
          blob.content,
          a.createdAt,
        );
      this.db
        .prepare("INSERT INTO attachment_digests VALUES(?,?)")
        .run(a.id, a.sha256);
    }
    for (const e of raw.entityChanges ?? []) {
      if (
        typeof e.id !== "string" ||
        typeof e.entity_id !== "string" ||
        typeof e.at !== "string" ||
        typeof e.action !== "string"
      )
        throw Error("Повреждён журнал");
      this.db
        .prepare("INSERT INTO entity_changes VALUES(?,?,?,?,?,?)")
        .run(e.id, e.entity_id, e.at, e.action, e.before_json, e.after_json);
    }
  }
}
export { emptyTaskDetails };
