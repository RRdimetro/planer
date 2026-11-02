import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = path.join(tmpdir(), "focus-packaged-smoke");
fs.rmSync(dir, { recursive: true, force: true });
const app = await electron.launch({
  executablePath: "release/linux-unpacked/focus-os-pro",
  args: ["--no-sandbox", "--disable-gpu"],
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
  await expect(
    page.getByRole("heading", { name: "Главная", exact: true }),
  ).toBeVisible();
  const sandbox = await page.evaluate(() => ({
    require: typeof globalThis.require,
    nodeProcess: typeof globalThis.process,
    api: Object.keys(window.focusAPI),
  }));
  expect(sandbox.require).toBe("undefined");
  expect(sandbox.nodeProcess).toBe("undefined");
  expect(sandbox.api.sort()).toEqual(["command", "state"]);
  const state = await page.evaluate(() => window.focusAPI.state());
  expect(state.diagnostics.integrity).toBe("ok");
  await page.screenshot({ path: "docs/screenshots/packaged-linux.png" });
  fs.writeFileSync(
    "docs/reports/packaged-linux.json",
    JSON.stringify({
      passed: true,
      sandbox,
      integrity: state.diagnostics.integrity,
    }),
  );
  console.log("Packaged Linux Electron + native SQLite smoke passed");
} finally {
  await app.close();
}
