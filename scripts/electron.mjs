import { build } from "esbuild";
await build({
  entryPoints: ["apps/desktop/electron/main/index.ts"],
  outfile: "dist-electron/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "better-sqlite3"],
});
await build({
  entryPoints: ["apps/desktop/electron/preload/index.ts"],
  outfile: "dist-electron/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
