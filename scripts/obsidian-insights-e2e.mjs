import fs from "node:fs";
import { launch, temp, state, expect } from "./obsidian-harness.mjs";
let h;
try {
  h = await launch(temp("focus-insights-"), true);
  const { p, nav } = h;
  await nav("Аналитика");
  await expect(
    p.getByText("От наблюдений к решениям.", { exact: true }),
  ).toBeVisible();
  await expect(
    p.locator(".obs-insights-grid .recharts-surface").first(),
  ).toBeVisible();
  const before = await state(p);
  const project = before.items.find((i) => i.kind === "project");
  await p
    .getByLabel("Проект аналитики", { exact: true })
    .selectOption(project.id);
  await expect(p.locator(".obs-project-progress")).toHaveCount(1);
  await expect(p.locator(".obs-project-progress")).toContainText(project.title);
  await p.getByLabel("Период аналитики", { exact: true }).selectOption("7");
  await expect(p.locator(".obs-heatmap span")).toHaveCount(7);
  await p
    .getByLabel("Категория аналитики", { exact: true })
    .selectOption({ index: 1 });
  await expect(p.locator(".obs-score-pair")).toBeVisible();
  await p.getByLabel("Аналитика с", { exact: true }).fill("2020-01-01");
  await expect(p.getByRole("alert")).toContainText("366");
  await expect(p.locator(".obs-insights-grid")).toHaveCount(0);
  expect((await state(p)).revision).toBe(before.revision);
  expect(h.errors).toEqual([]);
  fs.writeFileSync(
    process.env.FOCUS_RECHECK_DIR
      ? `${process.env.FOCUS_RECHECK_DIR}/insights-e2e.json`
      : "docs/reports/obsidian/E/e2e.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        checks: [
          "real charts and score rings",
          "project/category and period filters",
          "7 actual heatmap dates",
          "invalid oversized range handled",
          "read-only analytics does not mutate SQLite",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Insights Electron filters and real charts passed");
} finally {
  await h?.app.close().catch(() => {});
}
