import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = path.join(tmpdir(), "focus-ui-performance-v020");
fs.rmSync(dir, { recursive: true, force: true });
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
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  const start = Date.now();
  await page.evaluate(async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: globalThis.crypto.randomUUID(),
      kind: "task",
      title: "Performance task " + String(i + 1).padStart(4, "0"),
      createdAt: new Date().toISOString(),
    }));
    await window.focusAPI.command({ type: "saveMany", items });
  });
  await page.getByRole("button", { name: "Задачи", exact: true }).click();
  await expect(page.locator(".taskcard-pro")).toHaveCount(1000, {
    timeout: 10000,
  });
  const milliseconds = Date.now() - start;
  await page
    .getByPlaceholder("Поиск задач, тегов, описаний…")
    .fill("Performance task 0500");
  await expect(page.locator(".taskcard-pro")).toHaveCount(1);
  fs.writeFileSync(
    "docs/reports/0.2.0/05-performance-e2e.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        tasks: 1000,
        createAndRenderMilliseconds: milliseconds,
        filterWorked: true,
        windowsPerformanceTested: process.platform === "win32",
      },
      null,
      2,
    ),
  );
  console.log(
    "1000-task create/render/filter E2E passed in " + milliseconds + " ms",
  );
} finally {
  await app.close();
}
