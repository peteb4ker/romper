import { defineConfig } from "@playwright/test";

/**
 * The on-demand full-pipeline validation (`npm run validate:full`). Separate
 * from playwright.config.ts: its files are named `*.validation.ts`, so the
 * e2e suite never picks them up, and a run takes minutes, not seconds.
 */
process.env.ROMPER_HEADLESS ??= "true";

export default defineConfig({
  expect: { timeout: 10_000 },
  outputDir: "test-results/validation",
  projects: [{ name: "validation", testMatch: /.*\.validation\.ts$/ }],
  reporter: process.env.CI
    ? [
        ["list"],
        [
          "html",
          { open: "never", outputFolder: "validation-report/playwright" },
        ],
      ]
    : "list",
  retries: 0,
  testDir: "tests/validation",
  timeout: 60 * 60_000,
  use: {
    actionTimeout: 30_000,
    trace: "retain-on-failure",
  },
  workers: 1,
});
