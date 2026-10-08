// What the pre-commit hook runs on the staged files (#699), beside the
// typecheck. CI runs the full lint, unit and integration suites and the
// build on every pull request.
//
// lint-staged passes the staged files' absolute paths; a command given as
// a function gets them all at once, and its string is split into arguments
// without a shell, so each path is quoted.
const quote = (file) => `"${file}"`;

export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": [
    // Lints and formats (Prettier runs as an ESLint rule); lint-staged
    // stages what --fix changes
    "eslint --fix --no-warn-ignored",
    // The unit tests that import a staged file, and any staged unit test
    (files) =>
      `vitest related --run --config vitest.config.fast.ts --passWithNoTests --silent --reporter=dot ${files.map(quote).join(" ")}`,
  ],
};
