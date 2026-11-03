import ExcelJS from "exceljs";
import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  subjectSchema,
  groupSchema,
  type State,
  type StudyGroup,
  type Subject,
  type StageStatus,
} from "../contracts";
const subjectHeaders = [
  "ID",
  "Предмет",
  "РК написано",
  "РК всего",
  "ДЗ сдано",
  "ДЗ всего",
  "Экз",
  "Итог",
];
const workHeaders = [
  "Группа ID",
  "Предмет ID",
  "Группа",
  "Этап №",
  "Этап",
  "Работа №",
  "Статус",
];
export async function exportStudyExcel(s: State, workspace: "user" | "demo") {
  const book = new ExcelJS.Workbook();
  book.creator = "FOCUS OS PRO";
  const meta = book.addWorksheet("FOCUS_META");
  meta.addRows([
    ["FOCUS_OS_PRO_STUDY", 1],
    ["workspace", workspace],
    ["Статусы", "done / not_done / unknown. Пусто = unknown."],
    ["Важно", "Не объединяйте выполнение, сдачу и защиту."],
  ]);
  const subjects = book.addWorksheet("Предметы");
  subjects.addRow(subjectHeaders);
  for (const x of s.subjects)
    subjects.addRow([
      x.id,
      x.name,
      x.rkDone,
      x.rkTotal,
      x.hwDone,
      x.hwTotal,
      x.exam,
      x.grade,
    ]);
  const works = book.addWorksheet("Работы");
  works.addRow(workHeaders);
  for (const g of s.groups)
    g.values.forEach((row, r) =>
      row.forEach((v, c) =>
        works.addRow([g.id, g.subjectId, g.name, r + 1, g.stages[r], c + 1, v]),
      ),
    );
  for (const sheet of [subjects, works]) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFF1F7F2" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF285A3B" },
    };
    sheet.columns.forEach((col, i) => {
      col.width = i < 2 ? 38 : 22;
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
    };
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
function scalar(value: ExcelJS.CellValue): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  throw Error(
    "Формулы, ссылки и сложные ячейки не исполняются. Вставьте значения в шаблон.",
  );
}
const text = (value: ExcelJS.CellValue) => String(scalar(value) ?? "").trim();
const uuid = (value: string) => z.string().uuid().safeParse(value).success;
/** Reads a documented local workbook, validates the whole graph before any SQLite write. */
export async function importStudyExcel(
  bytes: Buffer,
  current: State,
  workspace: "user" | "demo",
) {
  if (bytes.length > 50 * 1024 * 1024) throw Error("Excel больше 50 МБ");
  const zip = new AdmZip(bytes);
  const entries = zip.getEntries();
  if (
    entries.length > 5000 ||
    entries.reduce((n, e) => n + e.header.size, 0) > 128 * 1024 * 1024
  )
    throw Error("Слишком большой распакованный Excel");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ArrayBuffer);
  const meta = book.getWorksheet("FOCUS_META");
  if (meta && meta.getCell("A1").value !== "FOCUS_OS_PRO_STUDY")
    throw Error("Неизвестный формат Excel");
  const source = meta ? text(meta.getCell("B2").value) : "user";
  if (source !== workspace)
    throw Error("Excel из демо и рабочие данные не смешиваются");
  const subjectSheet = book.getWorksheet("Предметы"),
    workSheet = book.getWorksheet("Работы");
  if (!subjectSheet || !workSheet)
    throw Error(
      "Нужны листы «Предметы» и «Работы». Сначала экспортируйте шаблон из приложения.",
    );
  for (const [sheet, headers] of [
    [subjectSheet, subjectHeaders],
    [workSheet, workHeaders],
  ] as const) {
    if (sheet.rowCount > 100000) throw Error("Слишком много строк");
    headers.forEach((h, i) => {
      if (text(sheet.getRow(1).getCell(i + 1).value) !== h)
        throw Error(`Неверный столбец ${sheet.name}: ${h}`);
    });
  }
  const subjects: Subject[] = [];
  const aliases = new Map<string, string>();
  const subjectIds = new Set<string>();
  subjectSheet.eachRow((row, n) => {
    if (n === 1) return;
    const raw = text(row.getCell(1).value),
      name = text(row.getCell(2).value);
    if (!name) return;
    const matches = current.subjects.filter((s) => s.name === name);
    if (!raw && matches.length > 1)
      throw Error("Для одноимённых предметов укажите ID");
    const old = current.subjects.find((s) => s.id === raw) ?? matches[0];
    const id = uuid(raw) ? raw : (old?.id ?? randomUUID());
    if (subjectIds.has(id)) throw Error("Повтор предмета в Excel");
    subjectIds.add(id);
    aliases.set(raw || name, id);
    aliases.set(name, id);
    aliases.set(id, id);
    const count = (
      col: number,
      key: "rkDone" | "rkTotal" | "hwDone" | "hwTotal",
    ) => {
      const v = scalar(row.getCell(col).value);
      return v === null || v === "" ? (old?.[key] ?? 0) : Number(v);
    };
    subjects.push(
      subjectSchema.parse({
        id,
        name,
        rkDone: count(3, "rkDone"),
        rkTotal: count(4, "rkTotal"),
        hwDone: count(5, "hwDone"),
        hwTotal: count(6, "hwTotal"),
        exam: text(row.getCell(7).value) || null,
        grade: text(row.getCell(8).value) || null,
      }),
    );
  });
  const map = new Map<
    string,
    {
      id: string;
      subjectId: string;
      name: string;
      stages: Map<number, string>;
      cells: Map<string, StageStatus>;
      maxWork: number;
      maxStage: number;
    }
  >();
  const statuses: Record<string, StageStatus> = {
    done: "done",
    "+": "done",
    "✓": "done",
    "1": "done",
    true: "done",
    выполнено: "done",
    not_done: "not_done",
    "-": "not_done",
    "−": "not_done",
    "0": "not_done",
    false: "not_done",
    "не выполнено": "not_done",
    unknown: "unknown",
    "?": "unknown",
    "": "unknown",
    неизвестно: "unknown",
  };
  workSheet.eachRow((row, n) => {
    if (n === 1) return;
    const raw = text(row.getCell(1).value),
      ref = text(row.getCell(2).value),
      name = text(row.getCell(3).value);
    if (!name) return;
    const subjectId =
      aliases.get(ref) ?? current.subjects.find((s) => s.id === ref)?.id;
    if (!subjectId) throw Error(`Предмет группы ${name} не найден`);
    const key = raw || subjectId + ":" + name;
    let group = map.get(key);
    if (!group) {
      const old = current.groups.find(
        (g) => g.id === raw || (g.subjectId === subjectId && g.name === name),
      );
      group = {
        id: uuid(raw) ? raw : (old?.id ?? randomUUID()),
        subjectId,
        name,
        stages: new Map(),
        cells: new Map(),
        maxWork: 0,
        maxStage: 0,
      };
      map.set(key, group);
    }
    if (group.name !== name || group.subjectId !== subjectId)
      throw Error("ID группы используется неоднозначно");
    const r = Number(scalar(row.getCell(4).value)),
      c = Number(scalar(row.getCell(6).value));
    if (
      !Number.isInteger(r) ||
      r < 1 ||
      r > 20 ||
      !Number.isInteger(c) ||
      c < 1 ||
      c > 100
    )
      throw Error("Номер этапа 1–20, работы 1–100");
    const stage = text(row.getCell(5).value);
    if (!stage || (group.stages.has(r) && group.stages.get(r) !== stage))
      throw Error("Неоднозначное название этапа");
    group.stages.set(r, stage);
    const value = statuses[text(row.getCell(7).value).toLowerCase()];
    if (!value) throw Error("Неизвестный статус работы");
    if (group.cells.has(`${r}:${c}`))
      throw Error("Повтор одной ячейки в Excel");
    group.cells.set(`${r}:${c}`, value);
    group.maxWork = Math.max(c, group.maxWork);
    group.maxStage = Math.max(r, group.maxStage);
  });
  const groups: StudyGroup[] = [...map.values()].map((g) =>
    groupSchema.parse({
      id: g.id,
      subjectId: g.subjectId,
      name: g.name,
      stages: Array.from(
        { length: g.maxStage },
        (_, r) => g.stages.get(r + 1) ?? "",
      ),
      values: Array.from({ length: g.maxStage }, (_, r) =>
        Array.from(
          { length: g.maxWork },
          (_, c) => g.cells.get(`${r + 1}:${c + 1}`) ?? "unknown",
        ),
      ),
    }),
  );
  if (!subjects.length && !groups.length)
    throw Error("В Excel нет учебных данных");
  if (new Set(groups.map((g) => g.id)).size !== groups.length)
    throw Error("Повтор ID группы");
  return {
    subjects,
    groups,
    cells: groups.reduce((n, g) => n + g.values.flat().length, 0),
  };
}
