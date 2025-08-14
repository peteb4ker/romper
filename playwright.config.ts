import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  projects: [
    {
      name: "electron",
      use: {
        launchOptions: {
          args: [
            ".", // Launch from project root so Electron finds vite dev server
<<<<<<< HEAD
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
                ]
              : []),
=======
            // Disable GPU rendering in CI for headless stability, keep main sandbox enabled
            ...(process.env.CI ? [
              "--disable-gpu",
              "--disable-software-rasterizer",
            ] : []),
>>>>>>> c67e562 (Fixes ubuntu e2e tests)
          ],
          env: {
            ...process.env,
            ROMPER_SDCARD_PATH:
              process.env.ROMPER_SDCARD_PATH || "/tmp/e2e-sdcard",
            // Ensure display is set for headless environments
            ...(process.env.CI && !process.env.DISPLAY ? { DISPLAY: ":99" } : {}),
          },
          // Electron doesn't support true headless, but we can disable GPU
          headless: false,
        },
      },
      testMatch: /.*\.e2e\.test\.(ts|js)$/,
    },
  ],
  timeout: 5000,
  workers: 1, // Run E2E tests sequentially to avoid resource conflicts
});
