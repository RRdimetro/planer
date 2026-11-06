import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["dist/**", "dist-electron/**", "node_modules/**", "release/**"] },
  { files: ["tests/google-calendar.node-check.mjs"], languageOptions: { globals: { fetch: "readonly", Response: "readonly", structuredClone: "readonly", URLSearchParams: "readonly" } } },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        window: "readonly",
        document: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);

