import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = path.join(tmpdir(), "focus-notes-flush-v020");
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
}
try {
  await launch();
  await page
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  await page.getByRole("button", { name: "Заметки", exact: true }).click();
  await page.getByRole("button", { name: "+ Заметка", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Текст заметки", exact: true })
    .fill("Изменение перед быстрым переходом");
  await page.getByRole("button", { name: "Задачи", exact: true }).click();
  await page.getByRole("button", { name: "Заметки", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Текст заметки", exact: true }),
  ).toHaveValue("Изменение перед быстрым переходом");
  await page
    .getByRole("textbox", { name: "Текст заметки", exact: true })
    .fill("Последнее изменение прямо перед закрытием");
  await app.close();
  await launch();
  await page.getByRole("button", { name: "Заметки", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Текст заметки", exact: true }),
  ).toHaveValue("Последнее изменение прямо перед закрытием");
  fs.writeFileSync(
    "docs/reports/0.2.0/04-notes-flush-e2e.json",
    JSON.stringify({
      passed: true,
      checks: [
        "navigation flush before debounce",
        "graceful close flush before debounce",
        "restart exact text",
      ],
    }),
  );
  console.log("Notes navigation/close flush E2E passed");
} finally {
  await app?.close().catch(() => {});
}
