export const CALENDAR_NAME = "расписание Дима";
export const READ_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
] as const;
export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string; timeZone?: string };
  updated?: string;
  transparency?: string;
  htmlLink?: string;
}
export interface CalendarChoice { id: string; summary: string; timeZone: string; }
export interface OAuthClient { clientId: string; clientSecret?: string; }
export interface Tokens { accessToken: string; refreshToken?: string; expiresAt: number; }
export interface SecretData { client?: OAuthClient; tokens?: Tokens; }
export interface SecretVault {
  read(): SecretData;
  write(value: SecretData): void;
  clearTokens(): void;
  available(): boolean;
}
export interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  syncing: boolean;
  calendar: CalendarChoice | null;
  choices: CalendarChoice[];
  lastSuccess: string | null;
  error: string | null;
  cachedEvents: number;
  commuteBefore: number;
  commuteAfter: number;
  intervalMinutes: number;
  windowStart: string | null;
  windowEnd: string | null;
}
export type CalendarAction =
  | { action: "importClient" }
  | { action: "connect" }
  | { action: "choose"; calendarId: string }
  | { action: "sync" }
  | { action: "disconnect" }
  | { action: "settings"; commuteBefore: number; commuteAfter: number; intervalMinutes: number };
export interface DatabaseLike {
  prepare(sql: string): any;
  exec(sql: string): unknown;
  transaction(fn: () => void): () => void;
}
export const messages: Record<string, string> = {
  network: "Нет связи с Google. Сохранённое расписание доступно офлайн.",
  auth: "Требуется повторное подключение Google Calendar.",
  denied: "Google отказал в доступе к календарю. Проверьте выбранный аккаунт и разрешения.",
  quota: "Google временно ограничил запросы. Повторите синхронизацию позже.",
  server: "Google Calendar временно недоступен. Сохранённое расписание не изменено.",
  invalid: "Google вернул неподдерживаемые данные. Сохранённое расписание не изменено.",
  cancelled: "Подключение отменено.",
  missing: "Календарь «расписание Дима» не найден в этом аккаунте.",
  secure: "Защищённое хранилище Windows недоступно. Токены не будут сохранены открытым текстом.",
  changed: "Выбор календаря изменился; устаревшая синхронизация не применена.",
  client: "Нужен OAuth-клиент Google типа Desktop app. Выберите его JSON-файл.",
};
export class CalendarError extends Error {
  constructor(public code: string, public status = 0) { super(messages[code] ?? messages.network); }
}
export function calendarError(error: unknown): CalendarError {
  return error instanceof CalendarError ? error : new CalendarError("network");
}
