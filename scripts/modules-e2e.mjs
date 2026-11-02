import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = path.join(tmpdir(), "focus-modules-e2e");
fs.rmSync(dir, { recursive: true, force: true });
async function launch() {
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      FOCUS_DATA_DIR: dir,
    },
  });
  return { app, page: await app.firstWindow() };
}
let { app, page } = await launch();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page
  .getByRole("button", { name: "Пустое пространство", exact: true })
  .click();
await page.getByRole("button", { name: "Фокус", exact: true }).click();
await page.getByRole("button", { name: "Начать фокус", exact: true }).click();
await page.waitForTimeout(2300);
await page.getByRole("button", { name: "Пауза", exact: true }).click();
let state = await page.evaluate(() => window.focusAPI.state());
if (state.sessions[0].seconds < 1) throw Error("Timer did not run");
const paused = state.sessions[0].seconds;
await page.waitForTimeout(1500);
state = await page.evaluate(() => window.focusAPI.state());
if (state.sessions[0].seconds !== paused) throw Error("Pause did not stop");
await page.screenshot({ path: "docs/screenshots/M3.png" });
await page.getByRole("button", { name: "Завершить", exact: true }).click();
await page.getByRole("button", { name: "Заметки", exact: true }).click();
await page.getByRole("button", { name: "+ Заметка", exact: true }).click();
await page
  .getByRole("textbox", { name: "Название заметки", exact: true })
  .fill("Проверка автосохранения");
await page
  .getByRole("textbox", { name: "Текст заметки", exact: true })
  .fill("# Проверка\nТекст сохраняется в SQLite.");
await page.waitForTimeout(1300);
await app.close();
({ app, page } = await launch());
await page.getByRole("button", { name: "Заметки", exact: true }).click();
await expect(
  page.getByRole("textbox", { name: "Текст заметки", exact: true }),
).toHaveValue("# Проверка\nТекст сохраняется в SQLite.");
state = await page.evaluate(() => window.focusAPI.state());
if (state.sessions[0].state !== "done") throw Error("Session did not persist");
await app.close();
if (errors.length) throw Error(errors.join("\n"));
fs.writeFileSync(
  "docs/reports/M3-e2e.json",
  JSON.stringify({
    passed: true,
    checks: ["timer elapsed", "pause", "finish", "autosave", "restart"],
    rendererErrors: errors,
  }),
);
console.log("M3 Electron E2E passed");
