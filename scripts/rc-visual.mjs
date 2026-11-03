import { launch, temp, expect } from "./obsidian-harness.mjs";
import fs from "node:fs";
const phase = process.argv[2] ?? "M2",
  folder = `docs/screenshots/1.0-rc/${phase}`,
  out = `docs/reports/1.0-rc/${phase}`;
fs.mkdirSync(folder, { recursive: true });
fs.mkdirSync(out, { recursive: true });
const names = [
  "Главная",
  "Планировщик",
  "Задачи",
  "Проекты",
  "Учёба",
  "Тренировки",
  "Аналитика",
  "Фокус",
  "Заметки",
  "Настройки",
];
const shots = [],
  contrasts = [],
  errors = [];
async function contrast(p, page) {
  return p.evaluate((page) => {
    const parse = (s) => {
      const m = s?.match(/^rgba?\(([^)]+)\)/);
      if (!m) return null;
      const a = m[1]
        .split(/[, /]+/)
        .filter(Boolean)
        .map(Number);
      return [a[0], a[1], a[2], a[3] ?? 1];
    };
    const mix = (a, b) =>
      a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
    const luminance = (c) =>
      c
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const walker = document.createTreeWalker(
      document.querySelector("main"),
      window.NodeFilter.SHOW_TEXT,
    );
    const failed = [],
      seen = new Set();
    let tested = 0,
      node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim(),
        el = node.parentElement;
      if (
        !text ||
        text.length < 2 ||
        !el ||
        el.closest('[aria-hidden="true"],:disabled') ||
        !el.getClientRects().length
      )
        continue;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden") continue;
      const chain = [];
      let ancestor = el,
        opacity = 1;
      while (ancestor) {
        chain.push(ancestor);
        opacity *= Number(window.getComputedStyle(ancestor).opacity);
        ancestor = ancestor.parentElement;
      }
      if (opacity < 0.01) continue;
      let bg = [8, 14, 11];
      let gradient = false;
      for (const a of chain.reverse()) {
        const st = window.getComputedStyle(a),
          c = parse(st.backgroundColor);
        if (c) bg = mix(c, bg);
        if (st.backgroundImage !== "none") gradient = true;
      }
      const fg = parse(
        el instanceof window.SVGElement ? style.fill : style.color,
      );
      if (!fg) continue;
      fg[3] *= opacity;
      const visible = mix(fg, bg),
        a = luminance(visible),
        b = luminance(bg),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const large =
        parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.66 &&
          Number(style.fontWeight) >= 700);
      tested++;
      const key = text.slice(0, 60) + style.color + style.fontSize;
      if (ratio < (large ? 3 : 4.5) && !seen.has(key)) {
        seen.add(key);
        failed.push({
          text: text.slice(0, 90),
          ratio: +ratio.toFixed(2),
          font: style.fontSize,
          color: style.color,
          background: bg.map(Math.round),
          gradient,
          class: el.className?.baseVal ?? el.className,
        });
      }
    }
    return {
      page,
      tested,
      failures: failed,
      method:
        "computed color/opacity and solid ancestor backgrounds; gradients require visual review; disabled/decorative text excluded",
    };
  }, page);
}
for (const demo of [true, false]) {
  const h = await launch(temp("focus-rc-visual-"), demo);
  const { p, app, nav } = h;
  try {
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.evaluate(() =>
      window.focusAPI.command({
        type: "settings",
        key: "animations",
        value: false,
      }),
    );
    for (const [w, height] of [
      [1366, 768],
      [1920, 1080],
      [2560, 1440],
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, [w, h]) =>
          BrowserWindow.getAllWindows()[0].setContentSize(w, h),
        [w, height],
      );
      await p.waitForFunction(
        ([w, h]) => window.innerWidth === w && window.innerHeight === h,
        [w, height],
      );
      for (let i = 0; i < 10; i++) {
        await nav(names[i]);
        await expect(
          p.getByText("Открываем раздел…", { exact: true }),
        ).toHaveCount(0, { timeout: 15000 });
        await p.waitForTimeout(260);
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow, `${names[i]} ${w}`).toBe(false);
        const file = `${demo ? "demo" : "empty"}-${i + 1}-${w}.png`;
        await p.screenshot({
          path: folder + "/" + file,
          style: "*{caret-color:transparent!important}",
        });
        shots.push({
          file,
          page: names[i],
          width: w,
          height,
          mode: demo ? "demo" : "empty",
          overflow,
        });
        if (w === 1366) {
          contrasts.push(await contrast(p, names[i]));
          const button = p.getByRole("button", {
            name: i === 0 ? "Новая задача" : "Добавить",
            exact: true,
          });
          await button.click();
          await expect(p.getByRole("dialog")).toBeVisible();
          await p.screenshot({
            path: `${folder}/${demo ? "demo" : "empty"}-${i + 1}-dialog.png`,
          });
          await p.keyboard.press("Escape");
          await expect(p.getByRole("dialog")).toHaveCount(0);
        }
      }
    }
    if (phase === "final" && demo) {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setContentSize(1366, 768),
      );
      for (const zoom of [1.25, 1.5]) {
        await app.evaluate(
          ({ BrowserWindow }, z) =>
            BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(z),
          zoom,
        );
        for (let i = 0; i < 10; i++) {
          await nav(names[i]);
          await expect(
            p.getByText("Открываем раздел…", { exact: true }),
          ).toHaveCount(0, { timeout: 15000 });
          await p.waitForTimeout(200);
          const overflow = await p.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          expect(overflow, `${names[i]} Electron zoom ${zoom}`).toBe(false);
          await p.screenshot({
            path: `${folder}/electron-zoom-${zoom}-${i + 1}.png`,
          });
          shots.push({
            page: names[i],
            electronZoom: zoom,
            windowsDPI: false,
            overflow,
          });
        }
      }
    }
    errors.push(...h.errors);
  } finally {
    await app.close();
  }
}
fs.writeFileSync(
  out + "/visual.json",
  JSON.stringify(
    {
      passed: !errors.length && !shots.some((s) => s.overflow),
      shots,
      errors,
      platform: process.platform,
      windowsTested: false,
    },
    null,
    2,
  ),
);
fs.writeFileSync(out + "/contrast.json", JSON.stringify(contrasts, null, 2));
console.log({
  screenshots: shots.length + 20,
  rendererErrors: errors,
  contrastFailures: contrasts.reduce((n, c) => n + c.failures.length, 0),
});
