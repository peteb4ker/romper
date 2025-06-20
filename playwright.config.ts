import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  projects: [
    {
      name: "electron",
      use: {
        launchOptions: {
          args: ["."], // Launch from project root so Electron finds vite dev server
          env: {
            ...process.env,
            ROMPER_E2E_SDCARD_PATH:
              process.env.ROMPER_E2E_SDCARD_PATH || "/tmp/e2e-sdcard",
          },
        },
      },
      testMatch: /.*\.e2e\.test\.(ts|js)$/,
    },
  ],
});
