import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = path.join(tmpdir(), "focus-backup-e2e");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const backup = path.join(dir, "test.zip");
const app = await electron.launch({
  args: [".", "--no-sandbox", "--disable-gpu"],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":99",
    FOCUS_DATA_DIR: dir,
  },
});
try {
  const page = await app.firstWindow();
  await page
    .getByRole("button", {
      name: "Импортировать учебный прогресс из примера",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
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
  const original = await page.evaluate(() => window.focusAPI.state());
  await page
    .getByRole("button", { name: "Создать ZIP-копию", exact: true })
    .click();
  await expect.poll(() => fs.existsSync(backup)).toBe(true);
  await page.evaluate(async () => {
    const state = await window.focusAPI.state();
    await window.focusAPI.command({
      type: "removeSubject",
      id: state.subjects[0].id,
    });
  });
  await page
    .getByRole("button", { name: "Восстановить ZIP", exact: true })
    .click();
  await expect
    .poll(async () => {
      return (await page.evaluate(() => window.focusAPI.state())).subjects
        .length;
    })
    .toBe(9);
  const restored = await page.evaluate(() => window.focusAPI.state());
  expect(restored.subjects).toEqual(original.subjects);
  expect(restored.groups).toEqual(original.groups);
  await page.screenshot({ path: "docs/screenshots/M5.png" });
  fs.writeFileSync(
    "docs/reports/M5-e2e.json",
    JSON.stringify({
      passed: true,
      checks: [
        "ZIP via desktop IPC",
        "remove subject",
        "restore confirmation (dialog stub)",
        "subjects and groups identical",
      ],
    }),
  );
  console.log("M5 backup/restore E2E passed");
} finally {
  await app.close();
}
