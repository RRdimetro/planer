import {z} from 'zod';
export const entityKinds=['task','project','event','workout','note','snapshot'] as const;
export const recordSchema=z.object({id:z.string().uuid(),kind:z.enum(entityKinds),title:z.string().min(1).max(300),description:z.string().max(100000).default(''),status:z.enum(['backlog','week','today','active','done']).default('backlog'),priority:z.number().int().min(1).max(4).default(2),estimate:z.number().min(0).max(100000).default(30),weight:z.number().min(0.1).max(100).default(1),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),time:z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),due:z.string().nullable().default(null),projectId:z.string().uuid().nullable().default(null),category:z.string().max(100).default(''),tags:z.string().max(500).default(''),duration:z.number().min(0).max(1000000).default(0),distance:z.number().min(0).max(100000).nullable().default(null),data:z.string().max(200000).default('{}'),createdAt:z.string(),completedAt:z.string().nullable().default(null),deletedAt:z.string().nullable().default(null)});
export type Item=z.infer<typeof recordSchema>;
export const stageSchema=z.enum(['done','not_done','unknown']);
export type StageStatus=z.infer<typeof stageSchema>;
export interface Subject {id:string;name:string;rkDone:number;rkTotal:number;hwDone:number;hwTotal:number;exam:string|null;grade:string|null}
export interface StudyGroup {id:string;subjectId:string;name:string;stages:string[];values:StageStatus[][]}
export interface Session {id:string;taskId:string|null;startedAt:string;seconds:number;state:'running'|'paused'|'done'|'interrupted';target:number}
export interface State {completions:{id:string;task:Item;at:string}[];items:Item[];subjects:Subject[];groups:StudyGroup[];sessions:Session[];settings:Record<string,unknown>;diagnostics:{version:number;integrity:string}}
export const subjectSchema=z.object({id:z.string().uuid(),name:z.string().min(1).max(100),rkDone:z.number().int().min(0),rkTotal:z.number().int().min(0).max(1000),hwDone:z.number().int().min(0),hwTotal:z.number().int().min(0).max(1000),exam:z.string().max(100).nullable(),grade:z.string().max(100).nullable()}).refine(s=>s.rkDone<=s.rkTotal&&s.hwDone<=s.hwTotal,'Выполнено не может превышать всего');
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('save'),item:recordSchema}),z.object({type:z.literal('remove'),id:z.string().uuid()}),z.object({type:z.literal('undo')}),
 z.object({type:z.literal('importStudy')}),z.object({type:z.literal('subject'),subject:subjectSchema}),z.object({type:z.literal('removeSubject'),id:z.string().uuid()}),
 z.object({type:z.literal('stage'),groupId:z.string().uuid(),row:z.number().int().min(0).max(20),column:z.number().int().min(0).max(100),status:stageSchema}),
 z.object({type:z.literal('addGroup'),subjectId:z.string().uuid(),name:z.string().min(1).max(100),stages:z.array(z.string().min(1).max(100)).min(1).max(20),count:z.number().int().min(1).max(100)}),
 z.object({type:z.literal('settings'),key:z.enum(['onboarded','density','fontSize','animations','timezone','pomodoro','workStart','workEnd','dailyCapacity','weights','dashboard','collapsed','taskView','taskFilter','startPage']),value:z.unknown()}),
 z.object({type:z.literal('snapshot'),week:z.string()}),
 z.object({type:z.literal('focusStart'),taskId:z.string().uuid().nullable(),target:z.number().int().min(0).max(86400)}),
 z.object({type:z.literal('focusAction'),action:z.enum(['pause','resume','finish'])}),
 z.object({type:z.literal('file'),action:z.enum(['backup','restore','export','import','exportNote','openData']),id:z.string().uuid().optional()})
]);
export type Command=z.infer<typeof commandSchema>;
export interface API {state():Promise<State>;command(command:Command):Promise<State>}
declare global {interface Window {focusAPI:API}}
