import { z } from "zod";
import {
  taskDetailsSchema,
  constraintSchema,
  exerciseSchema,
  programSchema,
  workoutSetSchema,
  milestoneSchema,
  type TaskDetails,
  type PlanningConstraint,
  type AttachmentInfo,
  type Exercise,
  type Program,
  type WorkoutSet,
  type Milestone,
} from "./planning";
export * from "./planning";
export const entityKinds = [
  "task",
  "project",
  "event",
  "workout",
  "note",
  "snapshot",
] as const;
export const recordSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(entityKinds),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100000).default(""),
  status: z
    .enum(["backlog", "week", "today", "active", "done"])
    .default("backlog"),
  priority: z.number().int().min(1).max(4).default(2),
  estimate: z.number().min(0).max(100000).default(30),
  weight: z.number().min(0.1).max(100).default(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  due: z.string().nullable().default(null),
  projectId: z.string().uuid().nullable().default(null),
  category: z.string().max(100).default(""),
  tags: z.string().max(500).default(""),
  duration: z.number().min(0).max(1000000).default(0),
  distance: z.number().min(0).max(100000).nullable().default(null),
  data: z.string().max(200000).default("{}"),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable().default(null),
  deletedAt: z.iso.datetime().nullable().default(null),
});
export type Item = z.infer<typeof recordSchema>;
export const stageSchema = z.enum(["done", "not_done", "unknown"]);
export type StageStatus = z.infer<typeof stageSchema>;
export interface Subject {
  id: string;
  name: string;
  rkDone: number;
  rkTotal: number;
  hwDone: number;
  hwTotal: number;
  exam: string | null;
  grade: string | null;
}
export interface StudyGroup {
  id: string;
  subjectId: string;
  name: string;
  stages: string[];
  values: StageStatus[][];
}
export interface Session {
  id: string;
  taskId: string | null;
  startedAt: string;
  seconds: number;
  state: "running" | "paused" | "done" | "interrupted";
  target: number;
  kind?: "work" | "break";
}
export interface State {
  studyBindings?: {
    subjectId: string;
    kind: "rk" | "hw";
    groupId: string;
    stageRow: number;
  }[];
  noteFolders?: { id: string; name: string }[];
  noteMembership?: Record<string, string>;
  links?: {
    sourceId: string;
    targetId: string;
    relation: "related" | "backlink";
  }[];
  eventSeries?: {
    id: string;
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    until: string | null;
  }[];
  eventOccurrences?: {
    eventId: string;
    seriesId: string;
    originalDate: string;
  }[];
  movementDays?: { day: string; count: number }[];
  revision: number;
  taskDetails: Record<string, TaskDetails>;
  attachments: AttachmentInfo[];
  constraints: PlanningConstraint[];
  exercises: Exercise[];
  programs: Program[];
  workoutSets: WorkoutSet[];
  workoutPrograms: Record<string, string | null>;
  milestones: Milestone[];
  completions: { id: string; task: Item; at: string }[];
  items: Item[];
  subjects: Subject[];
  groups: StudyGroup[];
  sessions: Session[];
  settings: Record<string, unknown>;
  diagnostics: {
    version: number;
    integrity: string;
    workspace?: "user" | "demo";
    homeConcept?: "A" | "B" | "C";
  };
}
export const subjectSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    rkDone: z.number().int().min(0),
    rkTotal: z.number().int().min(0).max(1000),
    hwDone: z.number().int().min(0),
    hwTotal: z.number().int().min(0).max(1000),
    exam: z.string().max(100).nullable(),
    grade: z.string().max(100).nullable(),
  })
  .refine(
    (s) => s.rkDone <= s.rkTotal && s.hwDone <= s.hwTotal,
    "Выполнено не может превышать всего",
  );
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("studyBinding"),
    subjectId: z.string().uuid(),
    kind: z.enum(["rk", "hw"]),
    groupId: z.string().uuid().nullable(),
    stageRow: z.number().int().min(0).max(19),
  }),
  z.object({
    type: z.literal("saveEvent"),
    item: recordSchema.refine((i) => i.kind === "event"),
    recurrence: z.object({
      frequency: z.enum(["daily", "weekly", "monthly"]),
      interval: z.number().int().min(1).max(365),
      until: z.iso.date().nullable(),
    }),
    count: z.number().int().min(2).max(104),
  }),
  z.object({ type: z.literal("studyGroup"), group: z.lazy(() => groupSchema) }),
  z.object({
    type: z.literal("studyWorkbook"),
    subjects: z.array(subjectSchema).max(500),
    groups: z.array(z.lazy(() => groupSchema)).max(500),
  }),
  z.object({
    type: z.literal("folder"),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
  }),
  z.object({
    type: z.literal("noteFolder"),
    noteId: z.string().uuid(),
    folderId: z.string().uuid().nullable(),
  }),
  z.object({
    type: z.literal("link"),
    sourceId: z.string().uuid(),
    targetId: z.string().uuid(),
    remove: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("applySchedule"),
    items: z.array(recordSchema).min(1).max(1000),
    expectedRevision: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("saveTask"),
    item: recordSchema.refine((i) => i.kind === "task"),
    details: taskDetailsSchema,
  }),
  z.object({
    type: z.literal("bulkTasks"),
    ids: z.array(z.string().uuid()).min(1).max(1000),
    patch: z.object({
      status: recordSchema.shape.status.optional(),
      priority: z.number().int().min(1).max(4).optional(),
      date: z.iso.date().nullable().optional(),
      weeklyWeek: z.iso.date().nullable().optional(),
      deleted: z.boolean().optional(),
    }),
  }),
  z.object({ type: z.literal("constraint"), value: constraintSchema }),
  z.object({ type: z.literal("removeConstraint"), id: z.string().uuid() }),
  z.object({ type: z.literal("removeAttachment"), id: z.string().uuid() }),
  z.object({ type: z.literal("exercise"), value: exerciseSchema }),
  z.object({ type: z.literal("program"), value: programSchema }),
  z.object({ type: z.literal("removeProgram"), id: z.string().uuid() }),
  z.object({
    type: z.literal("saveWorkout"),
    item: recordSchema.refine((i) => i.kind === "workout"),
    programId: z.string().uuid().nullable(),
    sets: z.array(workoutSetSchema).max(500),
  }),
  z.object({ type: z.literal("milestone"), value: milestoneSchema }),
  z.object({ type: z.literal("removeMilestone"), id: z.string().uuid() }),
  z.object({ type: z.literal("workspace"), action: z.literal("openDemo") }),
  z.object({ type: z.literal("save"), item: recordSchema }),
  z.object({
    type: z.literal("saveMany"),
    items: z.array(recordSchema).max(1000),
  }),
  z.object({ type: z.literal("remove"), id: z.string().uuid() }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("importStudy") }),
  z.object({ type: z.literal("subject"), subject: subjectSchema }),
  z.object({ type: z.literal("removeSubject"), id: z.string().uuid() }),
  z.object({
    type: z.literal("stage"),
    groupId: z.string().uuid(),
    row: z.number().int().min(0).max(20),
    column: z.number().int().min(0).max(100),
    status: stageSchema,
  }),
  z.object({
    type: z.literal("addGroup"),
    subjectId: z.string().uuid(),
    name: z.string().min(1).max(100),
    stages: z.array(z.string().min(1).max(100)).min(1).max(20),
    count: z.number().int().min(1).max(100),
  }),
  z.object({
    type: z.literal("settings"),
    key: z.enum([
      "onboarded",
      "density",
      "fontSize",
      "animations",
      "timezone",
      "pomodoro",
      "workStart",
      "workEnd",
      "dailyCapacity",
      "weights",
      "dashboard",
      "widgetSizes",
      "collapsed",
      "taskView",
      "taskFilter",
      "startPage",
      "workDays",
      "lectureWork",
      "afterWorkoutMinutes",
      "complexPriority",
      "taskAdvancedFilter",
      "taskWeek",
      "obsidianWidgets",
      "focusMode",
      "breakMinutes",
      "notifications",
      "notificationLead",
      "autoBackup",
      "backupEveryHours",
      "backupRetention",
      "lastBackupAt",
      "lastBackupPath",
      "uiScale",
    ]),
    value: z.unknown(),
  }),
  z.object({ type: z.literal("snapshot"), week: z.string() }),
  z.object({
    type: z.literal("focusStart"),
    taskId: z.string().uuid().nullable(),
    target: z.number().int().min(0).max(86400),
    kind: z.enum(["work", "break"]).optional(),
  }),
  z.object({
    type: z.literal("focusAction"),
    action: z.enum(["pause", "resume", "finish"]),
  }),
  z.object({
    type: z.literal("file"),
    action: z.enum([
      "backup",
      "restore",
      "export",
      "import",
      "exportNote",
      "openData",
      "attach",
      "exportAttachment",
      "studyExport",
      "studyImport",
      "fullscreen",
      "integrity",
    ]),
    id: z.string().uuid().optional(),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export interface API {
  history(id: string): Promise<
    {
      id: string;
      at: string;
      action: string;
      before: Item | null;
      after: Item | null;
    }[]
  >;
  readImage(id: string): Promise<string | null>;
  onCloseRequested(callback: () => Promise<void>): () => void;
  state(): Promise<State>;
  command(command: Command): Promise<State>;
}
declare global {
  interface Window {
    focusAPI: API;
  }
}
export const groupSchema = z
  .object({
    id: z.string().uuid(),
    subjectId: z.string().uuid(),
    name: z.string().min(1).max(100),
    stages: z.array(z.string().min(1).max(100)).min(1).max(20),
    values: z.array(z.array(stageSchema).min(1).max(100)).min(1).max(20),
  })
  .refine(
    (g) =>
      g.stages.length === g.values.length &&
      g.values.every((r) => r.length === g.values[0].length),
    "Неверная матрица этапов",
  );
export const sessionSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
  startedAt: z.iso.datetime(),
  seconds: z.number().min(0).max(10000000),
  state: z.enum(["running", "paused", "done", "interrupted"]),
  target: z.number().int().min(0).max(86400),
  kind: z.enum(["work", "break"]).optional(),
});
export function validateSetting(key: string, value: unknown) {
  switch (key) {
    case "obsidianWidgets":
      return z
        .object({
          order: z
            .array(z.string().max(40))
            .length(10)
            .refine((a) => new Set(a).size === 10),
          hidden: z.array(z.string().max(40)).max(9),
          widths: z
            .record(z.string(), z.number().int().min(3).max(12))
            .optional(),
          sizes: z.record(z.string(), z.number().int().min(230).max(1000)),
        })
        .parse(value);
    case "focusMode":
      return z.enum(["pomodoro", "free", "break"]).parse(value);
    case "breakMinutes":
      return z.number().int().min(1).max(60).parse(value);
    case "notificationLead":
      return z.number().int().min(0).max(120).parse(value);
    case "backupEveryHours":
      return z.number().int().min(1).max(168).parse(value);
    case "backupRetention":
      return z.number().int().min(1).max(100).parse(value);
    case "lastBackupAt":
      return z.iso.datetime().parse(value);
    case "lastBackupPath":
      return z.string().max(4096).parse(value);
    case "uiScale":
      return z.number().min(0.75).max(2).parse(value);
    case "autoBackup":
    case "notifications":
      return z.boolean().parse(value);
    case "workDays":
      return z
        .array(z.number().int().min(1).max(7))
        .min(1)
        .max(7)
        .refine((a) => new Set(a).size === a.length)
        .parse(value);
    case "lectureWork":
      return z.boolean().parse(value);
    case "afterWorkoutMinutes":
      return z.number().int().min(0).max(360).parse(value);
    case "complexPriority":
      return z.number().int().min(1).max(4).parse(value);
    case "taskAdvancedFilter":
      return z
        .object({
          query: z.string().max(300),
          category: z.string().max(100),
          status: z.string().max(50),
          priority: z.number().int().min(0).max(4),
          from: z.string().max(10),
          to: z.string().max(10),
          due: z.string().max(10),
        })
        .parse(value);
    case "onboarded":
    case "collapsed":
    case "animations":
      return z.boolean().parse(value);
    case "density":
      return z.enum(["normal", "compact"]).parse(value);
    case "fontSize":
      return z.number().min(12).max(20).parse(value);
    case "pomodoro":
      return z.number().min(1).max(180).parse(value);
    case "workStart":
      return z.number().min(0).max(23).parse(value);
    case "workEnd":
      return z.number().min(1).max(24).parse(value);
    case "dailyCapacity":
      return z.number().min(15).max(1080).parse(value);
    case "startPage":
      return z.number().int().min(0).max(9).parse(value);
    case "taskWeek":
      return z.iso.date().parse(value);
    case "taskView":
      return z.enum(["kanban", "table", "list", "week"]).parse(value);
    case "taskFilter":
      return z.union([z.literal(""), z.string().uuid()]).parse(value);
    case "weights":
      return z.array(z.number().min(0).max(100)).length(5).parse(value);
    case "widgetSizes":
      return z
        .record(z.string(), z.number().int().min(230).max(1000))
        .parse(value);
    case "dashboard":
      return z
        .array(
          z.enum([
            "Сегодня",
            "Расписание",
            "Активные проекты",
            "Учебный прогресс",
          ]),
        )
        .length(4)
        .refine((a) => new Set(a).size === 4)
        .parse(value);
    case "timezone": {
      const v = z.string().max(100).parse(value);
      new Intl.DateTimeFormat("ru-RU", { timeZone: v });
      return v;
    }
    default:
      throw Error("Неизвестная настройка");
  }
}
