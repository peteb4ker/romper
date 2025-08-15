import { defineConfig } from "@playwright/test";

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
              process.env.ROMPER_SDCARD_PATH || "/tmp/e2e-sdcard",
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
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : "list",
  testDir: ".",
  timeout: process.env.CI ? 10000 : 8000, // Reasonable timeout for Electron tests, longer in CI
  use: {
    // Faster action and navigation timeouts in CI
    actionTimeout: process.env.CI ? 10000 : 5000,
    navigationTimeout: process.env.CI ? 10000 : 15000,
  },
  workers: 1, // Run E2E tests sequentially to avoid resource conflicts
});
