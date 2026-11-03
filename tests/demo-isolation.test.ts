import { test, expect } from "vitest";
import { Store } from "../packages/database";
import { seedDesignPreview } from "../packages/database/demo";
import { newItem } from "../packages/core";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

test("three concept databases persist independently and leave the closed user database byte-identical", () => {
  const dir = mkdtempSync(join(tmpdir(), "focus-three-concepts-"));
  const opened = new Set<Store>();
  const open = (file: string) => {
    const store = new Store(file);
    opened.add(store);
    return store;
  };
  const close = (store: Store) => {
    store.close();
    opened.delete(store);
  };
  try {
    const userPath = join(dir, "user.db");
    const user = open(userPath);
    user.command({ type: "importStudy" });
    const originalTask = newItem("task", "Существующая рабочая задача");
    user.command({ type: "save", item: originalTask });
    const group = user.state().groups[0];
    user.command({
      type: "stage",
      groupId: group.id,
      row: 2,
      column: 3,
      status: "done",
    });
    const userDump = user.dump(true);
    const studyValues = user.state().groups.map((g) => g.values);
    close(user);
    const originalBytes = readFileSync(userPath);

    const snapshots = new Map<string, string>();
    for (const concept of ["A", "B", "C"]) {
      const conceptDir = join(dir, concept);
      mkdirSync(conceptDir);
      const preview = open(join(conceptDir, "focus.db"));
      seedDesignPreview(preview, "demo", "2026-11-02");
      expect(preview.state().subjects).toHaveLength(9);
      expect(preview.state().groups).toHaveLength(4);
      expect(
        preview.state().groups.flatMap((g) => g.values.flat()),
      ).toHaveLength(54);
      preview.command({
        type: "save",
        item: newItem("task", `Сохранение только в концепции ${concept}`),
      });
      snapshots.set(concept, preview.dump(true));
      close(preview);
    }

    for (const concept of ["A", "B", "C"]) {
      const preview = open(join(dir, concept, "focus.db"));
      // A later launch must not reseed or overwrite the edited preview.
      seedDesignPreview(preview, "demo", "2027-01-01");
      expect(preview.dump(true)).toBe(snapshots.get(concept));
      expect(
        preview
          .state()
          .items.filter((item) => item.title.startsWith("Сохранение только"))
          .map((item) => item.title),
      ).toEqual([`Сохранение только в концепции ${concept}`]);
      expect(preview.state().diagnostics.integrity).toBe("ok");
      close(preview);
    }

    expect(readFileSync(userPath).equals(originalBytes)).toBe(true);
    const restoredUser = open(userPath);
    expect(restoredUser.dump(true)).toBe(userDump);
    expect(restoredUser.state().groups.map((g) => g.values)).toEqual(
      studyValues,
    );
    expect(restoredUser.state().items).toEqual([originalTask]);
    close(restoredUser);
  } finally {
    for (const store of opened) store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
