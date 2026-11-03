import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const stage = process.argv[2] ?? "F";
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
const sizes =
  stage === "F"
    ? [
        [1366, 768],
        [1920, 1080],
        [2560, 1440],
      ]
    : [
        [1366, 768],
        [1920, 1080],
      ];
const results = [];
const errors = [];
fs.mkdirSync(`docs/screenshots/obsidian/${stage}`, { recursive: true });
fs.mkdirSync(`docs/reports/obsidian/${stage}`, { recursive: true });
for (const demo of [true, false]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-obs-capture-"));
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":102",
      FOCUS_DEMO: demo ? "1" : "0",
      FOCUS_DATA_DIR: dir,
      FOCUS_HOME_CONCEPT: demo ? "B" : "",
      FOCUS_DEMO_EMPTY: "0",
    },
  });
  try {
    const p = await app.firstWindow();
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.emulateMedia({ reducedMotion: "reduce" });
    if (!demo)
      await p
        .getByRole("button", { name: "Пустое пространство", exact: true })
        .click();
    await expect(
      p.getByRole("heading", { name: "Главная", exact: true }),
    ).toBeVisible();
    await p.evaluate(() => document.fonts.ready);
    for (const [width, height] of sizes) {
      await app.evaluate(
        ({ BrowserWindow }, [w, h]) =>
          BrowserWindow.getAllWindows()[0].setContentSize(w, h),
        [width, height],
      );
      for (let i = 0; i < pages.length; i++) {
        if (stage === "A" && ![0, 2, 4].includes(i)) continue;
        await p.locator("nav").getByRole("button", { name: pages[i], exact: true }).click();
        await expect(
          p.getByRole("heading", { name: pages[i], exact: true }),
        ).toBeVisible();
        await p.waitForTimeout(450);
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        results.push({ demo, page: pages[i], width, height, overflow });
        await p.screenshot({
          path: `docs/screenshots/obsidian/${stage}/${demo ? "demo" : "empty"}-${i + 1}-${width}.png`,
          style: "*{caret-color:transparent!important}",
        });
      }
    }
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
fs.writeFileSync(
  `docs/reports/obsidian/${stage}/screenshots.json`,
  JSON.stringify(
    {
      passed: !errors.length && !results.some((r) => r.overflow),
      results,
      errors,
      platform: process.platform,
      windowsTested: false,
    },
    null,
    2,
  ),
);
expect(errors).toEqual([]);
expect(results.filter((r) => r.overflow)).toEqual([]);
console.log(
  `${stage}: ${results.length} real Electron screenshots; no renderer errors/overflow`,
);
