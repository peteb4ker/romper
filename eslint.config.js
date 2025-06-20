import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import prettier from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
// Patch: trim whitespace from all global keys
function trimGlobals(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.trim(), v]));
}
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["node_modules", "dist", "out", "coverage", "build"],
  },

  // JS files (browser environment)
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: trimGlobals(globals.browser),
    },
    plugins: {
      js,
      "simple-import-sort": simpleImportSort,
      prettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      "no-unused-vars": "warn",
      "no-undef": "warn",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "prettier/prettier": "error",
    },
  },

  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      globals: trimGlobals(globals.browser),
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
      "simple-import-sort": simpleImportSort,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommendedTypeChecked.rules,
      ...prettierConfig.rules,
      ...reactHooks.configs.recommended.rules,
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "prettier/prettier": "error",
    },
  },

  // Test files (Vitest or other test globals)
  {
    files: ["**/*.test.js", "**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      globals: trimGlobals({
        ...globals.browser,
        ...globals.vitest,
        vitest: true,
      }),
    },
  },

  // Config files (Node environment)
  {
    files: ["*.config.js", "*.config.ts"],
    languageOptions: {
      globals: trimGlobals(globals.node),
    },
  },
]);

// Remove this file. ESLint flat config should only use per-package eslint.config.mjs files, not a root config.
