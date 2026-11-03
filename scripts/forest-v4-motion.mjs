// Linux evidence recording of actual Electron interactions; no mock UI or generated frames.
import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-v4-motion-"));
const output = "docs/motion/forest-noir-v4/C-interactions.mp4";
fs.mkdirSync(path.dirname(output), { recursive: true });
const display = process.env.DISPLAY ?? ":102";
const app = await electron.launch({
  args: [".", "--no-sandbox", "--disable-gpu"],
  env: {
    ...process.env,
    DISPLAY: display,
    FOCUS_DATA_DIR: dir,
    FOCUS_DEMO: "1",
    FOCUS_HOME_CONCEPT: "C",
    FOCUS_DEMO_EMPTY: "0",
  },
});
let recorder, recording;
try {
  const page = await app.firstWindow();
  await expect(page.getByTestId("forest-concept-C")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setMenuBarVisibility(false);
    win.setContentSize(1366, 768);
    win.setPosition(0, 0);
    win.focus();
  });
  recorder = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "x11grab",
      "-framerate",
      "25",
      "-video_size",
      "1366x768",
      "-i",
      `${display}+0,0`,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      output,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let ffmpegErrors = "";
  recorder.stderr.on("data", (b) => {
    ffmpegErrors += b.toString();
  });
  recording = new Promise((resolve, reject) => {
    recorder.on("error", reject);
    recorder.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(ffmpegErrors)),
    );
  });
  await page.waitForTimeout(700);
  await page
    .getByRole("button", {
      name: "Завершить Уточнить структуру главной",
      exact: true,
    })
    .click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator(".fn-task-title").first().click();
  await expect(page.locator(".fn-sheet")).toBeVisible();
  await page.waitForTimeout(750);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "docs/screenshots/forest-noir-v4/details/command-center.png",
  });
  await page.getByRole("combobox", { name: "Поиск и команды" }).fill("плнрвщк");
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Планировщик", exact: true }),
  ).toBeVisible();
  const state = await page.evaluate(() => window.focusAPI.state());
  const event = state.items.find((i) => i.title === "Обсуждение проекта");
  const next = new Date(event.date + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const date = next.toISOString().slice(0, 10);
  const source = page
    .locator(".calendar-event")
    .filter({ hasText: event.title });
  const target = page.getByRole("button", {
    name: `Создать событие ${date} 10:00`,
    exact: true,
  });
  await target.scrollIntoViewIfNeeded();
  await source.dragTo(target);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.focusAPI.state())).items.find(
          (i) => i.id === event.id,
        )?.date,
    )
    .toBe(date);
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Главная", exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator(".fn-focus-action").click();
  await page.waitForTimeout(1400);
  await page.locator(".fn-focus-action").click();
  await page.waitForTimeout(700);
  await page
    .locator(".fn-focus")
    .getByRole("button", { name: "Завершить сессию", exact: true })
    .click();
  await page.waitForTimeout(500);
  recorder.stdin.write("q");
  await recording;
  recorder = undefined;
  const media = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=width,height,r_frame_rate",
        "-of",
        "json",
        output,
      ],
      { encoding: "utf8" },
    ),
  );
  fs.writeFileSync(
    "docs/reports/forest-noir-v4/motion.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        windowsRuntimeTested: false,
        file: output,
        actions: [
          "task completion and undo",
          "contextual task sheet",
          "command palette and fuzzy keyboard search",
          "navigation",
          "real calendar drag and persisted new date",
          "focus start/pause/finish",
        ],
        media,
        note: "25fps capture is video encoding, not a 60fps performance benchmark.",
      },
      null,
      2,
    ),
  );
  console.log(
    "Actual Electron motion recorded: task, sheet, commands, navigation, calendar drag, focus.",
  );
} finally {
  if (recorder) {
    recorder.stdin.write("q");
    await recording.catch(() => {});
  }
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
