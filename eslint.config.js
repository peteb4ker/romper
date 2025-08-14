import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import perfectionist from "eslint-plugin-perfectionist";
import prettier from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
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
      prettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_", // ignore unused variables starting with _
          varsIgnorePattern: "^_",
        },
      ],
      "no-undef": "warn",
      "prettier/prettier": "error",
      "no-trailing-spaces": "error",
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
      perfectionist,
      "react-hooks": reactHooks,
      sonarjs,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommendedTypeChecked.rules,
      ...prettierConfig.rules,
      ...reactHooks.configs.recommended.rules,
      ...perfectionist.configs["recommended-alphabetical"].rules,
      // SonarJS rules - focused on critical issues only
      "sonarjs/cognitive-complexity": ["error", 25], // More reasonable threshold
      "sonarjs/no-nested-functions": "error", // Keep for code quality
      "sonarjs/assertions-in-tests": "error", // Keep - important for test quality
      "sonarjs/no-redundant-boolean": "error", // Keep - simple to fix
      "sonarjs/pseudo-random": "off", // Ignore - acceptable for testing/development
      "sonarjs/slow-regex": "off", // Ignore - acceptable for this codebase
      "sonarjs/no-unused-vars": "error", // Keep - code cleanliness
      "sonarjs/no-dead-store": "error", // Keep - code cleanliness
      "sonarjs/publicly-writable-directories": "off", // Ignore - acceptable for testing
      "prettier/prettier": "error",
      "no-trailing-spaces": "error",
      // Catch unused imports and variables
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_", // ignore unused variables starting with _
          varsIgnorePattern: "^_",
        },
      ],
      "no-unused-vars": "off", // Turn off base rule to avoid conflicts
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
    rules: {
      // Disable nested functions rule for test files
      "sonarjs/no-nested-functions": "off",
      // Prevent manual window.electronAPI assignments
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.object.type='MemberExpression'][left.object.object.name='window'][left.object.property.name='electronAPI']",
          message:
            "Use centralized mocks from tests/mocks instead of manual window.electronAPI assignment. Use vi.mocked(window.electronAPI.method) instead.",
        },
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.object.name='window'][left.property.name='electronAPI']",
          message:
            "Use centralized mocks from tests/mocks instead of manual window.electronAPI assignment.",
        },
      ],
      // Encourage use of centralized factories
      "prefer-const": "error",
    },
  },

  // E2E test files and test utilities
  {
    files: ["tests/**/*.ts", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: false,
        },
      },
      globals: trimGlobals({
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
        vitest: true,
      }),
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      perfectionist,
      sonarjs,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules, // Use recommended instead of recommendedTypeChecked
      ...prettierConfig.rules,
      ...perfectionist.configs["recommended-alphabetical"].rules,
      "sonarjs/no-nested-functions": "off",
      "sonarjs/cognitive-complexity": ["error", 30], // Higher threshold for test files
      "sonarjs/no-unused-vars": "error",
      "sonarjs/no-dead-store": "error",
      "prettier/prettier": "error",
      "no-trailing-spaces": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-unused-vars": "off",
    },
  },

  // Config files (Node environment)
  {
    files: ["*.config.js", "*.config.ts"],
    languageOptions: {
      globals: trimGlobals(globals.node),
    },
  },

  // Node.js scripts
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: trimGlobals(globals.node),
    },
  },
]);

// Remove this file. ESLint flat config should only use per-package eslint.config.mjs files, not a root config.
