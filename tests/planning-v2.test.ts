import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { newItem, nextOccurrenceDate } from "../packages/core";
import { emptyTaskDetails } from "../packages/contracts";
import { backupArchive, restoreArchive } from "../packages/database/backup";
test("subtasks/checklist/dependencies persist; cycles and premature completion roll back atomically", () => {
  const db = new Store(":memory:");
  const parent = newItem("task", "Parent");
  const child = newItem("task", "Child");
  const before = newItem("task", "Dependency");
  db.command({ type: "saveMany", items: [parent, child, before] });
  const d = {
    ...emptyTaskDetails(),
    parentId: parent.id,
    dependencies: [before.id],
    checklist: [{ id: crypto.randomUUID(), title: "Check", done: false }],
  };
  db.command({ type: "saveTask", item: child, details: d });
  expect(db.state().taskDetails[child.id]).toEqual(d);
  expect(() =>
    db.command({
      type: "saveTask",
      item: parent,
      details: { ...emptyTaskDetails(), parentId: child.id },
    }),
  ).toThrow();
  expect(() =>
    db.command({
      type: "saveTask",
      item: before,
      details: { ...emptyTaskDetails(), dependencies: [child.id] },
    }),
  ).toThrow();
  const snapshot = db.dump();
  expect(() =>
    db.command({ type: "save", item: { ...child, status: "done" } }),
  ).toThrow();
  expect(db.dump()).toBe(snapshot);
  db.command({
    type: "bulkTasks",
    ids: [before.id, child.id],
    patch: { status: "done" },
  });
  expect(db.state().items.filter((t) => t.status === "done")).toHaveLength(2);
  db.command({ type: "undo" });
  expect(db.state().items.filter((t) => t.status === "done")).toHaveLength(0);
  db.close();
});
test("recurrence creates separate occurrence once, retains original history, obeys until and month boundaries", () => {
  const db = new Store(":memory:");
  const task = { ...newItem("task", "Repeat"), date: "2026-01-31" };
  const d = {
    ...emptyTaskDetails(),
    recurrence: {
      frequency: "monthly" as const,
      interval: 1,
      until: "2026-03-01",
    },
  };
  db.command({ type: "saveTask", item: task, details: d });
  db.command({ type: "save", item: { ...task, status: "done" } });
  const next = db.state().items.find((i) => i.id !== task.id)!;
  expect(next.id).not.toBe(task.id);
  expect(next.date).toBe("2026-02-28");
  expect(db.state().completions).toHaveLength(1);
  db.command({ type: "save", item: { ...task, status: "done" } });
  expect(db.state().items).toHaveLength(2);
  db.command({ type: "save", item: { ...next, status: "done" } });
  expect(db.state().items).toHaveLength(2);
  expect(
    nextOccurrenceDate("2026-12-31", {
      frequency: "daily",
      interval: 1,
      until: null,
    }),
  ).toBe("2027-01-01");
  db.close();
});
test("attachments and relational extras survive ZIP/undo, blobs are validated", () => {
  const db = new Store(":memory:");
  const task = newItem("task", "Attachment");
  db.command({
    type: "saveTask",
    item: task,
    details: { ...emptyTaskDetails(), weeklyWeek: "2026-11-02" },
  });
  const id = db.relations.attach(
    task.id,
    "document.txt",
    "text/plain",
    Buffer.from("Existing document"),
  );
  const original = db.state();
  const zip = backupArchive(db);
  db.command({ type: "removeAttachment", id });
  expect(db.state().attachments).toHaveLength(0);
  db.command({ type: "undo" });
  expect(db.state().attachments).toEqual(original.attachments);
  db.command({ type: "bulkTasks", ids: [task.id], patch: { deleted: true } });
  restoreArchive(db, zip);
  expect(db.state()).toEqual(original);
  expect(
    db.db.prepare("SELECT content FROM attachments WHERE id=?").get(id),
  ).toEqual({ content: Buffer.from("Existing document") });
  db.close();
});
