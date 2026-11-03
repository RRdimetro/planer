import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-v4-visual-"));
const out = "docs/screenshots/forest-noir-v4/regression";
fs.mkdirSync(out, { recursive: true });
const names = [
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
const results = [],
  zoom = [];
async function launch(concept) {
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":102",
      FOCUS_DATA_DIR: dir,
      FOCUS_DEMO: "1",
      FOCUS_HOME_CONCEPT: concept,
      FOCUS_DEMO_EMPTY: "0",
    },
  });
  const page = await app.firstWindow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("heading", { name: "Главная", exact: true }),
  ).toBeVisible();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1366, 768),
  );
  return { app, page };
}
try {
  // Classic mode and Forest mode open the exact same temporary demo records.
  for (const concept of ["", "A"]) {
    if (concept)
      fs.writeFileSync(
        path.join(dir, "forest-noir-preview.json"),
        JSON.stringify({ version: 1, concept: "A", empty: false }),
      );
    const { app, page } = await launch(concept);
    try {
      for (let i = 0; i < names.length; i++) {
        await page.getByRole("button", { name: names[i], exact: true }).click();
        await expect(
          page.getByRole("heading", { name: names[i], exact: true }),
        ).toBeVisible();
        await page.waitForTimeout(1700);
        const label = concept ? "preview" : "classic";
        await page.screenshot({
          path: `${out}/${label}-${i + 2}.png`,
          style: "* { caret-color:transparent !important; }",
        });
      }
      if (concept) {
        await page
          .getByRole("button", { name: "Главная", exact: true })
          .click();
        for (const [width, height] of [
          [1366, 768],
          [1920, 1080],
          [1440, 900],
          [2560, 1440],
        ]) {
          for (const factor of [1, 1.25, 1.5]) {
            await app.evaluate(
              ({ BrowserWindow }, { width, height, factor }) => {
                const w = BrowserWindow.getAllWindows()[0];
                w.setContentSize(width, height);
                w.webContents.setZoomFactor(factor);
              },
              { width, height, factor },
            );
            await page.waitForTimeout(180);
            const checks = await page.evaluate(() => ({
              cssWidth: window.innerWidth,
              overflow:
                document.documentElement.scrollWidth > window.innerWidth,
              clipped: [...document.querySelectorAll(".fn-panel")].some(
                (n) => n.getBoundingClientRect().right > window.innerWidth + 1,
              ),
            }));
            expect(checks.overflow).toBe(false);
            expect(checks.clipped).toBe(false);
            zoom.push({ concept: "A", width, height, factor, ...checks });
          }
        }
      }
    } finally {
      await app.close();
    }
  }
  for (let i = 0; i < names.length; i++) {
    const result = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          `from PIL import Image, ImageChops
import json,sys
a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB')
d=ImageChops.difference(a,b)
pixels=list(d.getdata()); changed=sum(max(p)>8 for p in pixels)
print(json.dumps({'changedPixels':changed,'ratio':changed/len(pixels)}))`,
          `${out}/classic-${i + 2}.png`,
          `${out}/preview-${i + 2}.png`,
        ],
        { encoding: "utf8" },
      ),
    );
    expect(result.ratio).toBeLessThan(0.003);
    results.push({ page: names[i], ...result });
  }
  fs.writeFileSync(
    "docs/reports/forest-noir-v4/visual-regression.json",
    JSON.stringify(
      {
        passed: true,
        results,
        zoom,
        scope:
          "Nine existing pages retain classic rendering. Zoom equivalents are Linux Chromium tests, not Windows DPI certification.",
        windowsRuntimeTested: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "Nine existing pages visually compared; 12 Linux zoom/size combinations passed.",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
