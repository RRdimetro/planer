import { test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Store } from "../packages/database";
import { newItem } from "../packages/core";
import { metrics } from "../packages/analytics";
import { backupArchive, restoreArchive } from "../packages/database/backup";
test("notes folders, backlinks and task relations survive backup, changes remove only backlinks", () => {
  const db = new Store(":memory:"),
    copy = new Store(":memory:");
  try {
    const a = newItem("note", "A"),
      b = newItem("note", "B"),
      task = newItem("task", "T"),
      folder = randomUUID();
    db.command({ type: "saveMany", items: [a, b, task] });
    db.command({ type: "folder", id: folder, name: "Исследования" });
    db.command({ type: "noteFolder", noteId: a.id, folderId: folder });
    db.command({ type: "link", sourceId: a.id, targetId: task.id });
    db.command({
      type: "save",
      item: {
        ...a,
        description: `[B](focus-note:${b.id}) [B duplicate](focus-note:${b.id}) [self](focus-note:${a.id})`,
      },
    });
    expect(db.state().links).toHaveLength(2);
    restoreArchive(copy, backupArchive(db), "user");
    expect(copy.state().links).toEqual(db.state().links);
    expect(copy.state().noteMembership?.[a.id]).toBe(folder);
    db.command({ type: "save", item: { ...a, description: "no link" } });
    expect(db.state().links).toEqual([
      { sourceId: a.id, targetId: task.id, relation: "related" },
    ]);
    expect(() =>
      db.command({ type: "noteFolder", noteId: task.id, folderId: folder }),
    ).toThrow();
  } finally {
    db.close();
    copy.close();
  }
});
test("breaks persist separately and never add to focus or task estimate accuracy", () => {
  const db = new Store(":memory:");
  try {
    const task = {
      ...newItem("task", "T"),
      status: "done" as const,
      estimate: 10,
    };
    db.command({ type: "save", item: task });
    db.command({
      type: "focusStart",
      taskId: task.id,
      target: 600,
      kind: "work",
    });
    db.put("session", {
      ...db.state().sessions[0],
      seconds: 600,
      state: "done",
    });
    db.command({
      type: "focusStart",
      taskId: task.id,
      target: 300,
      kind: "break",
    });
    db.put("session", {
      ...db.state().sessions[1],
      seconds: 300,
      state: "done",
    });
    expect(db.state().sessions.map((x) => x.kind)).toEqual(["work", "break"]);
    const m = metrics(db.state());
    expect(m.focusMinutes).toBe(10);
    expect(m.components[3]).toBe(1);
  } finally {
    db.close();
  }
});
