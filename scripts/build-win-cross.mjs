// Linux cross-build only. Uses electron-builder's own native NSIS uninstaller
// reader (also used by its macOS path) instead of executing a Windows helper.
// This does not constitute installation or runtime testing on Windows.
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const builder = require("electron-builder");
const lib = path.dirname(
  require.resolve("app-builder-lib", {
    paths: [require.resolve("electron-builder")],
  }),
);
const { WineVmManager } = require(path.join(lib, "vm/WineVm.js"));
const { UninstallerReader } = require(
  path.join(lib, "targets/nsis/nsisUtil.js"),
);
const original = WineVmManager.prototype.exec;
let extracted = false;
WineVmManager.prototype.exec = async function (
  file,
  args = [],
  options,
  ...rest
) {
  if (
    path.basename(file) === "FOCUS OS PRO Setup 0.2.0.exe" &&
    args.length === 0 &&
    options?.env?.__COMPAT_LAYER === "RunAsInvoker"
  ) {
    const out = path.join(
      path.dirname(file),
      path.basename(file, "exe") + "__uninstaller.exe",
    );
    await UninstallerReader.exec(file, out);
    extracted = true;
    console.log(
      "Extracted NSIS uninstaller using electron-builder native reader; no Windows execution.",
    );
    return "";
  }
  return original.call(this, file, args, options, ...rest);
};
const artifacts = await builder.build({
  projectDir: "/tmp/focus-win020/app",
  targets: builder.Platform.WINDOWS.createTarget(
    ["nsis", "portable"],
    builder.Arch.x64,
  ),
  publish: "never",
});
fs.writeFileSync(
  "docs/reports/0.2.0/05-cross-build.json",
  JSON.stringify(
    {
      built: true,
      host: process.platform,
      artifacts,
      uninstallerExtractedWithNativeReader: extracted,
      windowsRuntimeTested: false,
      signed: false,
    },
    null,
    2,
  ),
);
console.log(artifacts);
