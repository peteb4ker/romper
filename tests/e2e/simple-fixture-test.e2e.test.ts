import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

test.describe("Simple Fixture Loading Test", () => {
  let electronApp: unknown;
  let window: unknown;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();

    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: {
        ...process.env,
        ...testEnv.environment,
      },
      timeout: 30000,
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    if (testEnv) {
      await cleanupE2EFixture(testEnv);
    }
  });

  test("should load app with kits without navigation", async () => {
    // Wait for app to initialize
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });

    // Check for console errors
    const errors: string[] = [];
    window.on("console", (msg: unknown) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await window.waitForTimeout(3000); // Give time for errors to appear

    // Log environment info
    const envDebug = await window.evaluate(() => {
      return {
        romperLocalPath: (window as unknown).romperEnv?.ROMPER_LOCAL_PATH,
        romperSdCardPath: (window as unknown).romperEnv?.ROMPER_SDCARD_PATH,
      };
    });

    console.log("Environment debug:", envDebug);
    console.log("Console errors:", errors);

    // Verify kits are loaded via IPC
    const kitsResult = await window.evaluate(async () => {
      if (!(window as unknown).electronAPI?.getKits) {
        return { error: "getKits API not available", success: false };
      }
      return await (window as unknown).electronAPI.getKits();
    });

    expect(kitsResult.success).toBe(true);
    expect(kitsResult.data).toHaveLength(2);

    // Verify kit grid is visible
    const kitGridVisible = await window.isVisible('[data-testid="kit-grid"]');
    expect(kitGridVisible).toBe(true);

    // Verify kit items are present
    const kitItems = await window.locator('[data-testid^="kit-item-"]').count();
    expect(kitItems).toBe(2);
  });
});
