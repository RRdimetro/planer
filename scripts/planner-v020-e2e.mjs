import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = path.join(tmpdir(), "focus-planner-v020");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "attachment.txt");
fs.writeFileSync(file, "Persistence attachment check");
let app, page;
const checks = [];
const errors = [];
async function launch() {
  app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      FOCUS_DATA_DIR: dir,
    },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(String(e)));
}
try {
  await launch();
  await page
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  await page.getByRole("button", { name: "Задачи", exact: true }).click();
  await page.getByRole("button", { name: "Новая задача", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Контроль: чтение");
  await page
    .getByRole("button", { name: "+ Пункт чек-листа", exact: true })
    .click();
  await page.getByLabel("Пункт 1", { exact: true }).fill("Проверить условия");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Контроль: чтение", exact: true })
    .click();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  await page
    .getByRole("button", { name: "Прикрепить файл", exact: true })
    .click();
  await expect(
    page.getByText("attachment.txt", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  checks.push("checklist and native attachment");
  await page
    .getByRole("button", {
      name: "Подзадача для Контроль: чтение",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Название", { exact: true })
    .fill("Контроль: подзадача");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Вид задач", { exact: true }).selectOption("list");
  await expect(
    page.getByText("Проверить условия", { exact: true }),
  ).toBeVisible();
  checks.push("hierarchy");
  await page.getByRole("button", { name: "Планировщик", exact: true }).click();
  await page.getByLabel("Дата календаря", { exact: true }).fill("2026-11-02");
  await page.getByRole("button", { name: "Событие", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Контроль: пара");
  await page.getByLabel("Время", { exact: true }).fill("09:00");
  await page
    .getByLabel("Тип события", { exact: true })
    .selectOption("university");
  await page.getByLabel("Оценка, мин", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const handle = page.getByRole("button", {
    name: "Изменить длительность Контроль: пара",
    exact: true,
  });
  await handle.focus();
  await handle.press("ArrowDown");
  await expect
    .poll(async () => {
      return (await page.evaluate(() => window.focusAPI.state())).items.find(
        (i) => i.title === "Контроль: пара",
      )?.estimate;
    })
    .toBe(75);
  checks.push("event keyboard resize");
  const event = page
    .locator(".calendar-event")
    .filter({ hasText: "Контроль: пара" });
  const target = page.getByRole("button", {
    name: "Создать событие 2026-11-03 10:00",
    exact: true,
  });
  await event.dragTo(target);
  await expect
    .poll(async () => {
      return (await page.evaluate(() => window.focusAPI.state())).items.find(
        (i) => i.title === "Контроль: пара",
      )?.date;
    })
    .toBe("2026-11-03");
  checks.push("event drag and drop");
  await page.getByRole("button", { name: "Месяц", exact: true }).click();
  await expect(page.locator(".month-cell")).toHaveCount(42);
  await page.screenshot({
    path: "docs/screenshots/0.2.0/02-planner-month.png",
  });
  await page.getByRole("button", { name: "Неделя", exact: true }).click();
  await page
    .getByRole("button", { name: "Предложить расписание", exact: true })
    .click();
  let state = await page.evaluate(() => window.focusAPI.state());
  expect(
    state.items.find((i) => i.title === "Контроль: чтение").date,
  ).toBeNull();
  await page
    .getByRole("button", { name: "Применить расписание", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  state = await page.evaluate(() => window.focusAPI.state());
  expect(
    state.items.find((i) => i.title === "Контроль: чтение").date,
  ).not.toBeNull();
  await page
    .getByRole("button", { name: "Зафиксировать план недели", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Исходный план заморожен", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "docs/screenshots/0.2.0/02-planner-week.png" });
  checks.push("42-day month, preview, atomic apply, snapshot");
  await app.close();
  await launch();
  state = await page.evaluate(() => window.focusAPI.state());
  expect(state.attachments).toHaveLength(1);
  const task = state.items.find((i) => i.title === "Контроль: чтение");
  expect(state.taskDetails[task.id].checklist[0].title).toBe(
    "Проверить условия",
  );
  const sub = state.items.find((i) => i.title === "Контроль: подзадача");
  expect(state.taskDetails[sub.id].parentId).toBe(task.id);
  checks.push("restart preserves relations and attachment");
  if (errors.length) throw Error(errors.join("\n"));
  fs.writeFileSync(
    "docs/reports/0.2.0/02-planner-e2e.json",
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
  console.log("Planner v0.2.0 E2E passed");
} catch (e) {
  if (page)
    await page
      .screenshot({ path: "docs/screenshots/0.2.0/planner-failure.png" })
      .catch(() => {});
  throw e;
} finally {
  await app?.close().catch(() => {});
}
