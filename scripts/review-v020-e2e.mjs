import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
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
const errors = [];
const userDir = path.join(tmpdir(), "focus-review-user-v020");
const demoDir = path.join(tmpdir(), "focus-review-demo-v020");
for (const dir of [userDir, demoDir])
  fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync("docs/screenshots/0.2.0/user", { recursive: true });
fs.mkdirSync("docs/screenshots/0.2.0/demo", { recursive: true });
for (const demo of [false, true]) {
  const dir = demo ? demoDir : userDir;
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      FOCUS_DATA_DIR: dir,
      FOCUS_DEMO: demo ? "1" : "0",
    },
  });
  try {
    const page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(String(e)));
    if (!demo)
      await page
        .getByRole("button", {
          name: "Импортировать учебный прогресс из примера",
          exact: true,
        })
        .click();
    await expect(
      page.getByRole("heading", { name: "Главная", exact: true }),
    ).toBeVisible();
    const state = await page.evaluate(() => window.focusAPI.state());
    expect(state.diagnostics.workspace).toBe(demo ? "demo" : "user");
    if (!demo) expect(state.items).toHaveLength(0);
    if (demo) {
      expect(state.items.length).toBeGreaterThan(20);
      await expect(page.locator(".demo-banner")).toContainText("Изолированная");
    }
    for (const [width, height] of sizes) {
      await app.evaluate(
        ({ BrowserWindow }, size) =>
          BrowserWindow.getAllWindows()[0].setSize(size[0], size[1]),
        [width, height],
      );
      for (let i = 0; i < pages.length; i++) {
        await page.getByRole("button", { name: pages[i], exact: true }).click();
        await page.waitForTimeout(300);
        await expect(
          page.getByRole("heading", { name: pages[i], exact: true }),
        ).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        results.push({
          mode: demo ? "demo" : "user",
          page: pages[i],
          width,
          height,
          overflow,
        });
        await page.screenshot({
          path: `docs/screenshots/0.2.0/${demo ? "demo" : "user"}/${String(i + 1).padStart(2, "0")}-${width}.png`,
        });
      }
    }
  } finally {
    await app.close();
  }
}
const userApp = await electron.launch({
  args: [".", "--no-sandbox", "--disable-gpu"],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":99",
    FOCUS_DATA_DIR: userDir,
    FOCUS_DEMO: "0",
  },
});
try {
  const p = await userApp.firstWindow();
  await expect(
    p.getByRole("heading", { name: "Главная", exact: true }),
  ).toBeVisible();
  const s = await p.evaluate(() => window.focusAPI.state());
  expect(s.items).toHaveLength(0);
  expect(s.subjects).toHaveLength(9);
} finally {
  await userApp.close();
}
fs.writeFileSync(
  "docs/reports/0.2.0/04-design-e2e.json",
  JSON.stringify(
    {
      passed: !errors.length && !results.some((r) => r.overflow),
      errors,
      results,
    },
    null,
    2,
  ),
);
if (errors.length || results.some((r) => r.overflow))
  throw Error(
    "Renderer errors or page overflow: " +
      JSON.stringify({ errors, overflow: results.filter((r) => r.overflow) }),
  );
console.log(
  "60 real Electron screenshots; user/demo isolation and no overflow confirmed",
);
