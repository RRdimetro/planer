import type { Item } from "../contracts";
import { dateInZone, minutes } from ".";
export function dueReminders(
  items: Item[],
  zone: string,
  lead: number,
  now = new Date(),
) {
  const today = dateInZone(zone, now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const current =
    Number(parts.find((p) => p.type === "hour")?.value) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value);
  const notices: { key: string; title: string; body: string }[] = [];
  const add = (i: Item, date: string, time: string, kind: string) => {
    const delta =
      Math.round((Date.parse(date) - Date.parse(today)) / 86400000) * 1440 +
      minutes(time) -
      current;
    if (delta >= -2 && delta <= lead)
      notices.push({
        key: `${i.id}/${kind}/${date}/${time}`,
        title:
          kind === "deadline"
            ? "Срок задачи"
            : i.kind === "workout"
              ? "Начало тренировки"
              : "Запланированная задача",
        body: `${i.title} · ${date} ${time}`,
      });
  };
  for (const i of items) {
    if (i.deletedAt || i.status === "done") continue;
    if (["task", "workout"].includes(i.kind) && i.date && i.time)
      add(i, i.date, i.time, "start");
    if (i.kind === "task" && i.due)
      add(
        i,
        i.due.slice(0, 10),
        /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(i.due)
          ? i.due.slice(11, 16)
          : "18:00",
        "deadline",
      );
  }
  return notices;
}
