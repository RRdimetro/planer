// Cross-build preparation only. This does not execute or test Windows.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const stage = "/tmp/focus-win020/app";
fs.mkdirSync(stage, { recursive: true });
for (const dir of ["dist", "dist-electron", "build"])
  fs.cpSync(dir, path.join(stage, dir), { recursive: true });
const source = JSON.parse(fs.readFileSync("package.json", "utf8"));
const modules = [
  ["better-sqlite3", "better-sqlite3"],
  ["bindings", "bindings"],
  ["file-uri-to-path", "file-uri-to-path"],
];
for (const [name, target] of modules) {
  const pkg = require.resolve(name + "/package.json", {
    paths: [path.dirname(require.resolve("better-sqlite3/package.json"))],
  });
  fs.cpSync(path.dirname(pkg), path.join(stage, "node_modules", target), {
    recursive: true,
    dereference: true,
  });
}
const sqlitePackage = path.join(
  stage,
  "node_modules/better-sqlite3/package.json",
);
const sql = JSON.parse(fs.readFileSync(sqlitePackage, "utf8"));
sql.dependencies = { bindings: "1.5.0" };
fs.writeFileSync(sqlitePackage, JSON.stringify(sql, null, 2));
execFileSync("tar", [
  "-xzf",
  "/tmp/focus-win020/sqlite-win.tar.gz",
  "-C",
  path.join(stage, "node_modules/better-sqlite3"),
]);
const native = fs.readFileSync(
  path.join(
    stage,
    "node_modules/better-sqlite3/build/Release/better_sqlite3.node",
  ),
);
if (native.toString("ascii", 0, 2) !== "MZ")
  throw Error("Not a Windows native binding");
fs.mkdirSync("/tmp/focus-win020/electron", { recursive: true });
execFileSync("unzip", [
  "-q",
  "-o",
  "/tmp/focus-win020/electron-win.zip",
  "-d",
  "/tmp/focus-win020/electron",
]);
const config = {
  ...source.build,
  npmRebuild: false,
  electronVersion: "39.8.10",
  electronDist: "/tmp/focus-win020/electron",
  win: { ...source.build.win, signAndEditExecutable: true },
  toolsets: { wine: "1.0.1" },
  directories: { output: "/workspace/focus_os_codex/release/windows-cross" },
};
fs.writeFileSync(
  path.join(stage, "package.json"),
  JSON.stringify(
    {
      name: source.name,
      version: source.version,
      description: source.description,
      author: source.author,
      main: source.main,
      dependencies: {
        "better-sqlite3": "12.11.1",
        bindings: "1.5.0",
        "file-uri-to-path": "1.0.0",
      },
      build: config,
    },
    null,
    2,
  ),
);
console.log("Prepared Windows Electron + ABI 140 PE SQLite at " + stage);
