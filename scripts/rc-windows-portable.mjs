// Actual NSIS portable launcher, not win-unpacked. Test real extracted application over CDP.
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
if (process.platform !== "win32") throw Error("Windows required");
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const executable = path.resolve(`release/FOCUS OS PRO ${version}.exe`);
if (!fs.existsSync(executable)) throw Error("Portable EXE missing");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "focus-portable-"));
fs.mkdirSync("docs/reports/1.0-rc/windows", { recursive: true });
let child, browser;
async function launch() {
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
  });
  child = spawn(executable, [`--remote-debugging-port=${port}`], {
    env: {
      ...process.env,
      FOCUS_DATA_DIR: directory,
      FOCUS_DEMO: "0",
      FOCUS_HOME_CONCEPT: "",
    },
    stdio: "ignore",
  });
  await expect
    .poll(
      async () => {
        try {
          return (await globalThis.fetch(`http://127.0.0.1:${port}/json/version`)).ok;
        } catch {
          return false;
        }
      },
      { timeout: 60000 },
    )
    .toBe(true);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const p = browser.contexts()[0].pages()[0];
  await p.waitForFunction(() => !!window.focusAPI);
  return p;
}
async function close(p) {
  const exit = new Promise((resolve) => child.once("exit", resolve));
  await p.evaluate(() => window.close()).catch(() => {});
  await Promise.race([
    exit,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(Error("Portable did not close gracefully")),
        15000,
      ),
    ),
  ]);
  await browser?.close().catch(() => {});
  browser = null;
  child = null;
}
try {
  let p = await launch();
  await p
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  await p.keyboard.press("Control+n");
  await p.getByLabel("Название", { exact: true }).fill("Portable persistence");
  await p.getByLabel("Название", { exact: true }).press("Enter");
  await expect(p.getByRole("dialog")).toHaveCount(0);
  expect(
    (await p.evaluate(() => window.focusAPI.state())).diagnostics.integrity,
  ).toBe("ok");
  await close(p);
  p = await launch();
  expect(
    (await p.evaluate(() => window.focusAPI.state())).items.some(
      (t) => t.title === "Portable persistence",
    ),
  ).toBe(true);
  await p.screenshot({ path: "docs/reports/1.0-rc/windows/portable.png" });
  await close(p);
  fs.writeFileSync(
    "docs/reports/1.0-rc/windows/portable.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        os: os.release(),
        version,
        executable,
        checks: [
          "actual portable self-extraction/launch",
          "empty first run",
          "task create/native SQLite",
          "graceful close and restart persistence",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close().catch(() => {});
  child?.kill();
}
