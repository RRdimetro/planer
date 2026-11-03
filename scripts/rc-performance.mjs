import { _electron as electron, expect } from "@playwright/test";
import electronPath from "electron";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const phase = process.argv[2] ?? "baseline";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-rc-perf-"));
await build({
  entryPoints: ["scripts/rc-fixture.ts"],
  outfile: "release/rc-fixture.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
execFileSync(electronPath, ["release/rc-fixture.cjs", dir], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
});
const report = {
  phase,
  platform: process.platform,
  cpu: os.cpus()[0]?.model,
  fixture: {
    visibleTasks: 1000,
    historicalCompletions: 3000,
    sessions: 3000,
    directoryIsTemporary: true,
  },
  method:
    "fresh Electron processes, warm filesystem cache, Playwright/debug overhead included; all figures from this worker, not Windows",
  startup: [],
  routes: {},
  errors: [],
};
let app;
const ready = async (p) => {
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    () =>
      new Promise((r) =>
        window.requestAnimationFrame(() => window.requestAnimationFrame(r)),
      ),
  );
};
try {
  for (let run = 0; run < 3; run++) {
    const start = globalThis.performance.now();
    app = await electron.launch({
      args: [".", "--no-sandbox", "--disable-gpu"],
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY ?? ":102",
        FOCUS_DATA_DIR: dir,
        FOCUS_DEMO: "0",
        FOCUS_HOME_CONCEPT: "",
      },
    });
    const p = await app.firstWindow();
    p.on("pageerror", (e) => report.errors.push(String(e)));
    await expect(
      p.getByRole("heading", { name: "Главная", exact: true }),
    ).toBeVisible({ timeout: 120000 });
    await ready(p);
    report.startup.push(Math.round(globalThis.performance.now() - start));
    if (run < 2) {
      await app.close();
      app = null;
      continue;
    }
    const pages = [
      "Главная",
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
    for (const name of pages) {
      const before = globalThis.performance.now();
      await p.locator("nav").getByRole("button", { name, exact: true }).click();
      await expect(p.getByRole("heading", { name, exact: true })).toBeVisible();
      if (name === "Аналитика")
        await expect(p.locator(".obs-insights-grid")).toBeVisible({
          timeout: 120000,
        });
      if (name === "Задачи")
        await expect(p.locator(".obs-data-table")).toBeVisible();
      if (name === "Планировщик")
        await expect(
          p.locator(".timeline-grid,.monthgrid,.obs-agenda-list").first(),
        ).toBeVisible();
      await ready(p);
      report.routes[name] = Math.round(globalThis.performance.now() - before);
    }
    await p
      .locator("nav")
      .getByRole("button", { name: "Задачи", exact: true })
      .click();
    await expect(p.locator(".obs-data-table")).toBeVisible();
    report.tableRows = await p
      .locator(".obs-data-table tbody tr[aria-rowindex]")
      .count();
    const search = p.getByPlaceholder("Поиск задач, тегов, описаний…");
    if (await search.count()) {
      const before = globalThis.performance.now();
      await search.fill("0999");
      await expect(
        p.getByRole("button", { name: "Нагрузочная задача 0999", exact: true }),
      ).toBeVisible();
      await ready(p);
      report.searchMs = Math.round(globalThis.performance.now() - before);
    }
    report.memory = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((p) => ({ type: p.type, memory: p.memory })),
    );
    report.processWorkingSetMiB = Math.round(
      report.memory.reduce((a, p) => a + (p.memory?.workingSetSize ?? 0), 0) /
        1024,
    );
    report.sumOfProcessPeaksMiB = Math.round(
      report.memory.reduce(
        (n, p) => n + (p.memory?.peakWorkingSetSize ?? 0),
        0,
      ) / 1024,
    );
    const s = await p.evaluate(() => window.focusAPI.state());
    report.observed = {
      tasks: s.items.filter((t) => t.kind === "task").length,
      completions: s.completions.length,
      sessions: s.sessions.length,
      integrity: s.diagnostics.integrity,
    };
    await app.close();
    app = null;
  }
  report.startupMedianMs = [...report.startup].sort((a, b) => a - b)[1];
  report.passed =
    report.errors.length === 0 &&
    report.observed.tasks === 1000 &&
    report.tableRows < 50;
  fs.writeFileSync(
    `docs/reports/1.0-rc/performance/${phase}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app?.close().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
}
