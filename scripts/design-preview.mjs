import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import electron from "electron";
const concept = (process.argv[2] ?? "C").toUpperCase();
if (!["A", "B", "C"].includes(concept)) throw Error("Укажите A, B или C");
const env = {
  ...process.env,
  FOCUS_DEMO: "1",
  FOCUS_HOME_CONCEPT: concept,
  FOCUS_DEMO_EMPTY: process.argv.includes("--empty") ? "1" : "0",
};
// Never inherit a developer's override pointing at an existing personal database.
delete env.FOCUS_DATA_DIR;
delete env.ELECTRON_RUN_AS_NODE;
delete env.FOCUS_DEV_URL;
const child = spawn(electron, ["."], {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
