import fs from "node:fs";
import { launch, temp, state, expect } from "./obsidian-harness.mjs";
let h;
try {
  h = await launch(temp("focus-study-bind-F-"), true);
  const { p, nav } = h;
  const s = await state(p),
    g = s.groups[0],
    subject = s.subjects.find((x) => x.id === g.subjectId);
  await p.evaluate(
    async (g) =>
      window.focusAPI.command({
        type: "studyBinding",
        subjectId: g.subjectId,
        kind: "rk",
        groupId: g.id,
        stageRow: 0,
      }),
    g,
  );
  await nav("Учёба");
  await p
    .locator(".summary")
    .getByRole("button", { name: subject.name, exact: true })
    .click();
  await expect(p.getByLabel("РК написано", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(p.getByLabel("РК всего", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(p.getByLabel("ДЗ сдано", { exact: true })).not.toHaveAttribute(
    "readonly",
  );
  await expect(
    p.getByText(
      "Привязанные РК/ДЗ рассчитываются по выбранному этапу и доступны только для чтения. Источник можно изменить или отключить в редакторе группы.",
      { exact: true },
    ),
  ).toBeVisible();
  fs.writeFileSync(
    "docs/reports/obsidian/F/study-binding-e2e.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        checks: [
          "explicit binding computes aggregate and locks only its fields with source guidance",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Bound study aggregate read-only editor passed");
} finally {
  await h?.app.close().catch(() => {});
}
