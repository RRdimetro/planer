// Optional Linux cross-build of the preview. Does NOT execute Windows.
// Reuses the previously verified Electron 39.8.10 x64 runtime without touching it.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const builder = require("electron-builder");
const lib = require.resolve("app-builder-lib", {
  paths: [require.resolve("electron-builder")],
});
const asar = require(require.resolve("@electron/asar", { paths: [lib] }));
const source = path.resolve("release/windows-cross/win-unpacked");
if (!fs.existsSync(path.join(source, "FOCUS OS PRO.exe")))
  throw Error(
    "Missing verified 0.2.0 Windows runtime; build normally on Windows instead.",
  );
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "focus-v4-win-"));
const runtime = path.join(temp, "win-unpacked");
const appRoot = path.join(temp, "app");
const hash = (b) => createHash("sha256").update(b).digest("hex");
try {
  fs.cpSync(source, runtime, { recursive: true, dereference: true });
  asar.extractAll(path.join(source, "resources/app.asar"), appRoot);
  for (const dir of ["dist", "dist-electron"]) {
    fs.rmSync(path.join(appRoot, dir), { recursive: true, force: true });
    fs.cpSync(dir, path.join(appRoot, dir), { recursive: true });
  }
  const archive = path.join(runtime, "resources/app.asar");
  fs.rmSync(archive);
  fs.rmSync(archive + ".unpacked", { recursive: true, force: true });
  await asar.createPackageWithOptions(appRoot, archive, {
    unpack: "**/*.node",
  });
  for (const file of [
    "dist/index.html",
    "dist-electron/main.cjs",
    "dist-electron/preload.cjs",
  ])
    assert.equal(
      hash(asar.extractFile(archive, file)),
      hash(fs.readFileSync(file)),
    );
  const native = path.join(
    runtime,
    "resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
  );
  assert.equal(fs.readFileSync(native).subarray(0, 2).toString(), "MZ");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const output = path.resolve("release/forest-noir-v4");
  const artifacts = await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(
      ["portable"],
      builder.Arch.x64,
    ),
    prepackaged: runtime,
    publish: "never",
    config: {
      ...pkg.build,
      electronVersion: "39.8.10",
      artifactName: "FOCUS_OS_PRO_Forest_Noir_V4_Preview_UNTESTED.exe",
      directories: { output },
      win: {
        target: ["portable"],
        icon: "build/icon.ico",
        signAndEditExecutable: false,
      },
      publish: [],
    },
  });
  const files = artifacts
    .filter((f) => f.endsWith(".exe"))
    .map((file) => ({
      file,
      size: fs.statSync(file).size,
      sha256: hash(fs.readFileSync(file)),
    }));
  fs.writeFileSync(
    "docs/reports/forest-noir-v4/windows-preview.json",
    JSON.stringify(
      {
        crossBuilt: true,
        windowsRuntimeTested: false,
        signed: false,
        host: process.platform,
        asarVerified: true,
        files,
      },
      null,
      2,
    ),
  );
  console.log(files);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
