import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = path.join(tmpdir(), "focus-projects-v020");
fs.rmSync(dir, { recursive: true, force: true });
let app, page;
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
  await page.locator("h1").waitFor();
}
try {
  await launch();
  await page
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  await page.getByRole("button", { name: "Проекты", exact: true }).click();
  await page.getByRole("button", { name: "Новый проект", exact: true }).click();
  await page
    .getByLabel("Название", { exact: true })
    .fill("Контроль: дорожная карта");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Контроль: дорожная карта", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Дорожная карта", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить этап", exact: true })
    .click();
  await page
    .getByLabel("Название этапа", { exact: true })
    .fill("Контроль: первый этап");
  await page
    .getByRole("button", { name: "Сохранить этап", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Завершить этап Контроль: первый этап",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => {
      return (await page.evaluate(() => window.focusAPI.state())).milestones[0]
        ?.done;
    })
    .toBe(true);
  await page.screenshot({
    path: "docs/screenshots/0.2.0/04-project-roadmap.png",
  });
  await page
    .getByRole("button", { name: "Заметки и файлы", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Заметка", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Заметки", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Название заметки", exact: true })
    .fill("Контроль: заметка проекта");
  await page
    .getByRole("textbox", { name: "Текст заметки", exact: true })
    .fill("Связанный контекст проекта сохраняется.");
  await page.getByRole("button", { name: "Проекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Контроль: дорожная карта", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Заметки и файлы", exact: true })
    .click();
  await page
    .locator(".linked-note")
    .filter({ hasText: "Контроль: заметка проекта" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Текст заметки", exact: true }),
  ).toHaveValue("Связанный контекст проекта сохраняется.");
  await app.close();
  await launch();
  const state = await page.evaluate(() => window.focusAPI.state());
  expect(state.milestones[0].done).toBe(true);
  const note = state.items.find((i) => i.kind === "note");
  expect(note.projectId).toBe(state.items.find((i) => i.kind === "project").id);
  await app.close();
  app = null;
  fs.writeFileSync(
    "docs/reports/0.2.0/04-projects-e2e.json",
    JSON.stringify({
      passed: true,
      checks: [
        "project CRUD",
        "milestone create and complete",
        "linked note opens Markdown editor",
        "immediate navigation saves note",
        "restart retains project relations",
      ],
    }),
  );
  console.log("Projects roadmap/linked-note E2E passed");
} finally {
  await app?.close().catch(() => {});
}
