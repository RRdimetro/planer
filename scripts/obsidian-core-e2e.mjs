import { launch, temp, state, poll, expect } from "./obsidian-harness.mjs";
import fs from "node:fs";
const dir = temp("focus-obs-core-");
let ui;
const checks = [];
try {
  ui = await launch(dir);
  const { p, nav } = ui;
  await p.keyboard.press("Control+n");
  await p.getByLabel("Название", { exact: true }).fill("Контроль Obsidian");
  await p.getByLabel("Дата", { exact: true }).fill("2026-11-03");
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await nav("Планировщик");
  await p.getByLabel("Дата календаря", { exact: true }).fill("2026-11-02");
  await p.getByRole("button", { name: "Событие", exact: true }).click();
  await p.getByLabel("Название", { exact: true }).fill("Повтор Obsidian");
  await p.getByLabel("Время", { exact: true }).fill("10:00");
  await p.getByLabel("Повтор события").selectOption("weekly");
  await p.getByLabel("Количество встреч").fill("3");
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await poll(
    p,
    (s) => s.items.filter((i) => i.title === "Повтор Obsidian").length,
  ).toBe(3);
  await p.getByRole("button", { name: "Список событий", exact: true }).click();
  await expect(p.locator(".obs-agenda-list")).toContainText("Повтор Obsidian");
  checks.push("materialized recurring events and agenda view");
  await nav("Задачи");
  await p.getByLabel("Вид задач").selectOption("week");
  await p.getByLabel("Неделя задач").fill("2026-11-02");
  const card = p.getByRole("button", {
    name: "Переместить Контроль Obsidian",
    exact: true,
  });
  const target = p.locator('[data-day="2026-11-04"]');
  await target.scrollIntoViewIfNeeded();
  await card.scrollIntoViewIfNeeded();
  const sourceBox = await card.boundingBox(),
    targetBox = await target.boundingBox();

  await p.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await p.mouse.down();
  await p.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2 + 8,
    { steps: 5 },
  );
  await p.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 40, {
    steps: 20,
  });
  await p.mouse.up();
  await poll(
    p,
    (s) => s.items.find((i) => i.title === "Контроль Obsidian")?.date,
  ).toBe("2026-11-04");
  await card.focus();
  await card.press("ArrowRight");
  await poll(
    p,
    (s) => s.items.find((i) => i.title === "Контроль Obsidian")?.date,
  ).toBe("2026-11-05");
  await card.focus();
  await card.press("ArrowLeft");
  await poll(
    p,
    (s) => s.items.find((i) => i.title === "Контроль Obsidian")?.date,
  ).toBe("2026-11-04");
  checks.push("weekly list and day drag");
  await p.getByLabel("Вид задач").selectOption("table");
  await p.evaluate(async () => {
    const s = await window.focusAPI.state();
    const original = s.items.find((i) => i.kind === "task");
    await window.focusAPI.command({
      type: "saveMany",
      items: Array.from({ length: 1000 }, (_, n) => ({
        ...original,
        id: window.crypto.randomUUID(),
        title: `Масштаб ${n}`,
        date: null,
        status: "backlog",
      })),
    });
  });
  await poll(p, (s) => s.items.filter((i) => i.kind === "task").length).toBe(
    1001,
  );
  await p.waitForTimeout(1800);
  expect(await p.locator(".obs-data-table tbody tr").count()).toBeLessThan(40);
  await p.locator(".obs-data-table").evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(
    p.getByRole("button", { name: "Масштаб 999", exact: true }),
  ).toBeVisible();
  checks.push("1001 records; bounded table DOM and last-row scrolling");
  await nav("Главная");
  await p.locator(".obs-widget-settings summary").click();
  await p.getByLabel("Показывать Проекты", { exact: true }).uncheck();
  await poll(p, (s) =>
    s.settings.obsidianWidgets?.hidden.includes("projects"),
  ).toBe(true);
  await p.getByLabel("Высота Сегодня", { exact: true }).selectOption("450");
  await poll(p, (s) => s.settings.obsidianWidgets?.sizes.tasks).toBe(450);
  await p.getByLabel("Ширина Сегодня", { exact: true }).selectOption("12");
  await poll(p, (s) => s.settings.obsidianWidgets?.widths.tasks).toBe(12);
  checks.push("widget visibility and dimensions persist through commands");
  await expect(p.locator('[data-widget="projects"]')).toHaveCount(0);
  await ui.app.close();
  ui = await launch(dir);
  const saved = await state(ui.p);
  expect(saved.settings.obsidianWidgets.hidden).toContain("projects");
  expect(saved.items.find((i) => i.title === "Контроль Obsidian").date).toBe(
    "2026-11-04",
  );
  expect(saved.eventOccurrences).toHaveLength(3);
  expect(saved.diagnostics.integrity).toBe("ok");
  checks.push("real restart persistence with v4 integrity");
  await ui.p.locator(".obs-widget-settings summary").click();
  await ui.p
    .getByRole("button", { name: "Сбросить композицию", exact: true })
    .click();
  await expect(ui.p.locator(".fn-custom-layout")).toHaveCount(0);
  await expect(ui.p.locator(".fn-panel")).toHaveCount(10);
  checks.push("reset restores approved B composition");
  expect(ui.errors).toEqual([]);
  fs.writeFileSync(
    "docs/reports/obsidian/B/e2e.json",
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
  console.log(checks);
} catch (e) {
  if (ui) {
    await ui.p.screenshot({ path: "/tmp/obsidian-core-failure.png" });
    console.log(
      "alerts",
      await ui.p.locator('[role="alert"]').allTextContents(),
    );
  }
  throw e;
} finally {
  if (ui) await ui.app.close().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
}
