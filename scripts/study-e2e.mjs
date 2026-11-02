import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = path.join(tmpdir(), "focus-study-e2e");
fs.rmSync(dir, { recursive: true, force: true });
async function launch() {
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      FOCUS_DATA_DIR: dir,
    },
  });
  return { app, page: await app.firstWindow() };
}
let { app, page } = await launch();
await page
  .getByRole("button", {
    name: "Импортировать учебный прогресс из примера",
    exact: true,
  })
  .click();
await page.getByRole("button", { name: "Учёба", exact: true }).click();
const cell = page.getByRole("button", {
  name: "Физика лабы №4 Защищена",
  exact: true,
});
await expect(cell).toHaveText("−");
await cell.click();
await expect(cell).toHaveText("✓");
await page.screenshot({ path: "docs/screenshots/M2.png" });
await app.close();
({ app, page } = await launch());
await page.getByRole("button", { name: "Учёба", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Физика лабы №4 Защищена", exact: true }),
).toHaveText("✓");
await expect(
  page.getByRole("button", { name: "Физика ДЗ №2 Защита теор", exact: true }),
).toHaveText("?");
await expect(
  page.getByRole("button", { name: "МД лабы №3 Выполнена", exact: true }),
).toHaveText("−");
await page
  .getByRole("button", { name: "Физика лабы №4 Защищена", exact: true })
  .click();
await expect(
  page.getByRole("button", { name: "Физика лабы №4 Защищена", exact: true }),
).toHaveText("−");
await app.close();
fs.writeFileSync(
  "docs/reports/M2-e2e.json",
  JSON.stringify({
    passed: true,
    checks: [
      "import",
      "toggle",
      "restart",
      "unknown vs not_done",
      "restore original status",
    ],
  }),
);
console.log("M2 Electron E2E passed");
