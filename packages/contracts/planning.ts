import { z } from "zod";
export const recurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(365),
  until: z.iso.date().nullable(),
});
export const checklistSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  done: z.boolean(),
});
export const taskDetailsSchema = z.object({
  parentId: z.string().uuid().nullable(),
  weeklyWeek: z.iso.date().nullable(),
  dependencies: z.array(z.string().uuid()).max(200),
  checklist: z.array(checklistSchema).max(200),
  recurrence: recurrenceSchema.nullable(),
});
export type TaskDetails = z.infer<typeof taskDetailsSchema>;
export const emptyTaskDetails = (): TaskDetails => ({
  parentId: null,
  weeklyWeek: null,
  dependencies: [],
  checklist: [],
  recurrence: null,
});
export const constraintSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().min(1).max(200),
    date: z.iso.date().nullable(),
    weekday: z.number().int().min(1).max(7).nullable(),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
    kind: z.enum(["blocked", "no_complex"]),
  })
  .refine((v) => v.end > v.start && (v.date !== null || v.weekday !== null));
export type PlanningConstraint = z.infer<typeof constraintSchema>;
export interface AttachmentInfo {
  id: string;
  entityId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  sha256: string;
}
export const exerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  muscleGroup: z.string().max(100),
});
export type Exercise = z.infer<typeof exerciseSchema>;
export const programExerciseSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(30),
  reps: z.number().int().min(1).max(200),
  weight: z.number().min(0).max(2000),
});
export const programSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  exercises: z.array(programExerciseSchema).max(100),
});
export type Program = z.infer<typeof programSchema>;
export const workoutSetSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  reps: z.number().int().min(0).max(1000),
  weight: z.number().min(0).max(2000),
  done: z.boolean(),
});
export type WorkoutSet = z.infer<typeof workoutSetSchema> & {
  workoutId: string;
};
export const milestoneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  due: z.iso.date().nullable(),
  done: z.boolean(),
});
export type Milestone = z.infer<typeof milestoneSchema>;
