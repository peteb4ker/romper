import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function escapeRegExp(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// Run the app with a hidden window so e2e doesn't take over the screen.
// Every spec launches Electron with process.env, so this reaches all of them.
// `npm run test:e2e:headed` (ROMPER_HEADLESS=false) shows the window instead.
process.env.ROMPER_HEADLESS ??= "true";

// The app is named "Romper", so without this every spec would read and write
// the installed app's settings (RE-68). One temp folder per run; workers
// inherit it from the runner's environment.
process.env.ROMPER_USER_DATA_DIR ??= fs.mkdtempSync(
  path.join(os.tmpdir(), "romper-e2e-userdata-"),
);

export default defineConfig({
  expect: {
    timeout: process.env.CI ? 3000 : 2000, // Faster expect timeout in CI
  },
  projects: [
    {
      name: "electron",
      testMatch: /.*\.e2e\.test\.(ts|js)$/,
      use: {
        launchOptions: {
          args: [
            ".", // Launch from project root so Electron finds vite dev server
            ...(process.env.CI
              ? [
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                  "--disable-gpu",
                  "--disable-gpu-sandbox",
                  "--disable-software-rasterizer",
                  "--disable-background-timer-throttling",
                  "--disable-backgrounding-occluded-windows",
                  "--disable-renderer-backgrounding",
                  "--disable-features=TranslateUI",
                  "--disable-ipc-flooding-protection",
                  "--disable-dev-shm-usage", // Prevents shared memory issues in CI
                  "--disable-extensions",
                  "--disable-background-networking",
                ]
              : []),
          ],
          env: {
            ...process.env,
            ROMPER_SDCARD_PATH:
              process.env.ROMPER_SDCARD_PATH ||
              path.join(os.tmpdir(), "e2e-sdcard"),
            // Ensure display is set for headless environments
            ...(process.env.CI && !process.env.DISPLAY
              ? { DISPLAY: ":99" }
              : {}),
          },
          // Electron doesn't support true headless, but we can disable GPU
          headless: false,
        },
      },
    },
  ],
  // Optimize for CI performance
  // The JSON results feed the testing summary a release publishes
  reporter: process.env.CI
    ? [
        ["dot"],
        ["html", { open: "never" }],
        ["json", { outputFile: "reports/results-e2e.json" }],
      ]
    : "list",
  // On CI, retry a failed test once, so one flaky test doesn't fail the
  // run (#659). A test that passes only on retry is "flaky" in the JSON
  // report; scripts/e2e-flaky-summary.mjs lists it in the job summary, to
  // be filed as an issue. The error guard still fails a test whose first
  // attempt reported unexpected errors. Locally, a failure fails.
  retries: process.env.CI ? 1 : 0,
  testDir: ".",
  // Nested worktrees (worktrees/, and Claude Code's .claude/worktrees/) carry
  // their own copies of the e2e suite. Match relative to this checkout, since
  // this checkout may itself be one of those worktrees.
  testIgnore: new RegExp(
    `^${escapeRegExp(import.meta.dirname)}[\\\\/](\\.claude[\\\\/])?worktrees[\\\\/]`,
  ),
  timeout: process.env.CI ? 45000 : 15000, // Allow sufficient time for Electron wizard operations
  use: {
    // Faster action and navigation timeouts in CI
    actionTimeout: process.env.CI ? 10000 : 5000,
    navigationTimeout: process.env.CI ? 10000 : 15000,
  },
  workers: 1, // Run E2E tests sequentially to avoid resource conflicts
});
