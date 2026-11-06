// Must run on a real Windows CI runner. Never accepts a Linux/Wine result.
import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
if (process.platform !== "win32")
  throw Error("Windows installation smoke must run on Windows");
const baselineInstaller = process.env.FOCUS_BASELINE_INSTALLER;
const currentInstaller = process.env.FOCUS_CURRENT_INSTALLER;
if (!baselineInstaller || !currentInstaller)
  throw Error("Both real NSIS installers are required");
const root = path.join(os.tmpdir(), "focus-windows-install-030");
const installDir = path.join(root, "app");
const dataDir = path.join(root, "user-data");
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync("docs/screenshots/obsidian/F/windows", { recursive: true });
const backup = path.join(root, "backup-v030.zip");
const executable = path.join(installDir, "FOCUS OS PRO.exe");
const checks = [];
let app, page;
function install(file) {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `$p = Start-Process -FilePath '${file.replaceAll("'", "''")}' -ArgumentList '/S','/D=${installDir}' -Wait -PassThru; exit $p.ExitCode`,
    ],
    { stdio: "inherit", timeout: 180000 },
  );
  if (result.status !== 0) throw Error("NSIS install failed: " + result.status);
  if (!fs.existsSync(executable)) throw Error("Installed executable missing");
}
async function launch() {
  app = await electron.launch({
    executablePath: executable,
    args: ["--disable-gpu"],
    env: { ...process.env, FOCUS_DATA_DIR: dataDir, FOCUS_DEMO: "0" },
  });
  page = await app.firstWindow();
}
try {
  install(baselineInstaller);
  await launch();
  expect(await app.evaluate(({ app }) => app.getVersion())).toBe("0.1.0");
  await page
    .getByRole("button", {
      name: "Импортировать учебный прогресс из примера",
      exact: true,
    })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Задачи", exact: true })
    .click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page
    .getByLabel("Название", { exact: true })
    .fill("Windows upgrade persistence");
  await page.getByLabel("Статус", { exact: true }).selectOption("week");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Учёба", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Физика лабы №4 Защищена", exact: true })
    .click();
  const original = await page.evaluate(() => window.focusAPI.state());
  checks.push(
    "baseline 0.1.0 real NSIS install and first launch",
    "baseline task and study edit",
  );
  await app.close();
  app = null;
  install(currentInstaller);
  await launch();
  expect(await app.evaluate(({ app }) => app.getVersion())).toBe("0.3.0");
  let state = await page.evaluate(() => window.focusAPI.state());
  expect(state.diagnostics.version).toBe(6);
  expect(state.items).toEqual(original.items);
  expect(state.subjects).toEqual(original.subjects);
  expect(state.groups).toEqual(original.groups);
  expect(state.groups.flatMap((g) => g.values.flat())).toHaveLength(54);
  checks.push(
    "in-place NSIS update 0.1.0 → 0.3.0 preserves all original entities/subject IDs/statuses",
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Задачи", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Windows upgrade persistence", exact: true })
    .click();
  await page
    .getByLabel("Название", { exact: true })
    .fill("Windows task modified");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/obsidian/F/windows/tasks.png",
  });
  await page
    .locator("nav")
    .getByRole("button", { name: "Фокус", exact: true })
    .click();
  await page.getByRole("button", { name: "Начать фокус", exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  state = await page.evaluate(() => window.focusAPI.state());
  expect(state.sessions[0].seconds).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  checks.push("installed 0.3.0 task edit and focus timer");
  await app.close();
  app = null;
  await launch();
  state = await page.evaluate(() => window.focusAPI.state());
  expect(state.items.find((i) => i.kind === "task").title).toBe(
    "Windows task modified",
  );
  expect(state.sessions[0].state).toBe("done");
  checks.push("installed executable restart persistence");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    });
  }, backup);
  await page
    .locator("nav")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать ZIP-копию", exact: true })
    .click();
  await expect.poll(() => fs.existsSync(backup)).toBe(true);
  const before = await page.evaluate(() => window.focusAPI.state());
  await page.evaluate(async () => {
    const s = await window.focusAPI.state();
    await window.focusAPI.command({
      type: "remove",
      id: s.items.find((i) => i.kind === "task").id,
    });
  });
  await page
    .getByRole("button", { name: "Восстановить ZIP", exact: true })
    .click();
  await expect
    .poll(async () => {
      const s = await page.evaluate(() => window.focusAPI.state());
      return s.items.filter((i) => i.kind === "task").length;
    })
    .toBe(1);
  state = await page.evaluate(() => window.focusAPI.state());
  expect(state.items).toEqual(before.items);
  expect(state.groups).toEqual(before.groups);
  await page.screenshot({
    path: "docs/screenshots/obsidian/F/windows/backup.png",
  });
  checks.push(
    "installed executable real ZIP backup/delete/restore via IPC (dialog responses stubbed)",
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Учёба", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Физика лабы №4 Защищена", exact: true }),
  ).toHaveText("✓");
  await page.screenshot({
    path: "docs/screenshots/obsidian/F/windows/study.png",
  });
  await app.close();
  app = null;
  const uninstaller = path.join(installDir, "Uninstall FOCUS OS PRO.exe");
  if (!fs.existsSync(uninstaller)) throw Error("NSIS uninstaller missing");
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `$p=Start-Process -FilePath '${uninstaller.replaceAll("'", "''")}' -ArgumentList '/S' -Wait -PassThru; exit $p.ExitCode`,
    ],
    { stdio: "inherit", timeout: 120000 },
  );
  if (result.status !== 0) throw Error("NSIS uninstall failed");
  expect(fs.existsSync(path.join(dataDir, "focus.db"))).toBe(true);
  checks.push("uninstall retains separate user-data directory");
  fs.writeFileSync(
    "docs/reports/obsidian/F/windows-smoke.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        os: os.release(),
        baselineInstaller,
        currentInstaller,
        checks,
      },
      null,
      2,
    ),
  );
} finally {
  await app?.close().catch(() => {});
}
