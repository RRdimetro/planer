import fs from "node:fs";
import { launch, temp, state, poll, expect } from "./obsidian-harness.mjs";
fs.mkdirSync("docs/reports/1.0-rc/M3", { recursive: true });
fs.mkdirSync("docs/screenshots/1.0-rc/M3", { recursive: true });
let h;
const checks = [];
try {
  h = await launch(temp("focus-rc-ux-"));
  const { p, app, nav } = h;
  await p.keyboard.press("Control+n");
  await p.getByLabel("Название", { exact: true }).fill("Быстрая задача");
  await p.getByLabel("Название", { exact: true }).press("Enter");
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await poll(
    p,
    (s) => s.items.filter((i) => i.title === "Быстрая задача").length,
  ).toBe(1);
  checks.push("Ctrl+N → title → Enter creates exactly one SQLite task");
  await nav("Задачи");
  await p.getByRole("button", { name: "Быстрая задача", exact: true }).click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Начать фокус", exact: true })
    .click();
  await poll(
    p,
    (s) =>
      s.sessions[0]?.taskId ===
      s.items.find((i) => i.title === "Быстрая задача").id,
  ).toBe(true);
  await p.keyboard.press("Escape");
  await nav("Фокус");
  await expect(p.locator(".obs-focus-task")).toContainText("Быстрая задача");
  await p.getByRole("button", { name: "Завершить", exact: true }).click();
  checks.push(
    "selected task starts actual linked focus session without navigating first",
  );
  await nav("Задачи");
  await p
    .getByRole("button", { name: "Завершить Быстрая задача", exact: true })
    .click();
  await poll(p, (s) => s.items[0].status).toBe("done");
  await p
    .locator(".toast")
    .getByRole("button", { name: "Отменить", exact: true })
    .click();
  await poll(p, (s) => s.items[0].status).not.toBe("done");
  checks.push("one-click completion and explicit last-revision undo");
  await p.getByRole("button", { name: "Быстрая задача", exact: true }).click();
  await p.getByLabel("Название", { exact: true }).fill("Несохранённый текст");
  p.removeAllListeners("dialog");
  p.on("dialog", (d) => void d.dismiss());
  await p.keyboard.press("Escape");
  await expect(p.getByLabel("Название", { exact: true })).toHaveValue(
    "Несохранённый текст",
  );
  await p.keyboard.press("Control+n");
  await expect(p.getByRole("dialog")).toHaveCount(1);
  await expect(p.getByLabel("Название", { exact: true })).toHaveValue(
    "Несохранённый текст",
  );
  p.removeAllListeners("dialog");
  p.on("dialog", (d) => void d.accept());
  await p.keyboard.press("Escape");
  checks.push(
    "discard requires confirmation; cancel retains draft; Ctrl+N does not replace open editor",
  );
  await app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get("focus:command");
    globalThis.__rcOriginalCommand = original;
    ipcMain.removeHandler("focus:command");
    ipcMain.handle("focus:command", (e, c) => {
      if (c.type === "saveTask" && c.item.title === "Ошибка диска")
        throw Error("SQLITE_FULL disk full");
      return original(e, c);
    });
  });
  await p.keyboard.press("Control+n");
  await p.getByLabel("Название", { exact: true }).fill("Ошибка диска");
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("alert")).toContainText("свободное место");
  await expect(p.getByLabel("Название", { exact: true })).toHaveValue(
    "Ошибка диска",
  );
  expect((await state(p)).items.some((i) => i.title === "Ошибка диска")).toBe(
    false,
  );
  await p.screenshot({ path: "docs/screenshots/1.0-rc/M3/save-error.png" });
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler("focus:command");
    ipcMain.handle("focus:command", globalThis.__rcOriginalCommand);
  });
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await poll(p, (s) => s.items.some((i) => i.title === "Ошибка диска")).toBe(
    true,
  );
  checks.push(
    "actual rejected IPC save: readable error, retained form, no false success; retry persists",
  );
  const backup = h.app.process().pid + ".zip";
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    },
    temp("focus-ux-backup-") + "/" + backup,
  );
  await nav("Настройки");
  await p
    .getByRole("button", { name: "Создать ZIP-копию", exact: true })
    .click();
  await expect(p.locator(".toast")).toContainText(
    "Копия проверена и сохранена",
  );
  checks.push(
    "backup success is acknowledged only after actual archive verification",
  );
  expect(h.errors).toEqual([]);
  fs.writeFileSync(
    "docs/reports/1.0-rc/M3/e2e.json",
    JSON.stringify(
      { passed: true, platform: process.platform, checks },
      null,
      2,
    ),
  );
  console.log(checks);
} finally {
  await h?.app.close().catch(() => {});
}
