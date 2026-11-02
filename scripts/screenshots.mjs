import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = path.join(tmpdir(), "focus-screenshots");
fs.rmSync(dir, { recursive: true, force: true });
const app = await electron.launch({
  args: [".", "--no-sandbox", "--disable-gpu"],
  env: { ...process.env, DISPLAY: ":99", FOCUS_DATA_DIR: dir },
});
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page
  .getByRole("button", {
    name: "Импортировать учебный прогресс из примера",
    exact: true,
  })
  .click();
const pages = [
  "Главная",
  "Планировщик",
  "Задачи",
  "Проекты",
  "Учёба",
  "Тренировки",
  "Аналитика",
  "Фокус",
  "Заметки",
  "Настройки",
];
const sizes = [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];
const results = [];
for (const [width, height] of sizes) {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0].setSize(size[0], size[1]);
    },
    [width, height],
  );
  for (let i = 0; i < pages.length; i++) {
    await page.getByRole("button", { name: pages[i], exact: true }).click();
    await page.waitForTimeout(200);
    await expect(
      page.getByRole("heading", { name: pages[i], exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    results.push({ page: pages[i], width, height, overflow });
    await page.screenshot({
      path: `docs/screenshots/${String(i + 1).padStart(2, "0")}-${width}.png`,
    });
  }
}
await app.close();
fs.writeFileSync(
  "docs/reports/screenshots.json",
  JSON.stringify({ errors, results }, null, 2),
);
if (errors.length || results.some((r) => r.overflow))
  throw Error("Renderer error or page overflow");
console.log("30 screenshots, no errors or horizontal page overflow");
