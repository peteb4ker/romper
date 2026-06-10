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

// typescript-eslint v8 ships its shared configs as ARRAYS of flat-config
// objects, so `tseslint.configs.recommended.rules` is `undefined` and
// spreading it is a silent no-op. Merge the `rules` of every object in the
// array into one record so the preset actually loads.
function tseslintRules(configArray) {
  return Object.assign({}, ...configArray.map((c) => c.rules ?? {}));
}

const TS_RECOMMENDED_RULES = tseslintRules(tseslint.configs.recommended);

// Type-checked-only rules worth enforcing on source (needs type information).
// Scoped to non-test source files below, where `projectService` can resolve
// every file against the root tsconfig.
const TYPE_CHECKED_RULES = {
  "@typescript-eslint/await-thenable": "error",
  "@typescript-eslint/no-floating-promises": "error",
  // Async functions passed as JSX event handlers (onClick={async …}) are a
  // well-known false positive — React ignores the returned promise — so only
  // flag genuinely misused promises (conditions, non-attribute void returns).
  "@typescript-eslint/no-misused-promises": [
    "error",
    { checksVoidReturn: { attributes: false } },
  ],
  "@typescript-eslint/only-throw-error": "error",
};

// The codebase uses the `isDev && console.debug(…)` short-circuit idiom
// deliberately; allow short-circuit/ternary expression statements.
const NO_UNUSED_EXPRESSIONS = [
  "error",
  { allowShortCircuit: true, allowTernary: true },
];

export default defineConfig([
  {
    ignores: [
      "node_modules",
      "dist",
      "out",
      "coverage",
      "build",
      "app/node_modules",
      "**/node_modules",
      "worktrees",
      "_site",
      "_site_preview",
      "docs/_site",
      "docs/.jekyll-cache",
    ],
  },

  // JS files (browser environment) - excluding Node.js files
  {
    files: ["**/*.js"],
    ignores: [
      "scripts/**/*.js",
      "tailwind.config.js",
      "docs/**/*.js",
      "app/node_modules/**/*",
    ],
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
      ...TS_RECOMMENDED_RULES,
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
      // TypeScript any type restrictions
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
      "@typescript-eslint/no-unused-expressions": NO_UNUSED_EXPRESSIONS,
    },
  },

  // Type-checked rules for SOURCE files only (in the root tsconfig, so
  // `projectService` can resolve them). Test files and preload are excluded
  // from tsconfig.json, so they stay on the non-type-checked rules above.
  {
    files: ["app/**/*.{ts,tsx}", "electron/main/**/*.ts", "shared/**/*.ts"],
    ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}", "**/__mocks__/**"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: TYPE_CHECKED_RULES,
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
      // Tests use require() and rest-style arg capture freely
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-expressions": NO_UNUSED_EXPRESSIONS,
      "prefer-rest-params": "off",
      // TypeScript any type restrictions
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
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
      ...TS_RECOMMENDED_RULES, // recommended (non-type-checked) rules
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
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-expressions": NO_UNUSED_EXPRESSIONS,
      // TypeScript any type restrictions
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
    },
  },

  // Config files (Node environment)
  {
    files: ["*.config.js", "*.config.ts", "tailwind.config.js"],
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

  // Preload runs in a CommonJS context and uses require() by design
  {
    files: ["electron/preload/**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
