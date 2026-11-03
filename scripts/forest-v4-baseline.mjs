import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-v4-baseline-"));
const out = "docs/screenshots/forest-noir-v4/before";
fs.mkdirSync(out, { recursive: true });
const app = await electron.launch({
  args: [".", "--no-sandbox", "--disable-gpu"],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":102",
    FOCUS_DATA_DIR: dir,
    FOCUS_DEMO: "1",
    FOCUS_HOME_CONCEPT: "",
  },
});
try {
  const page = await app.firstWindow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("heading", { name: "Главная", exact: true }),
  ).toBeVisible();
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, [w, h]) =>
        BrowserWindow.getAllWindows()[0].setContentSize(w, h),
      [width, height],
    );
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/home-${width}.png` });
  }
} finally {
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("Baseline: two real Electron Home screenshots saved.");
