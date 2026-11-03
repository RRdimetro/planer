// Inspect the actual embedded payloads. This never executes a Windows binary.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  lib = require.resolve("app-builder-lib", {
    paths: [require.resolve("electron-builder")],
  });
const asar = require(require.resolve("@electron/asar", { paths: [lib] })),
  PE = require(require.resolve("pe-library", { paths: [lib] })),
  Res = require(require.resolve("resedit", { paths: [lib] }));
const tool =
  process.env.FOCUS_7ZA ??
  "/home/agent/.cache/electron-builder/7zip@1.0.0/7zip-linux-x64-16wjr/bin/7za";
const root = path.resolve("release/obsidian"),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "focus-final-payload-"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const paths = (file) =>
  execFileSync(tool, ["l", "-slt", file], { encoding: "utf8" })
    .split("\n")
    .filter((l) => l.startsWith("Path = "))
    .map((l) => l.slice(7).trim());
const extract = (file, entry) =>
  execFileSync(tool, ["e", "-so", file, entry], {
    maxBuffer: 512 * 1024 * 1024,
  });
const artifacts = [];
try {
  for (const kind of ["Setup", "Portable"]) {
    const file = path.join(root, `FOCUS_OS_PRO_0.3.0_${kind}_UNTESTED.exe`),
      entries = paths(file);
    const payloadEntry = entries.find((p) => p.endsWith("app-64.7z"));
    assert.ok(payloadEntry, kind + " actual embedded payload required");
    const payload = path.join(temp, kind + ".7z");
    fs.writeFileSync(payload, extract(file, payloadEntry));
    const payloadPaths = paths(payload);
    const match = (relative) => {
      const found = payloadPaths.find(
        (p) => p.replaceAll("\\", "/") === relative,
      );
      assert.ok(found, "Missing " + relative);
      return found;
    };
    const archive = path.join(temp, kind + ".asar");
    fs.writeFileSync(archive, extract(payload, match("resources/app.asar")));
    const pkg = JSON.parse(asar.extractFile(archive, "package.json"));
    assert.equal(pkg.version, "0.3.0");
    let count = 0;
    function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) walk(rel);
        else {
          assert.equal(
            hash(asar.extractFile(archive, rel.replaceAll(path.sep, "/"))),
            hash(fs.readFileSync(rel)),
            kind + " " + rel,
          );
          count++;
        }
      }
    }
    walk("dist");
    walk("dist-electron");
    const native = extract(
      payload,
      match(
        "resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
      ),
    );
    assert.equal(native.toString("ascii", 0, 2), "MZ");
    assert.equal(native.readUInt16LE(native.readUInt32LE(0x3c) + 4), 0x8664);
    assert.ok(native.includes(Buffer.from("node_register_module_v140")));
    const executable = extract(payload, match("FOCUS OS PRO.exe"));
    assert.equal(
      executable.readUInt16LE(executable.readUInt32LE(0x3c) + 4),
      0x8664,
    );
    const resource = PE.NtExecutableResource.from(
      PE.NtExecutable.from(executable),
    );
    assert.equal(
      Res.Resource.VersionInfo.fromEntries(resource.entries)[0].fixedInfo
        .fileVersionMS,
      3,
    );
    artifacts.push({
      name: path.basename(file),
      size: fs.statSync(file).size,
      sha256: hash(fs.readFileSync(file)),
      verifiedEmbeddedFiles: count,
      embeddedVersion: pkg.version,
      nativeSha256: hash(native),
      sqliteABI: 140,
      windowsPE: "AMD64",
      embeddedPayloadVerified: true,
    });
  }
  fs.writeFileSync(
    "docs/reports/obsidian/F/artifacts.json",
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        windowsRuntimeTested: false,
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
