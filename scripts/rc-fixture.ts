import { Store } from "../packages/database";
import { newItem, addDays, dateInZone } from "../packages/core";
import { randomUUID } from "node:crypto";
import path from "node:path";
const directory = process.argv[2];
if (!directory) throw Error("Temporary fixture directory required");
const db = new Store(path.join(directory, "focus.db")),
  today = dateInZone("Europe/Moscow");
db.setting("onboarded", true);
db.setting("autoBackup", false);
db.setting("timezone", "Europe/Moscow");
db.setting("taskView", "table");
db.setting("animations", false);
db.command({ type: "importStudy" });
db.db.transaction(() => {
  const project = newItem("project", "Нагрузочный проект");
  db.put("project", project);
  for (let i = 0; i < 1000; i++)
    db.put("task", {
      ...newItem("task", `Нагрузочная задача ${String(i).padStart(4, "0")}`),
      projectId: project.id,
      status: "week",
      date: addDays(today, i % 7),
      time:
        i < 140
          ? `${String(8 + Math.floor(i / 14)).padStart(2, "0")}:00`
          : null,
    });
  for (let i = 0; i < 3000; i++) {
    const date = addDays(today, -(i % 90)),
      at = date + "T09:00:00.000Z";
    const t = {
      ...newItem("task", "Историческая задача " + i),
      status: "done" as const,
      date,
      due: date,
      completedAt: at,
      createdAt: at,
      deletedAt: at,
      projectId: project.id,
    };
    db.put("task", t);
    db.put("completion", { id: randomUUID(), task: t, at });
    db.put("session", {
      id: randomUUID(),
      taskId: t.id,
      startedAt: at,
      state: "done",
      seconds: 1200,
      target: 1500,
      kind: i % 10 === 0 ? "break" : "work",
    });
  }
})();
if ((db.db.pragma("foreign_key_check") as unknown[]).length)
  throw Error("Fixture FK violation");
db.close();
