import fs from "node:fs";
import { clearTimeout } from "node:timers";
import { spawn } from "node:child_process";
import electronPath from "electron";
import { launch, temp, state, poll, expect } from "./obsidian-harness.mjs";
const dir = temp("focus-desktop-F-");
let h;
const checks = [];
try {
  h = await launch(dir);
  let { p, app, nav } = h;
  await poll(p, (s) => !!s.settings.lastBackupPath).toBe(true);
  expect(fs.existsSync((await state(p)).settings.lastBackupPath)).toBe(true);
  await nav("Настройки");
  await p.getByLabel("Автоматические копии", { exact: true }).uncheck();
  await poll(p, (s) => s.settings.autoBackup).toBe(false);
  const file = dir + "/manual.zip";
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, file);
  await p
    .getByRole("button", { name: "Создать ZIP-копию", exact: true })
    .click();
  await expect.poll(() => fs.existsSync(file)).toBe(true);
  await p
    .getByRole("button", { name: "Проверить целостность SQLite", exact: true })
    .click();
  await p.evaluate(async () => {
    const id = globalThis.crypto.randomUUID();
    await window.focusAPI.command({ type: "folder", id, name: "Позже" });
  });
  await p
    .getByRole("button", { name: "Восстановить ZIP", exact: true })
    .click();
  await poll(p, (s) => s.noteFolders.length).toBe(0);
  expect(
    fs
      .readdirSync(dir + "/backups")
      .some((n) => n.startsWith("before-restore-")),
  ).toBe(true);
  checks.push(
    "automatic verified ZIP; manual ZIP/restore with pre-restore copy; actual integrity check",
  );
  const now = await p.evaluate(async () => {
    await window.focusAPI.command({
      type: "settings",
      key: "timezone",
      value: "UTC",
    });
    return new Date().toISOString();
  });
  const started = Date.now();
  await p.evaluate(async (_now) => {
    const stamp = new Date().toISOString();
    await window.focusAPI.command({
      type: "saveMany",
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: globalThis.crypto.randomUUID(),
        kind: "task",
        title:
          `Длинная запись ${String(i).padStart(4, "0")} — ` +
          "полный текст задачи с подробностями ".repeat((i % 5) + 1),
        description: "",
        status: "backlog",
        priority: 2,
        estimate: 30,
        weight: 1,
        date: null,
        time: null,
        due: null,
        projectId: null,
        category: "Тест",
        tags: "",
        duration: 0,
        distance: null,
        data: "",
        createdAt: stamp,
        completedAt: null,
        deletedAt: null,
      })),
    });
  }, now);
  await nav("Задачи");
  await p.getByLabel("Вид задач").selectOption("table");
  await expect(p.locator(".obs-data-table")).toBeVisible();
  expect(await p.locator(".obs-data-table tbody tr").count()).toBeLessThan(45);
  const last = (await state(p)).items.find((t) =>
    t.title.startsWith("Длинная запись 0999"),
  ).title;
  await p
    .locator(".obs-data-table")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    p.getByRole("button", { name: last, exact: true }),
  ).toBeVisible();
  await p.getByLabel("Вид задач").selectOption("kanban");
  expect(await p.locator(".taskcard").count()).toBeLessThan(45);
  await p
    .locator(".obs-virtual-cards")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    p.getByRole("button", { name: last, exact: true }),
  ).toBeVisible();
  checks.push(
    `1000 variable-height table/kanban records, bounded DOM, real last-row scroll (${Date.now() - started} ms)`,
  );
  await nav("Фокус");
  await p.getByLabel("Режим фокуса").selectOption("free");
  await p.getByRole("button", { name: "Начать фокус", exact: true }).click();
  await poll(p, (s) => s.sessions[0]?.seconds).toBeGreaterThanOrEqual(1);
  const second = spawn(electronPath, [".", "--no-sandbox", "--disable-gpu"], {
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":102",
      FOCUS_DATA_DIR: dir,
      FOCUS_DEMO: "0",
    },
    stdio: "ignore",
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      second.kill();
      reject(Error("second instance did not exit"));
    }, 15000);
    second.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(Error("second instance exit " + code));
    });
  });
  expect((await state(p)).sessions[0].state).toBe("running");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].minimize(),
  );
  const before = (await state(p)).sessions[0].seconds;
  await app.evaluate(() => {
    const until = globalThis.performance.now() + 4200;
    while (globalThis.performance.now() < until) {
      /* intentional blocked main to verify clock */
    }
  });
  await poll(p, (s) => s.sessions[0].seconds - before).toBeGreaterThanOrEqual(
    4,
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].restore(),
  );
  await p.getByRole("button", { name: "Завершить", exact: true }).click();
  checks.push(
    "single-instance lock preserves active session; minimized + 4.2 s busy main counted correctly",
  );
  // Observe notification requests; OS display delivery is platform-dependent and not certified here.
  await app.evaluate(({ Notification }) => {
    globalThis.__focusNotices = [];
    Notification.isSupported = () => true;
    Notification.prototype.show = function () {
      globalThis.__focusNotices.push({ title: this.title, body: this.body });
    };
  });
  await p.evaluate(async () => {
    const s = await window.focusAPI.state();
    const base = s.items[0];
    const stamp = new Date().toISOString();
    await window.focusAPI.command({
      type: "save",
      item: {
        ...base,
        id: globalThis.crypto.randomUUID(),
        title: "Локальное напоминание",
        date: stamp.slice(0, 10),
        time: stamp.slice(11, 16),
      },
    });
    await window.focusAPI.command({
      type: "settings",
      key: "notifications",
      value: true,
    });
  });
  await expect
    .poll(
      () =>
        app.evaluate(
          () =>
            globalThis.__focusNotices.filter((n) =>
              n.body.includes("Локальное напоминание"),
            ).length,
        ),
      { timeout: 20000 },
    )
    .toBe(1);
  await p.waitForTimeout(15500);
  expect(
    await app.evaluate(
      () =>
        globalThis.__focusNotices.filter((n) =>
          n.body.includes("Локальное напоминание"),
        ).length,
    ),
  ).toBe(1);
  checks.push(
    "background notification scheduling and persistent deduplication; request observed, OS delivery not asserted",
  );
  await app.close();
  h = await launch(dir);
  ({ p, app, nav } = h);
  expect((await state(p)).items).toHaveLength(1001);
  expect((await state(p)).sessions[0].state).toBe("done");
  expect((await state(p)).diagnostics.integrity).toBe("ok");
  expect(h.errors).toEqual([]);
  fs.writeFileSync(
    "docs/reports/obsidian/F/desktop-e2e.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        platform: process.platform,
        windowsTested: false,
      },
      null,
      2,
    ),
  );
  console.log(checks.join("\n"));
} catch (e) {
  await h?.p
    .screenshot({ path: "docs/reports/obsidian/F/desktop-failure.png" })
    .catch(() => {});
  throw e;
} finally {
  await h?.app.close().catch(() => {});
}
