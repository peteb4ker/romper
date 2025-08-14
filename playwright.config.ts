import { defineConfig } from "@playwright/test";

export default defineConfig({
  projects: [
    {
      name: "electron",
      testMatch: /.*\.e2e\.test\.(ts|js)$/,
      use: {
        launchOptions: {
          args: [
            ".", // Launch from project root so Electron finds vite dev server
            ...(process.env.CI
              ? ["--no-sandbox", "--disable-setuid-sandbox"]
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
          // Add headless configuration for CI
          ...(process.env.CI
            ? {
                args: [
                  ".",
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
                ],
                headless: false, // Electron doesn't support true headless, but we can disable GPU
              }
            : {}),
        },
      },
    },
  ],
  testDir: ".",
  timeout: 5000,
  workers: 1, // Run E2E tests sequentially to avoid resource conflicts
});
