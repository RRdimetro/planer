import { _electron as electron } from "@playwright/test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const app = await electron.launch({
  args: [".", "--no-sandbox", "--disable-gpu"],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":99",
    FOCUS_DATA_DIR: path.join(
      tmpdir(),
      "focus-capture-" + (process.argv[2] ?? "M0"),
    ),
  },
});
const page = await app.firstWindow();
await page.waitForTimeout(1200);
await page.screenshot({
  path: `docs/screenshots/${process.argv[2] ?? "M0"}.png`,
});
fs.writeFileSync(
  "docs/reports/runtime.txt",
  await page.locator("body").innerText(),
);
await app.close();
