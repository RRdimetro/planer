import { test, expect } from "vitest";
import ExcelJS from "exceljs";
import { Store } from "../packages/database";
import {
  exportStudyExcel,
  importStudyExcel,
} from "../packages/database/study-excel";
import { backupArchive, restoreArchive } from "../packages/database/backup";
test("real XLSX round-trip preserves 9 subjects, 4 groups, all 54 tri-states and null grades", async () => {
  const db = new Store(":memory:");
  try {
    db.command({ type: "importStudy" });
    const s = db.state();
    const bytes = await exportStudyExcel(s, "user");
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    const parsed = await importStudyExcel(bytes, s, "user");
    expect(parsed.subjects).toEqual(s.subjects);
    expect(parsed.groups).toEqual(s.groups);
    expect(parsed.cells).toBe(54);
    db.db.exec(
      "UPDATE study_stage_status SET updated_at='2001-01-01T00:00:00.000Z'",
    );
    db.command({
      type: "studyWorkbook",
      subjects: parsed.subjects,
      groups: parsed.groups,
    });
    expect(
      db.db
        .prepare(
          "SELECT count(*) n FROM study_stage_status WHERE updated_at<>'2001-01-01T00:00:00.000Z'",
        )
        .get(),
    ).toEqual({ n: 0 });
  } finally {
    db.close();
  }
});
test("XLSX rejects formulas, ambiguous/invalid cells and cross-workspace import before mutation", async () => {
  const db = new Store(":memory:");
  try {
    db.command({ type: "importStudy" });
    const before = db.dump(true);
    const demo = await exportStudyExcel(db.state(), "demo");
    await expect(importStudyExcel(demo, db.state(), "user")).rejects.toThrow(
      "не смешиваются",
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(
      (await exportStudyExcel(db.state(), "user")) as unknown as ArrayBuffer,
    );
    book.getWorksheet("Предметы")!.getCell("C2").value = {
      formula: "1+1",
      result: 2,
    };
    await expect(
      importStudyExcel(
        Buffer.from(await book.xlsx.writeBuffer()),
        db.state(),
        "user",
      ),
    ).rejects.toThrow("Формулы");
    expect(db.dump(true)).toBe(before);
  } finally {
    db.close();
  }
});
test("group expansion preserves known cells and creates unknown cells; shrinking is atomic failure", () => {
  const db = new Store(":memory:");
  try {
    db.command({ type: "importStudy" });
    const g = db.state().groups[0];
    const original = structuredClone(g.values);
    db.command({
      type: "studyGroup",
      group: {
        ...g,
        name: g.name + " updated",
        values: g.values.map((r) => [...r, "unknown"]),
      },
    });
    const after = db.state().groups[0];
    expect(after.values.map((r) => r.slice(0, -1))).toEqual(original);
    expect(after.values.every((r) => r.at(-1) === "unknown")).toBe(true);
    const snapshot = db.dump(true);
    expect(() => db.command({ type: "studyGroup", group: g })).toThrow();
    expect(db.dump(true)).toBe(snapshot);
  } finally {
    db.close();
  }
});
test("explicit aggregate binding counts one selected stage without merging delivery/defense, and survives backup", () => {
  const db = new Store(":memory:");
  try {
    db.command({ type: "importStudy" });
    const s = db.state(),
      group = s.groups[0],
      subject = s.subjects.find((x) => x.id === group.subjectId)!;
    db.command({
      type: "studyBinding",
      subjectId: subject.id,
      kind: "hw",
      groupId: group.id,
      stageRow: 2,
    });
    let after = db.state().subjects.find((x) => x.id === subject.id)!;
    expect(after.hwDone).toBe(3);
    expect(after.hwTotal).toBe(6);
    expect(after.rkDone).toBe(subject.rkDone);
    db.command({
      type: "stage",
      groupId: group.id,
      row: 2,
      column: 3,
      status: "done",
    });
    after = db.state().subjects.find((x) => x.id === subject.id)!;
    expect(after.hwDone).toBe(4);
    const copy = new Store(":memory:");
    restoreArchive(copy, backupArchive(db));
    expect(copy.state().studyBindings).toEqual(db.state().studyBindings);
    expect(
      copy.db
        .prepare("SELECT * FROM study_stage_status ORDER BY work_id,stage_id")
        .all(),
    ).toEqual(
      db.db
        .prepare("SELECT * FROM study_stage_status ORDER BY work_id,stage_id")
        .all(),
    );
    copy.close();
  } finally {
    db.close();
  }
});
