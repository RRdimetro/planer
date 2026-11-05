import fs from "node:fs";
const root = "docs/reports/1.0-rc/windows";
const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(root + "/" + file, "utf8"));
  } catch {
    return null;
  }
};
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const checks = {};
for (const v of ["0.2.0", "0.3.0"]) {
  const r = read(`upgrade-${v}/result.json`);
  checks["upgrade" + v] =
    !!r?.passed && r.platform === "win32" && r.currentVersion === version;
}
const portable = read("portable.json");
checks.portable =
  !!portable?.passed &&
  portable.platform === "win32" &&
  portable.version === version;
const payloads = [];
for (const scale of [1, 1.25, 1.5]) {
  const r = read(`native-platform-${scale}.json`);
  payloads.push(r?.appPayloadSha256);
  checks["nativeDPI" + scale] =
    !!r?.passed &&
    r.platform === "win32" &&
    r.version === version &&
    r.nativeDPI === "passed" &&
    r.notifications === "observed_native_toast";
}
checks.sameInstalledPayload =
  payloads.every((p) => typeof p === "string" && /^[a-f0-9]{64}$/.test(p)) &&
  new Set(payloads).size === 1;
const report = {
  version,
  stableAccepted: Object.values(checks).every(Boolean),
  checks,
  missing: Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k),
  method:
    "requires actual Windows install/upgrade/portable and native DPI/UIAutomation toast evidence, not Linux or Chromium zoom",
};
fs.mkdirSync("docs/reports/1.0-rc/M5", { recursive: true });
fs.writeFileSync(
  "docs/reports/1.0-rc/M5/acceptance-gate.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
if (process.argv.includes("--require-stable") && !report.stableAccepted)
  process.exitCode = 1;
