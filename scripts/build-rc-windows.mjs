// Optional cross-build. Static PE/ASAR checks do not certify Windows execution.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  builder = require("electron-builder");
const lib = require.resolve("app-builder-lib", {
  paths: [require.resolve("electron-builder")],
});
const asar = require(require.resolve("@electron/asar", { paths: [lib] }));
const PE = require(require.resolve("pe-library", { paths: [lib] })),
  Res = require(require.resolve("resedit", { paths: [lib] }));
const { WineVmManager } = require(path.join(path.dirname(lib), "vm/WineVm.js"));
const { UninstallerReader } = require(
  path.join(path.dirname(lib), "targets/nsis/nsisUtil.js"),
);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const [major, minor, patch] = pkg.version.split("-")[0].split(".").map(Number);
const revision = Number(pkg.version.match(/rc\.(\d+)$/)?.[1] ?? 0);
const original = WineVmManager.prototype.exec;
let extracted = false;
WineVmManager.prototype.exec = async function (
  file,
  args = [],
  options,
  ...rest
) {
  if (
    path.basename(file) === `FOCUS OS PRO Setup ${pkg.version}.exe` &&
    args.length === 0 &&
    options?.env?.__COMPAT_LAYER === "RunAsInvoker"
  ) {
    await UninstallerReader.exec(
      file,
      path.join(
        path.dirname(file),
        path.basename(file, "exe") + "__uninstaller.exe",
      ),
    );
    extracted = true;
    return "";
  }
  return original.call(this, file, args, options, ...rest);
};
const source = path.resolve("release/windows-cross/win-unpacked");
if (!fs.existsSync(path.join(source, "FOCUS OS PRO.exe")))
  throw Error(
    "Verified Electron 39.8.10 x64 Windows runtime missing. Run pnpm dist:win on Windows.",
  );
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "focus-rc-win-"));
const runtime = path.join(temp, "win-unpacked"),
  root = path.join(temp, "app");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const output = path.resolve("release/1.0-rc");
fs.mkdirSync(output, { recursive: true });
try {
  fs.cpSync(source, runtime, { recursive: true, dereference: true });
  asar.extractAll(path.join(source, "resources/app.asar"), root);
  for (const dir of ["dist", "dist-electron"]) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true });
    fs.cpSync(dir, path.join(root, dir), { recursive: true });
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(pkg, null, 2),
  );
  for (const file of fs.readdirSync(path.join(runtime, "locales")))
    if (!["ru.pak", "en-US.pak"].includes(file))
      fs.unlinkSync(path.join(runtime, "locales", file));
  const exe = path.join(runtime, "FOCUS OS PRO.exe");
  const image = PE.NtExecutable.from(fs.readFileSync(exe));
  const resources = PE.NtExecutableResource.from(image);
  const version = Res.Resource.VersionInfo.fromEntries(resources.entries)[0];
  version.setFileVersion(major, minor, patch, revision, 1033);
  version.setProductVersion(major, minor, patch, revision, 1033);
  version.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      FileDescription: "FOCUS OS PRO",
      ProductName: "FOCUS OS PRO",
      FileVersion: pkg.version,
      ProductVersion: pkg.version,
    },
  );
  version.outputToResourceEntries(resources.entries);
  resources.outputResource(image);
  fs.writeFileSync(exe, Buffer.from(image.generate()));
  const checked = PE.NtExecutableResource.from(
    PE.NtExecutable.from(fs.readFileSync(exe)),
  );
  assert.equal(
    Res.Resource.VersionInfo.fromEntries(checked.entries)[0].fixedInfo
      .fileVersionMS,
    major * 65536 + minor,
  );
  const archive = path.join(runtime, "resources/app.asar");
  fs.rmSync(archive);
  fs.rmSync(archive + ".unpacked", { recursive: true, force: true });
  await asar.createPackageWithOptions(root, archive, { unpack: "**/*.node" });
  let verified = 0;
  function walk(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel + "/");
      else {
        assert.equal(
          hash(asar.extractFile(archive, rel)),
          hash(fs.readFileSync(path.join(dir, entry.name))),
        );
        verified++;
      }
    }
  }
  for (const dir of ["dist", "dist-electron"]) walk(dir, dir + "/");
  assert.equal(
    JSON.parse(asar.extractFile(archive, "package.json")).version,
    pkg.version,
  );
  const native = fs.readFileSync(
    path.join(
      runtime,
      "resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    ),
  );
  assert.equal(native.subarray(0, 2).toString(), "MZ");
  const pe = native.readUInt32LE(0x3c);
  assert.equal(native.readUInt16LE(pe + 4), 0x8664);
  const files = await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(
      ["nsis", "portable"],
      builder.Arch.x64,
    ),
    prepackaged: runtime,
    publish: "never",
    config: {
      ...pkg.build,
      compression: "normal",
      electronVersion: "39.8.10",
      directories: { output },
      win: {
        target: ["nsis", "portable"],
        icon: "build/icon.ico",
        signAndEditExecutable: false,
      },
      publish: [],
    },
  });
  const artifacts = [];
  for (const file of files.filter((f) => f.endsWith(".exe"))) {
    const type = path.basename(file).includes("Setup") ? "Setup" : "Portable";
    const target = path.join(
      output,
      `FOCUS_OS_PRO_${pkg.version}_${type}_UNTESTED.exe`,
    );
    fs.renameSync(file, target);
    artifacts.push({
      file: path.basename(target),
      size: fs.statSync(target).size,
      sha256: hash(fs.readFileSync(target)),
    });
  }
  fs.writeFileSync(
    "docs/reports/1.0-rc/M5/windows-build.json",
    JSON.stringify(
      {
        crossBuilt: true,
        windowsRuntimeTested: false,
        signed: false,
        host: process.platform,
        compression: "normal",
        version: pkg.version,
        electron: "39.8.10",
        nativeSQLite: "12.11.1 / Electron ABI 140 / PE x64",
        nativeSha256: hash(native),
        verifiedAsarFiles: verified,
        peVersionPatched: true,
        uninstallerExtractedWithNativeReader: extracted,
        artifacts,
      },
      null,
      2,
    ),
  );
  console.log(artifacts);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
