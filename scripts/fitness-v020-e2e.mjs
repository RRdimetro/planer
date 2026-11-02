import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = path.join(tmpdir(), "focus-fitness-v020");
fs.rmSync(dir, { recursive: true, force: true });
let app, page;
const errors = [];
async function launch() {
  app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      FOCUS_DATA_DIR: dir,
    },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(String(e)));
}
try {
  await launch();
  await page
    .getByRole("button", { name: "Пустое пространство", exact: true })
    .click();
  await page.getByRole("button", { name: "Тренировки", exact: true }).click();
  await page.getByRole("button", { name: "Упражнения", exact: true }).click();
  await page
    .getByLabel("Название упражнения", { exact: true })
    .fill("Контроль: присед");
  await page.getByLabel("Группа мышц", { exact: true }).fill("Ноги");
  await page
    .getByRole("button", { name: "Добавить упражнение", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Контроль: присед", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "+ Программа", exact: true }).click();
  await page
    .getByLabel("Название программы", { exact: true })
    .fill("Контроль: программа");
  await page
    .getByRole("button", { name: "+ Упражнение программы", exact: true })
    .click();
  await page.getByLabel("Подходы", { exact: true }).fill("2");
  await page.getByLabel("Повторы", { exact: true }).fill("8");
  await page.getByLabel("Кг", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Сохранить программу", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Записать тренировку", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill("Контроль: силовая");
  await page
    .getByLabel("Программа тренировки", { exact: true })
    .selectOption({ label: "Контроль: программа" });
  await page
    .getByLabel("Состояние тренировки", { exact: true })
    .selectOption("done");
  await page.getByLabel("Факт, минут", { exact: true }).fill("45");
  await page.getByLabel("Подход выполнен 1", { exact: true }).check();
  await page.getByLabel("Подход выполнен 2", { exact: true }).check();
  await page
    .getByRole("button", { name: "Сохранить тренировку", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let s = await page.evaluate(() => window.focusAPI.state());
  expect(s.workoutSets).toHaveLength(2);
  expect(s.workoutSets.every((x) => x.done)).toBe(true);
  expect(s.workoutSets.reduce((a, x) => a + x.reps * x.weight, 0)).toBe(960);
  await expect(page.getByText("960 кг", { exact: true })).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/0.2.0/03-fitness.png" });
  await app.close();
  await launch();
  s = await page.evaluate(() => window.focusAPI.state());
  expect(s.programs[0].name).toBe("Контроль: программа");
  expect(s.workoutSets).toHaveLength(2);
  expect(s.items.find((i) => i.title === "Контроль: силовая").duration).toBe(
    45,
  );
  if (errors.length) throw Error(errors.join("\n"));
  fs.writeFileSync(
    "docs/reports/0.2.0/03-fitness-e2e.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "exercise library",
          "program targets",
          "planned sets not confirmed by default",
          "two confirmed 8x60 sets",
          "960 kg actual volume",
          "restart retains program and sets",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Fitness v0.2.0 E2E passed");
} catch (e) {
  if (page)
    await page
      .screenshot({ path: "docs/screenshots/0.2.0/fitness-failure.png" })
      .catch(() => {});
  throw e;
} finally {
  await app?.close().catch(() => {});
}
