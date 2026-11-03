import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "focus-v4-ui-"));
const out = "docs/screenshots/forest-noir-v4";
const reports = "docs/reports/forest-noir-v4";
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(`${out}/details`, { recursive: true });
fs.mkdirSync("docs/motion/forest-noir-v4", { recursive: true });
fs.mkdirSync(reports, { recursive: true });
const errors = [],
  network = [],
  screenshots = [],
  workflows = [],
  geometry = [];
const state = (page) => page.evaluate(() => window.focusAPI.state());
const launch = async (concept, empty = false, dir) => {
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":102",
      FOCUS_DATA_DIR:
        dir ?? path.join(root, `${concept}-${empty ? "empty" : "populated"}`),
      FOCUS_DEMO: "1",
      FOCUS_HOME_CONCEPT: concept,
      FOCUS_DEMO_EMPTY: empty ? "1" : "0",
    },
  });
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(`${concept}: ${e}`));
  page.on("dialog", (dialog) => void dialog.accept());
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  await expect(page.getByTestId(`forest-concept-${concept}`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { app, page };
};
const size = async (app, width, height) =>
  app.evaluate(
    ({ BrowserWindow }, [w, h]) =>
      BrowserWindow.getAllWindows()[0].setContentSize(w, h),
    [width, height],
  );
const poll = (page, read) => expect.poll(async () => read(await state(page)));
try {
  for (const concept of ["A", "B", "C"]) {
    for (const empty of [false, true]) {
      const dir = path.join(
        root,
        `${concept}-${empty ? "empty" : "populated"}`,
      );
      const { app, page } = await launch(concept, empty, dir);
      try {
        await page.context().setOffline(true);
        await page.emulateMedia({ reducedMotion: "reduce" });
        const seeded = await state(page);
        expect(seeded.diagnostics.workspace).toBe("demo");
        expect(seeded.diagnostics.homeConcept).toBe(concept);
        await expect(page.locator(".demo-banner")).toContainText(
          "Изолированная",
        );
        if (empty) {
          expect(seeded.items).toHaveLength(0);
          expect(seeded.subjects).toHaveLength(0);
          await expect(page.getByTestId("efficiency-score")).toHaveText("—");
        } else {
          expect(seeded.subjects).toHaveLength(9);
          expect(seeded.groups).toHaveLength(4);
          expect(seeded.groups.flatMap((g) => g.values.flat())).toHaveLength(
            54,
          );
        }
        for (const [width, height] of [
          [1920, 1080],
          [1366, 768],
        ]) {
          await size(app, width, height);
          await page.waitForTimeout(500);
          const g = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
            overflow: document.documentElement.scrollWidth > window.innerWidth,
            panels: [...document.querySelectorAll(".fn-panel")].map((n) => {
              const r = n.getBoundingClientRect();
              return { x: r.x, width: r.width, right: r.right };
            }),
          }));
          expect(g.width).toBe(width);
          expect(g.height).toBe(height);
          expect(g.overflow).toBe(false);
          expect(g.panels.every((p) => p.x >= 0 && p.right <= width)).toBe(
            true,
          );
          geometry.push({ concept, empty, ...g });
          const file = `${out}/${concept}-${empty ? "empty" : "populated"}-${width}x${height}.png`;
          await page.screenshot({
            path: file,
            style: "* { caret-color:transparent !important }",
          });
          screenshots.push(file);
        }
        if (empty) {
          await page
            .locator(".fn-tasks .fn-empty")
            .getByRole("button", { name: "Добавить задачу", exact: true })
            .click();
          await page
            .getByLabel("Название", { exact: true })
            .fill(`Первый шаг ${concept}`);
          await page
            .getByRole("button", { name: "Сохранить", exact: true })
            .click();
          await poll(page, (s) =>
            s.items.some((i) => i.title === `Первый шаг ${concept}`),
          ).toBe(true);
          workflows.push(`${concept}: empty action creates a real task`);
        } else {
          await page.emulateMedia({ reducedMotion: "no-preference" });
          await page.locator(".fn-task-title").first().click();
          await expect(page.locator(".fn-sheet")).toBeVisible();
          const sheet = await page.locator(".fn-sheet").boundingBox();
          expect(sheet.width).toBeCloseTo(480, 1);
          await page
            .getByLabel("Название", { exact: true })
            .fill(`Редактирование ${concept}`);
          await page.screenshot({
            path: `${out}/details/${concept}-task-sheet.png`,
          });
          await page
            .getByRole("button", { name: "Сохранить", exact: true })
            .click();
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page
            .getByRole("button", {
              name: `Завершить Редактирование ${concept}`,
              exact: true,
            })
            .click();
          await poll(
            page,
            (s) =>
              s.items.find((i) => i.title === `Редактирование ${concept}`)
                ?.status,
          ).toBe("done");
          await page
            .getByRole("button", { name: "Отменить", exact: true })
            .click();
          await poll(
            page,
            (s) =>
              s.items.find((i) => i.title === `Редактирование ${concept}`)
                ?.status,
          ).not.toBe("done");
          await page
            .getByRole("button", {
              name: `Завершить Редактирование ${concept}`,
              exact: true,
            })
            .click();
          await page
            .getByRole("button", { name: "Скрыть уведомление", exact: true })
            .click();
          await page.locator(".fn-focus-action").click();
          await poll(page, (s) =>
            s.sessions.some((x) => x.state === "running"),
          ).toBe(true);
          await page.waitForTimeout(1200);
          await page.locator(".fn-focus-action").click();
          await poll(page, (s) =>
            s.sessions.some((x) => x.state === "paused"),
          ).toBe(true);
          await page
            .locator(".fn-focus")
            .getByRole("button", { name: "Завершить сессию", exact: true })
            .click();
          await poll(
            page,
            (s) => s.sessions.filter((x) => x.state === "done").length,
          ).toBe(8);
          await page.keyboard.press("Control+n");
          await page
            .getByLabel("Название", { exact: true })
            .fill(`Новая задача ${concept}`);
          await page
            .getByRole("button", { name: "Сохранить", exact: true })
            .click();
          await page.keyboard.press("Control+k");
          await expect(
            page.getByRole("combobox", { name: "Поиск и команды" }),
          ).toBeFocused();
          await page
            .getByRole("combobox", { name: "Поиск и команды" })
            .fill("плнрвщк");
          await expect(
            page.getByRole("option", { name: "Планировщик", exact: true }),
          ).toBeVisible();
          await page.screenshot({
            path: `${out}/details/${concept}-command-palette.png`,
          });
          await page.keyboard.press("Enter");
          await expect(
            page.getByRole("heading", { name: "Планировщик", exact: true }),
          ).toBeVisible();
          await expect(page.locator(".forest-shell")).toHaveCount(0);
          await page
            .getByRole("button", { name: "Главная", exact: true })
            .click();
          await page.keyboard.press("Control+k");
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page
            .getByRole("button", { name: "Без пейзажа", exact: true })
            .click();
          await expect(page.locator(".fn-home")).toHaveClass(/fn-plain/);
          await page
            .getByRole("button", { name: "Без пейзажа", exact: true })
            .click();
          await page
            .locator(".fn-chart-toolbar")
            .getByRole("button", { name: "Фокус", exact: true })
            .click();
          await expect(
            page.getByRole("group", { name: "Минуты фокуса за семь дней" }),
          ).toBeVisible();
          await page
            .locator(".fn-chart-toolbar")
            .getByRole("button", { name: "Задачи", exact: true })
            .click();
          const pageNames = [
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
          for (const name of pageNames) {
            await page.getByRole("button", { name, exact: true }).click();
            await expect(
              page.getByRole("heading", { name, exact: true }),
            ).toBeVisible();
            await expect(page.locator(".forest-shell")).toHaveCount(0);
          }
          const after = await state(page);
          expect(after.groups).toEqual(seeded.groups);
          expect(after.subjects).toEqual(seeded.subjects);
          expect(after.diagnostics.integrity).toBe("ok");
          workflows.push(
            `${concept}: task sheet/edit/save, completion/undo, Ctrl+N, focus start/pause/finish, fuzzy commands/Enter/Esc, plain scene, chart units, all 10 routes, unchanged 9/4/54 study`,
          );
        }
      } finally {
        await app.close();
      }
      // Verify the same database after a real process restart.
      const second = await launch(concept, empty, dir);
      try {
        const persisted = await state(second.page);
        if (empty) {
          expect(
            persisted.items.some((i) => i.title === `Первый шаг ${concept}`),
          ).toBe(true);
          expect(persisted.subjects).toHaveLength(0);
        } else {
          expect(
            persisted.items.some((i) => i.title === `Новая задача ${concept}`),
          ).toBe(true);
          expect(
            persisted.items.find((i) => i.title === `Редактирование ${concept}`)
              ?.status,
          ).toBe("done");
          expect(persisted.groups.flatMap((g) => g.values.flat())).toHaveLength(
            54,
          );
        }
        workflows.push(
          `${concept}: process restart preserves task changes and study`,
        );
      } finally {
        await second.app.close();
      }
    }
  }
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
  fs.writeFileSync(
    `${reports}/dashboard-e2e.json`,
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        windowsRuntimeTested: false,
        screenshots,
        workflows,
        geometry,
        rendererErrors: errors,
        externalRequests: network,
      },
      null,
      2,
    ),
  );
  console.log(
    `${screenshots.length} actual Electron screenshots; three functional variants passed offline with restart persistence.`,
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
