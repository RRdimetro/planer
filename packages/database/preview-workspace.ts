import fs from "node:fs";
import path from "node:path";
import type { HomeConcept } from "../core/design-preview";

/** Refuse an override aimed at an existing database that was not created for this preview. */
export function claimPreviewWorkspace(
  directory: string,
  concept: HomeConcept,
  empty: boolean,
) {
  const marker = path.join(directory, "forest-noir-preview.json");
  const expected = { version: 1, concept, empty };
  if (fs.existsSync(marker)) {
    const actual = JSON.parse(fs.readFileSync(marker, "utf8"));
    if (
      actual.version !== 1 ||
      actual.concept !== concept ||
      actual.empty !== empty
    )
      throw Error(
        "Для каждой концепции и пустого состояния нужна отдельная демо-база",
      );
    return;
  }
  if (fs.existsSync(path.join(directory, "focus.db")))
    throw Error(
      "Существующая база не отмечена как Forest Noir preview. Выберите новый каталог",
    );
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(marker, JSON.stringify(expected), { flag: "wx" });
}
