import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export { expect };
export const temp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
export const state = (p) => p.evaluate(() => window.focusAPI.state());
export const poll = (p, read) => expect.poll(async () => read(await state(p)));
export async function launch(dir, demo = false) {
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":102",
      FOCUS_DATA_DIR: dir,
      FOCUS_DEMO: demo ? "1" : "0",
      FOCUS_HOME_CONCEPT: demo ? "B" : "",
      FOCUS_DEMO_EMPTY: "0",
    },
  });
  const p = await app.firstWindow();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("dialog", (d) => void d.accept());
  await p.waitForFunction(() => !!window.focusAPI);
  const initial = await state(p);
  if (!demo && !initial.settings.onboarded) {
    const button = p.getByRole("button", {
      name: "Пустое пространство",
      exact: true,
    });
    await button.click();
  }
  await expect(
    p.getByRole("heading", { name: "Главная", exact: true }),
  ).toBeVisible();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1366, 768),
  );
  return {
    app,
    p,
    errors,
    nav: async (name) => {
      await p.locator("nav").getByRole("button", { name, exact: true }).click();
      await expect(p.getByRole("heading", { name, exact: true })).toBeVisible();
    },
  };
}
