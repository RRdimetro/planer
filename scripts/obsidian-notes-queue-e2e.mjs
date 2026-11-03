// Real main IPC with deliberate save latency: older responses must not overwrite a newer draft.
import { launch, temp, expect } from "./obsidian-harness.mjs";
import fs from "node:fs";
let h;
try {
  h = await launch(temp("focus-note-queue-F-"));
  const { p, app, nav } = h;
  await nav("Заметки");
  await p.getByRole("button", { name: "+ Заметка", exact: true }).click();
  await app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get("focus:command");
    ipcMain.removeHandler("focus:command");
    ipcMain.handle("focus:command", async (e, c) => {
      if (c.type === "save" && c.item?.kind === "note")
        await new Promise((resolve) => setTimeout(resolve, 900));
      return original(e, c);
    });
  });
  await p.getByLabel("Текст заметки", { exact: true }).fill("Первая версия");
  await p.waitForTimeout(450);
  await p.getByLabel("Текст заметки", { exact: true }).fill("Вторая версия");
  await p
    .locator("nav")
    .getByRole("button", { name: "Задачи", exact: true })
    .click();
  await p.waitForTimeout(950);
  await expect(p.getByLabel("Текст заметки", { exact: true })).toHaveValue(
    "Вторая версия",
    { timeout: 100 },
  );
  await p
    .getByLabel("Текст заметки", { exact: true })
    .fill("Третья версия во время ожидания");
  await expect(
    p.getByRole("heading", { name: "Задачи", exact: true }),
  ).toBeVisible();
  await nav("Заметки");
  await expect(p.getByLabel("Текст заметки", { exact: true })).toHaveValue(
    "Третья версия во время ожидания",
  );
  fs.writeFileSync(
    "docs/reports/obsidian/F/notes-queue-e2e.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        checks: [
          "overlapping note saves with 900ms actual IPC latency preserve newer draft while navigation waits",
          "edit made while navigation waits is drained before leaving",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Queued note saves preserve latest draft");
} finally {
  await h?.app.close().catch(() => {});
}
