import { launch, temp, state, poll, expect } from "./obsidian-harness.mjs";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
const dir = temp("focus-obs-study-");
let ui;
const checks = [];
try {
  ui = await launch(dir, true);
  const { p, app, nav } = ui;
  await nav("Учёба");
  const original = await state(p);
  expect(original.subjects).toHaveLength(9);
  expect(original.groups.flatMap((g) => g.values.flat())).toHaveLength(54);
  const file = path.join(dir, "study.xlsx");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, file);
  await p.getByRole("button", { name: "Экспорт Excel", exact: true }).click();
  await expect.poll(() => fs.existsSync(file)).toBe(true);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  book.getWorksheet("Работы").getCell("G2").value = "unknown";
  await book.xlsx.writeFile(file);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    });
  }, file);
  await p.getByRole("button", { name: "Импорт Excel", exact: true }).click();
  await poll(p, (s) => s.groups[0].values[0][0]).toBe("unknown");
  let after = await state(p);
  expect(after.subjects).toEqual(original.subjects);
  expect(after.groups[0].values[0].slice(1)).toEqual(
    original.groups[0].values[0].slice(1),
  );
  expect(
    fs
      .readdirSync(path.join(dir, "backups"))
      .some((f) => f.startsWith("before-study-import-")),
  ).toBe(true);
  checks.push(
    "real bundled Excel export/import preview, one changed cell, backup and 9 subjects retained",
  );
  await p
    .getByRole("button", { name: "Редактировать Физика лабы", exact: true })
    .click();
  await p.getByLabel("Количество работ", { exact: true }).fill("7");
  await p
    .getByRole("button", { name: "Сохранить группу", exact: true })
    .click();
  await poll(p, (s) => s.groups[0].values[0].length).toBe(7);
  after = await state(p);
  expect(after.groups[0].values.every((row) => row[6] === "unknown")).toBe(
    true,
  );
  checks.push("group grows without overwriting known statuses");
  await nav("Главная");
  await p.keyboard.press("Control+k");
  await p
    .getByRole("combobox", { name: "Поиск и команды" })
    .fill("Создать проект");
  await p.keyboard.press("Enter");
  await p.getByLabel("Название", { exact: true }).fill("Проект Obsidian C");
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p.keyboard.press("Control+k");
  await p
    .getByRole("combobox", { name: "Поиск и команды" })
    .fill("Проект Obsidian C");
  await p.keyboard.press("Enter");
  await expect(
    p.getByRole("heading", { name: "Проект Obsidian C", exact: true }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Задача проекта", exact: true }).click();
  await p.getByLabel("Название", { exact: true }).fill("Этап проекта C");
  await p.getByLabel("Дата", { exact: true }).fill("2026-11-04");
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p.getByRole("button", { name: "Гантт", exact: true }).click();
  await expect(
    p.getByRole("img", { name: "Гантт задач проекта" }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Kanban", exact: true }).click();
  await expect(p.locator(".obs-project-board")).toContainText("Этап проекта C");
  await p.getByRole("button", { name: "Активность", exact: true }).click();
  await p.locator(".obs-history summary").click();
  await expect(p.locator(".obs-history article").first()).toBeVisible();
  checks.push(
    "global palette creates and opens real project; task, Gantt, Kanban and activity work",
  );
  await ui.app.close();
  ui = await launch(dir, true);
  after = await state(ui.p);
  expect(after.groups[0].values[0][0]).toBe("unknown");
  expect(after.groups[0].values[0]).toHaveLength(7);
  expect(after.items.some((i) => i.title === "Проект Obsidian C")).toBe(true);
  expect(after.subjects).toHaveLength(9);
  expect(ui.errors).toEqual([]);
  checks.push("process restart preserves study edits and new project");
  fs.writeFileSync(
    "docs/reports/obsidian/C/e2e.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        platform: process.platform,
        windowsTested: false,
      },
      null,
      2,
    ),
  );
  console.log(checks);
} catch (e) {
  if (ui) {
    await ui.p.screenshot({ path: "/tmp/obsidian-workspaces-failure.png" });
    console.log(
      "alerts",
      await ui.p.locator('[role="alert"]').allTextContents(),
    );
  }
  throw e;
} finally {
  if (ui) await ui.app.close().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
}
