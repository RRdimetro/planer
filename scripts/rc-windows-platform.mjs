// Native Windows evidence only. Electron zoom/force-device-scale-factor cannot satisfy DPI checks.
import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
if (process.platform !== "win32") throw Error("Native Windows required");
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const executable =
  process.env.FOCUS_CURRENT_EXE ??
  JSON.parse(
    fs.readFileSync(
      "docs/reports/1.0-rc/windows/upgrade-0.3.0/result.json",
      "utf8",
    ),
  ).installedExecutable;
if (!executable) throw Error("Installed executable required");
const scale = Number(process.env.FOCUS_EXPECTED_NATIVE_SCALE ?? 1);
if (![1, 1.25, 1.5].includes(scale))
  throw Error("Expected native scale 1 / 1.25 / 1.5");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "focus-native-platform-"),
);
const output = "docs/reports/1.0-rc/windows";
fs.mkdirSync(output, { recursive: true });
let app;
const report = {
  platform: process.platform,
  os: os.release(),
  version,
  appPayloadSha256: createHash("sha256")
    .update(
      fs.readFileSync(
        path.join(path.dirname(executable), "resources/app.asar"),
      ),
    )
    .digest("hex"),
  requestedNativeScale: scale,
  passed: false,
  notifications: "not_confirmed",
  nativeDPI: "not_confirmed",
};
try {
  app = await electron.launch({
    executablePath: executable,
    args: ["--disable-gpu"],
    env: {
      ...process.env,
      FOCUS_DATA_DIR: directory,
      FOCUS_DEMO: "0",
      FOCUS_HOME_CONCEPT: "",
    },
  });
  const p = await app.firstWindow();
  await p
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  const native = await app.evaluate(({ app, BrowserWindow, screen }) => ({
    scale: screen.getPrimaryDisplay().scaleFactor,
    forcedScale: app.commandLine.hasSwitch("force-device-scale-factor"),
    handle: BrowserWindow.getAllWindows()[0]
      .getNativeWindowHandle()
      .readBigUInt64LE()
      .toString(),
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    abi: process.versions.modules,
  }));
  const dpi = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Add-Type 'using System;using System.Runtime.InteropServices;public class FocusDpi{[DllImport("user32.dll")]public static extern uint GetDpiForWindow(IntPtr hwnd);}';[FocusDpi]::GetDpiForWindow([IntPtr]${native.handle})`,
    ],
    { encoding: "utf8" },
  );
  expect(native.appVersion).toBe(version);
  report.native = { ...native, windowDPI: Number(dpi.stdout.trim()) };
  report.nativeDPI =
    !native.forcedScale &&
    native.scale === scale &&
    report.native.windowDPI === 96 * scale
      ? "passed"
      : "mismatch";
  report.sqliteIntegrity = (
    await p.evaluate(() => window.focusAPI.state())
  ).diagnostics.integrity;
  const body = "FOCUS OS PRO native notification " + Date.now();
  const shown = await app.evaluate(
    ({ Notification }, body) =>
      new Promise((resolve) => {
        if (!Notification.isSupported()) return resolve("unsupported");
        const n = new Notification({ title: "FOCUS OS PRO", body });
        n.on("show", () => resolve("show_event"));
        n.on("failed", () => resolve("failed"));
        n.show();
        setTimeout(() => resolve("no_event"), 8000);
      }),
    body,
  );
  report.notificationAPI = shown;
  const uia = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName UIAutomationClient;Add-Type -AssemblyName UIAutomationTypes;$c=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'${body}');$count=0;for($i=0;$i -lt 20;$i++){$focusToastNodes=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Descendants,$c);$count=@($focusToastNodes | Where-Object {-not $_.Current.IsOffscreen}).Count;if($count -gt 0){break};Start-Sleep -Milliseconds 250};$count`,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  report.visibleToastMatches = Number(uia.stdout.trim());
  report.notifications =
    shown === "show_event" && report.visibleToastMatches > 0
      ? "observed_native_toast"
      : "not_confirmed";
  report.passed =
    report.nativeDPI === "passed" &&
    report.notifications === "observed_native_toast" &&
    report.sqliteIntegrity === "ok";
  await p.screenshot({ path: `${output}/native-scale-${scale}.png` });
} finally {
  fs.writeFileSync(
    `${output}/native-platform-${scale}.json`,
    JSON.stringify(report, null, 2),
  );
  await app?.close().catch(() => {});
}
expect(
  report.passed,
  "Native DPI and visible toast evidence are mandatory; show() alone is insufficient",
).toBe(true);
