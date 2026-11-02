import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const stage = process.argv[2] ?? "M1";
const dataDir = path.join(tmpdir(), "focus-e2e-" + stage);
fs.rmSync(dataDir, { recursive: true, force: true });
async function launch() {
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      FOCUS_DATA_DIR: dataDir,
    },
  });
  return { app, page: await app.firstWindow() };
}
let { app, page } = await launch();
const failures = [];
page.on("pageerror", (e) => failures.push(String(e)));
await page
  .getByRole("button", { name: "Пустое пространство", exact: true })
  .click();
await page.getByRole("button", { name: "Проекты", exact: true }).click();
await page.getByRole("button", { name: "Добавить", exact: true }).click();
await page.getByLabel("Название", { exact: true }).fill("Контрольный проект");
await page.getByRole("button", { name: "Сохранить", exact: true }).click();
await expect(page.getByRole("dialog")).toHaveCount(0);
await page.getByRole("button", { name: "Задачи", exact: true }).click();
await page.getByRole("button", { name: "Добавить", exact: true }).click();
await page.getByLabel("Название", { exact: true }).fill("Проверить сохранение");
await page.getByLabel("Статус", { exact: true }).selectOption("week");
await page.getByLabel("Дата", { exact: true }).fill("2026-11-05");
await page
  .getByLabel("Проект", { exact: true })
  .selectOption({ label: "Контрольный проект" });
await page.getByRole("button", { name: "Сохранить", exact: true }).click();
await expect(page.getByRole("dialog")).toHaveCount(0);
await expect(
  page.getByRole("button", { name: "Проверить сохранение", exact: true }),
).toBeVisible();
await page.screenshot({ path: `docs/screenshots/${stage}.png` });
await app.close();
({ app, page } = await launch());
await page.getByRole("button", { name: "Задачи", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Проверить сохранение", exact: true }),
).toBeVisible();
const state = await page.evaluate(() => window.focusAPI.state());
if (state.items.filter((x) => x.kind === "task").length !== 1)
  throw Error("Task duplicated/lost");
if (state.items.find((x) => x.kind === "task").date !== "2026-11-05")
  throw Error("Date lost");
await app.close();
if (failures.length) throw Error(failures.join("\n"));
fs.writeFileSync(
  `docs/reports/${stage}-e2e.json`,
  JSON.stringify(
    {
      passed: true,
      workflow: "project → weekly task → Thursday → restart",
      rendererErrors: failures,
    },
    null,
    2,
  ),
);
console.log(stage + " E2E passed");
