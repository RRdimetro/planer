import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const lib = require.resolve("app-builder-lib", {
  paths: [require.resolve("electron-builder")],
});
const asar = require(require.resolve("@electron/asar", { paths: [lib] }));
const root = "release/windows-cross";
const unpacked = path.join(root, "win-unpacked");
const packagePath = path.join(unpacked, "resources/app.asar");
const hashBuffer = (b) => createHash("sha256").update(b).digest("hex");
const sha = (file) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(file);
    stream.on("data", (b) => hash.update(b));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
const pe = (file) => {
  const fd = fs.openSync(file, "r");
  try {
    const header = Buffer.alloc(65536);
    fs.readSync(fd, header, 0, header.length, 0);
    assert.equal(header.toString("ascii", 0, 2), "MZ");
    const offset = header.readUInt32LE(0x3c);
    assert.equal(header.toString("ascii", offset, offset + 4), "PE\0\0");
    return header.readUInt16LE(offset + 4);
  } finally {
    fs.closeSync(fd);
  }
};
const native = path.join(
  unpacked,
  "resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
);
assert.equal(pe(path.join(unpacked, "FOCUS OS PRO.exe")), 0x8664);
assert.equal(pe(native), 0x8664);
assert.equal(
  await sha(native),
  await sha(
    "/tmp/focus-win020/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
  ),
);
const packageJSON = JSON.parse(
  asar.extractFile(packagePath, "package.json").toString(),
);
assert.equal(packageJSON.version, "0.2.0");
assert.equal(
  hashBuffer(asar.extractFile(packagePath, "dist-electron/main.cjs")),
  hashBuffer(fs.readFileSync("dist-electron/main.cjs")),
);
assert.equal(
  hashBuffer(asar.extractFile(packagePath, "dist-electron/preload.cjs")),
  hashBuffer(fs.readFileSync("dist-electron/preload.cjs")),
);
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)],
    );
}
const assets = walk("dist");
for (const file of assets)
  assert.equal(
    hashBuffer(asar.extractFile(packagePath, file.split(path.sep).join("/"))),
    hashBuffer(fs.readFileSync(file)),
  );
const files = ["FOCUS OS PRO Setup 0.2.0.exe", "FOCUS OS PRO 0.2.0.exe"];
const artifacts = [];
for (const file of files) {
  const absolute = path.join(root, file);
  const bytes = fs.statSync(absolute).size;
  assert.ok(
    bytes > 50 * 1024 * 1024,
    "Installer/portable must contain the full app, not an intermediate helper",
  );
  artifacts.push({
    name: file,
    bytes,
    sha256: await sha(absolute),
    peMachine: pe(absolute),
  });
}
const result = {
  passed: true,
  host: process.platform,
  version: packageJSON.version,
  mainAndPreloadMatchFinalBuild: true,
  currentFrontendAssetsMatch: true,
  currentFrontendFiles: assets.length,
  windowsElectronMachine: "AMD64",
  windowsSQLiteMachine: "AMD64",
  sqliteExpectedElectronABI: 140,
  sqliteSha256: await sha(native),
  artifacts,
  windowsRuntimeTested: false,
  signed: false,
};
fs.writeFileSync(
  "docs/reports/0.2.0/05-artifacts.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
