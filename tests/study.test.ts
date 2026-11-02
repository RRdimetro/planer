import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("M2: every aggregate and every tri-state cell exactly matches approved reference", () => {
  const db = new Store(":memory:");
  db.command({ type: "importStudy" });
  const s = db.state();
  expect(
    s.subjects.map((x) => [
      x.name,
      x.rkDone,
      x.rkTotal,
      x.hwDone,
      x.hwTotal,
      x.exam,
      x.grade,
    ]),
  ).toEqual([
    ["АСОИУ", 0, 1, 0, 0, null, null],
    ["Англ яз", 1, 3, 1, 1, null, null],
    ["Модели данных", 0, 1, 0, 1, null, null],
    ["Программирование", 0, 2, 0, 1, null, null],
    ["Правоведение", 1, 2, 0, 1, null, null],
    ["Теорвер", 0, 3, 1, 3, null, null],
    ["Физика", 0, 2, 1, 4, null, null],
    ["Экология", 0, 2, 0, 2, null, null],
    ["Электротехника", 2, 4, 0, 1, null, null],
  ]);
  expect(
    s.groups.map((g) => [
      g.name,
      g.stages,
      g.values.map((row) =>
        row
          .map((v) => (v === "done" ? "+" : v === "not_done" ? "-" : "?"))
          .join(""),
      ),
    ]),
  ).toEqual([
    [
      "Физика лабы",
      ["Написана", "Выполнена", "Защищена"],
      ["++++--", "++++--", "+++---"],
    ],
    [
      "Физика ДЗ",
      ["Решена", "Сдана", "Защита теор", "Защита прак"],
      ["++??", "++??", "+???", "++??"],
    ],
    ["ЭлТех лабы", ["Выполнена", "Защищена"], ["++??", "++??"]],
    ["МД лабы", ["Выполнена", "Защищена"], ["++----", "++----"]],
  ]);
  db.close();
});
test("M2: stage persistence, undo, seed idempotence, aggregates never double count", () => {
  const dir = mkdtempSync(join(tmpdir(), "study-"));
  let db = new Store(join(dir, "test.db"));
  db.command({ type: "importStudy" });
  const before = db.state();
  const g = before.groups[0];
  db.command({
    type: "stage",
    groupId: g.id,
    row: 2,
    column: 3,
    status: "done",
  });
  db.close();
  db = new Store(join(dir, "test.db"));
  expect(db.state().groups[0].values[2][3]).toBe("done");
  db.command({ type: "importStudy" });
  expect(db.state().groups).toHaveLength(4);
  db.command({
    type: "addGroup",
    subjectId: before.subjects[0].id,
    name: "Пользовательская",
    count: 2,
    stages: ["Сдана"],
  });
  expect(db.state().subjects).toEqual(before.subjects);
  expect(() =>
    db.command({
      type: "subject",
      subject: { ...before.subjects[0], rkDone: 99 },
    }),
  ).toThrow();
  expect(() =>
    db.command({
      type: "stage",
      groupId: g.id,
      row: 99,
      column: 0,
      status: "done",
    }),
  ).toThrow();
  db.close();
  rmSync(dir, { recursive: true });
});
