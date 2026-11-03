// Real Windows only. Two separate baseline installers/data directories; no personal data.
import { _electron as electron, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
if (process.platform !== "win32") throw Error("Requires real Windows");
const baseline = process.env.FOCUS_BASELINE_INSTALLER,
  current = process.env.FOCUS_CURRENT_INSTALLER,
  version = process.env.FOCUS_BASELINE_VERSION;
if (!baseline || !current || !["0.2.0", "0.3.0"].includes(version))
  throw Error("Actual baseline/current installers required");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-rc-upgrade-")),
  installation = path.join(dir, "app"),
  data = path.join(dir, "data");
const output = `docs/reports/1.0-rc/windows/upgrade-${version}`;
fs.mkdirSync(output, { recursive: true });
let app;
function install(file) {
  const r = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `$p=Start-Process -FilePath '${file.replaceAll("'", "''")}' -ArgumentList '/S','/D=${installation}' -Wait -PassThru; exit $p.ExitCode`,
    ],
    { stdio: "inherit", timeout: 180000 },
  );
  if (r.status !== 0) throw Error("NSIS install failed " + r.status);
}
async function launch() {
  app = await electron.launch({
    executablePath: path.join(installation, "FOCUS OS PRO.exe"),
    args: ["--disable-gpu"],
    env: {
      ...process.env,
      FOCUS_DATA_DIR: data,
      FOCUS_DEMO: "0",
      FOCUS_HOME_CONCEPT: "",
    },
  });
  const p = await app.firstWindow();
  p.on("dialog", (d) => void d.accept());
  await p.waitForFunction(() => !!window.focusAPI);
  return p;
}
try {
  install(baseline);
  let p = await launch();
  expect(await app.evaluate(({ app }) => app.getVersion())).toBe(version);
  await p
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  await p.evaluate(async () => {
    await window.focusAPI.command({ type: "importStudy" });
    const s = await window.focusAPI.state();
    await window.focusAPI.command({
      type: "stage",
      groupId: s.groups[0].id,
      row: 0,
      column: 0,
      status: "unknown",
    });
    const id = globalThis.crypto.randomUUID();
    await window.focusAPI.command({
      type: "save",
      item: {
        id,
        kind: "task",
        title: "Windows baseline task",
        description: "Upgrade fixture",
        status: "week",
        priority: 2,
        estimate: 45,
        weight: 1,
        date: "2026-11-03",
        time: "10:00",
        due: "2026-11-04",
        projectId: null,
        category: "Test",
        tags: "migration",
        duration: 0,
        distance: null,
        data: "",
        createdAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      },
    });
  });
  const original = await p.evaluate(() => window.focusAPI.state());
  await app.close();
  app = null;
  install(current);
  p = await launch();
  const expected = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
  expect(await app.evaluate(({ app }) => app.getVersion())).toBe(expected);
  let s = await p.evaluate(() => window.focusAPI.state());
  expect(s.items).toEqual(original.items);
  expect(s.subjects).toEqual(original.subjects);
  expect(s.groups).toEqual(original.groups);
  expect(s.groups.flatMap((g) => g.values.flat())).toHaveLength(54);
  expect(s.diagnostics.integrity).toBe("ok");
  await p
    .locator("nav")
    .getByRole("button", { name: "Задачи", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Windows baseline task", exact: true })
    .click();
  await p.getByLabel("Название", { exact: true }).fill("Windows task edited");
  await p.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p
    .getByRole("button", { name: "Завершить Windows task edited", exact: true })
    .click();
  await p
    .locator("nav")
    .getByRole("button", { name: "Фокус", exact: true })
    .click();
  await p.getByRole("button", { name: "Начать фокус", exact: true }).click();
  const before = (await p.evaluate(() => window.focusAPI.state())).sessions[0]
    .seconds;
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].minimize(),
  );
  await expect
    .poll(
      async () =>
        (await p.evaluate(() => window.focusAPI.state())).sessions[0].seconds,
      { timeout: 10000 },
    )
    .toBeGreaterThan(before + 2);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].restore(),
  );
  await p.getByRole("button", { name: "Завершить", exact: true }).click();
  const backup = path.join(dir, "backup.zip");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, backup);
  await p.evaluate(() =>
    window.focusAPI.command({ type: "file", action: "backup" }),
  );
  const kept = await p.evaluate(() => window.focusAPI.state());
  await p.evaluate(async () => {
    const s = await window.focusAPI.state();
    await window.focusAPI.command({
      type: "remove",
      id: s.items.find((t) => t.kind === "task").id,
    });
    await window.focusAPI.command({ type: "file", action: "restore" });
  });
  expect((await p.evaluate(() => window.focusAPI.state())).items).toEqual(
    kept.items,
  );
  await app.close();
  app = null;
  p = await launch();
  s = await p.evaluate(() => window.focusAPI.state());
  expect(s.items.find((t) => t.title === "Windows task edited").status).toBe(
    "done",
  );
  expect(s.sessions[0].state).toBe("done");
  expect(s.groups).toEqual(original.groups);
  await p.screenshot({ path: output + "/restart.png" });
  fs.writeFileSync(
    output + "/result.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        os: os.release(),
        installedExecutable: path.join(installation, "FOCUS OS PRO.exe"),
        baselineVersion: version,
        currentVersion: expected,
        checks: [
          "real NSIS installation",
          "empty first launch",
          "in-place update preserves every item/9 subjects/4 groups/54 statuses",
          "task edit/complete",
          "minimized timer",
          "real ZIP backup/restore with native dialog responses supplied by test",
          "real process restart",
        ],
        osNotifications: "not_tested_by_this_script",
        nativeDPI: "not_tested_by_this_script",
      },
      null,
      2,
    ),
  );
} finally {
  await app?.close().catch(() => {});
}
