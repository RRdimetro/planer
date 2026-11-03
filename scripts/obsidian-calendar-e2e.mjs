import fs from "node:fs";
const reportDir = process.env.FOCUS_RECHECK_DIR ?? "docs/reports/obsidian/F";
fs.mkdirSync(reportDir, { recursive: true });
import { launch, temp, state, poll, expect } from "./obsidian-harness.mjs";
let h;
const checks = [];
try {
  h = await launch(temp("focus-calendar-F-"));
  const { p, nav } = h;
  const id = await p.evaluate(async () => {
    const id = globalThis.crypto.randomUUID();
    await window.focusAPI.command({
      type: "save",
      item: {
        id,
        kind: "event",
        title: "Ночной блок",
        description: "",
        status: "week",
        priority: 2,
        estimate: 30,
        weight: 1,
        date: "2026-11-03",
        time: "02:15",
        due: null,
        projectId: null,
        category: "personal",
        tags: "",
        duration: 0,
        distance: null,
        data: "",
        createdAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      },
    });
    return id;
  });
  await nav("Планировщик");
  await p.getByLabel("Дата календаря", { exact: true }).fill("2026-11-03");
  await p.getByRole("button", { name: "День", exact: true }).click();
  await p.locator(".timeline-scroll").evaluate((e) => (e.scrollTop = 0));
  const block = p.locator(`.calendar-event[data-entity="${id}"]`);
  await expect(block).toBeVisible();
  await expect(block).toContainText("02:15");
  const resize = p.getByRole("button", {
    name: "Изменить длительность Ночной блок",
    exact: true,
  });
  await resize.focus();
  await resize.press("ArrowDown");
  await poll(p, (s) => s.items.find((i) => i.id === id).estimate).toBe(45);
  await resize.scrollIntoViewIfNeeded();
  const box = await resize.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 32, {
    steps: 10,
  });
  await p.mouse.up();
  await poll(p, (s) => s.items.find((i) => i.id === id).estimate).toBe(75);
  checks.push(
    "00–24h calendar actually shows 02:15 event; keyboard and real pointer resize persist 30→45→75 minutes",
  );
  await p.getByRole("button", { name: "Событие", exact: true }).click();
  await p.getByLabel("Название", { exact: true }).fill("Серия с ограничением");
  await p.getByLabel("Дата", { exact: true }).fill("2026-11-03");
  await p.getByLabel("Время", { exact: true }).fill("12:00");
  await p.getByLabel("Повтор события").selectOption("daily");
  await p.getByLabel("Интервал повторения событий").fill("2");
  await p.getByLabel("Последняя дата серии").fill("2026-11-07");
  await p.getByLabel("Количество встреч").fill("10");
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await poll(
    p,
    (s) => s.items.filter((i) => i.title === "Серия с ограничением").length,
  ).toBe(3);
  const dates = (await state(p)).items
    .filter((i) => i.title === "Серия с ограничением")
    .map((i) => i.date)
    .sort();
  expect(dates).toEqual(["2026-11-03", "2026-11-05", "2026-11-07"]);
  checks.push(
    "recurrence interval 2 and until date materialize exactly 3 events",
  );
  expect(h.errors).toEqual([]);
  fs.writeFileSync(
    `${reportDir}/calendar-e2e.json`,
    JSON.stringify(
      { passed: true, platform: process.platform, checks },
      null,
      2,
    ),
  );
  console.log(checks.join("\n"));
} catch (e) {
  await h?.p
    .screenshot({ path: `${reportDir}/calendar-failure.png` })
    .catch(() => {});
  throw e;
} finally {
  await h?.app.close().catch(() => {});
}
