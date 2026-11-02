import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { seedDesignPreview } from "../packages/database/demo";
import { newItem } from "../packages/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("design preview populates only a distinct database, is labelled at main boundary and never overwrites existing demo edits", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-isolation-"));
  const user = new Store(join(dir, "user.db"));
  const note = newItem("note", "Existing real note");
  user.command({ type: "save", item: note });
  const original = user.dump(true);
  const demo = new Store(join(dir, "design-preview.db"));
  expect(() => seedDesignPreview(demo, "user" as "demo")).toThrow();
  seedDesignPreview(demo, "demo", "2026-11-02");
  expect(user.dump(true)).toBe(original);
  expect(user.state().items).toHaveLength(1);
  expect(demo.state().items.length).toBeGreaterThan(20);
  expect(demo.state().subjects).toHaveLength(9);
  expect(demo.state().groups.flatMap((g) => g.values.flat())).toHaveLength(54);
  const before = demo.dump(true);
  seedDesignPreview(demo, "demo", "2026-12-01");
  expect(demo.dump(true)).toBe(before);
  demo.close();
  user.close();
  rmSync(dir, { recursive: true });
});

test("demo backups cannot be restored into the user workspace, and legacy user copies stay compatible", async () => {
  const { backupArchive, restoreArchive } =
    await import("../packages/database/backup");
  const real = new Store(":memory:");
  const preview = new Store(":memory:");
  real.command({ type: "save", item: newItem("note", "Keep real") });
  seedDesignPreview(preview, "demo", "2026-11-02");
  const original = real.dump(true);
  const demoZip = backupArchive(preview, "demo");
  expect(() => restoreArchive(real, demoZip, "user")).toThrow();
  expect(real.dump(true)).toBe(original);
  const userZip = backupArchive(real, "user");
  expect(() => restoreArchive(preview, userZip, "demo")).toThrow();
  restoreArchive(preview, demoZip, "demo");
  expect(preview.state().subjects).toHaveLength(9);
  real.close();
  preview.close();
});
