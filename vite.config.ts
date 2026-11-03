import fs from "node:fs";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(
      JSON.parse(
        fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"),
      ).version,
    ),
  },
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          markdown: ["react-markdown"],
          validation: ["zod"],
        },
      },
    },
  },
  server: { host: "127.0.0.1" },
});
