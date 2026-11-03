import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { launch, temp, state, poll, expect } from "./obsidian-harness.mjs";
const dir = temp("focus-obsidian-D-");
let h;
const checks = [];
try {
  h = await launch(dir);
  let { p, app, nav } = h;
  await nav("Заметки");
  await p.getByRole("button", { name: "+ Заметка", exact: true }).click();
  await p.getByLabel("Название заметки", { exact: true }).fill("База знаний");
  await p.getByLabel("Текст заметки", { exact: true }).fill("Первая версия");
  await nav("Задачи");
  await nav("Заметки");
  await expect(p.getByLabel("Текст заметки", { exact: true })).toHaveValue(
    "Первая версия",
  );
  // Native prompt handler is already accepting; create folder with real validated command then assign via UI.
  const folder = randomUUID();
  await p.evaluate(
    async (id) =>
      window.focusAPI.command({ type: "folder", id, name: "Исследования" }),
    folder,
  );
  await expect(p.getByLabel("Папка заметки")).toContainText("Исследования", {
    timeout: 7000,
  });
  await p.getByLabel("Папка заметки").selectOption(folder);
  await poll(p, (s) => Object.values(s.noteMembership ?? {})[0]).toBe(folder);
  const a = (await state(p)).items.find((i) => i.kind === "note");
  await p.getByRole("button", { name: "+ Заметка", exact: true }).click();
  await p
    .getByLabel("Название заметки", { exact: true })
    .fill("Вторая заметка");
  await p.getByLabel("Вставить ссылку на заметку").selectOption(a.id);
  await p.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await p
    .locator(".markdown")
    .getByRole("button", { name: "База знаний", exact: true })
    .click();
  await expect(p.getByLabel("Название заметки", { exact: true })).toHaveValue(
    "База знаний",
  );
  await expect(
    p
      .locator(".notesgrid")
      .getByRole("button", { name: "Вторая заметка", exact: true }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Редактор", exact: true }).click();
  await p.getByLabel("Текст заметки", { exact: true }).fill("Вторая версия");
  await poll(p, (s) => s.items.find((n) => n.id === a.id)?.description).toBe(
    "Вторая версия",
  );
  await p.locator(".obs-history summary").click();
  await p
    .getByRole("button", { name: "Восстановить версию", exact: true })
    .nth(1)
    .click();
  await expect(p.getByLabel("Текст заметки", { exact: true })).toHaveValue(
    "Первая версия",
  );
  // Attach a real PNG via the native file handler; local preview uses validated bytes over IPC.
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [
        process.cwd() + "/docs/screenshots/obsidian/A/demo-1-1366.png",
      ],
    });
  });
  await p.getByRole("button", { name: "Прикрепить файл", exact: true }).click();
  await expect(p.locator(".obs-note-attachment img")).toBeVisible();
  await p
    .getByRole("button", { name: "Вставить в текст", exact: true })
    .click();
  await p.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(p.locator(".markdown img")).toBeVisible();
  checks.push(
    "notes immediate navigation flush, folders, Markdown internal link/backlink, restore as new version, actual local PNG attachment",
  );
  await nav("Фокус");
  await p.getByLabel("Режим фокуса").selectOption("break");
  await p.getByLabel("Длительность фокуса").fill("2");
  await p.getByRole("button", { name: "Начать перерыв", exact: true }).click();
  await poll(p, (s) => s.sessions[0]?.kind).toBe("break");
  await nav("Главная");
  await poll(p, (s) => s.sessions[0]?.seconds).toBeGreaterThanOrEqual(2);
  await nav("Фокус");
  await p.getByRole("button", { name: "Завершить", exact: true }).click();
  await p.getByLabel("Режим фокуса").selectOption("free");
  await p.getByRole("button", { name: "Начать фокус", exact: true }).click();
  await poll(p, (s) => s.sessions[1]?.seconds).toBeGreaterThanOrEqual(2);
  await p.getByRole("button", { name: "Пауза", exact: true }).click();
  const paused = (await state(p)).sessions[1].seconds;
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].minimize(),
  );
  await p.waitForTimeout(1200);
  expect((await state(p)).sessions[1].seconds).toBe(paused);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].restore(),
  );
  await p.getByRole("button", { name: "Продолжить", exact: true }).click();
  await poll(p, (s) => s.sessions[1]?.seconds).toBeGreaterThan(paused);
  await p.getByRole("button", { name: "Полноэкранный фокус" }).click();
  expect(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isFullScreen(),
    ),
  ).toBe(true);
  await p.getByRole("button", { name: "Полноэкранный фокус" }).click();
  checks.push(
    "break/free timers, navigation, pause/minimize/resume, real fullscreen",
  );
  await nav("Заметки");
  await p
    .getByLabel("Название заметки", { exact: true })
    .fill("Перед закрытием");
  await app.close();
  h = await launch(dir);
  ({ p, app, nav } = h);
  await nav("Заметки");
  expect(
    (await state(p)).items.some((n) => n.title === "Перед закрытием"),
  ).toBe(true);
  expect((await state(p)).sessions[1].state).toBe("interrupted");
  checks.push(
    "immediate graceful close retains note; running timer reopens interrupted",
  );
  expect(h.errors).toEqual([]);
  fs.writeFileSync(
    process.env.FOCUS_RECHECK_DIR
      ? `${process.env.FOCUS_RECHECK_DIR}/lifestyle-e2e.json`
      : "docs/reports/obsidian/D/e2e.json",
    JSON.stringify(
      { passed: true, checks, platform: process.platform },
      null,
      2,
    ),
  );
  console.log(checks.join("\n"));
} catch (e) {
  await h?.p
    .screenshot({ path: "docs/reports/obsidian/D/failure.png" })
    .catch(() => {});
  throw e;
} finally {
  await h?.app.close().catch(() => {});
}
