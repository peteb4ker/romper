import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

test.describe("Fixture System Validation", () => {
  let electronApp: any;
  let window: any;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    // Extract pre-built E2E fixtures
    testEnv = await extractE2EFixture();

    // Launch the Electron app with fixture environment
    electronApp = await electron.launch({
      args: [
        "dist/electron/main/index.js",
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
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

  test("should load app with fixtures and bypass wizard", async () => {
    // Wait for app to load (no wizard should appear)
    await window.waitForTimeout(2000); // Give app time to initialize

    // Check that wizard is NOT visible
    const wizardVisible = await window.isVisible(
      '[data-testid="local-store-wizard"]',
    );
    expect(wizardVisible).toBe(false);

    // Verify we can get kits via IPC
    const kitsResult = await window.evaluate(async () => {
      if (!(window as any).electronAPI?.getKits) {
        return { error: "getKits API not available", success: false };
      }
      return await (window as any).electronAPI.getKits();
    });

    expect(kitsResult.success).toBe(true);
    expect(kitsResult.data).toHaveLength(2);
    expect(kitsResult.data.map((kit: any) => kit.name)).toEqual(
      expect.arrayContaining(["A0", "B1"]),
    );
  });

  test("should have valid local store status", async () => {
    // Check local store validation via IPC
    const localStoreStatus = await window.evaluate(async () => {
      if (!(window as any).electronAPI?.getLocalStoreStatus) {
        return { error: "getLocalStoreStatus API not available" };
      }
      return await (window as any).electronAPI.getLocalStoreStatus();
    });

    expect(localStoreStatus.hasLocalStore).toBe(true);
    expect(localStoreStatus.isValid).toBe(true);
    expect(localStoreStatus.error).toBe(null);
    expect(localStoreStatus.localStorePath).toEqual(
      testEnv.environment.ROMPER_LOCAL_PATH,
    );
  });

  test("should load samples for kits", async () => {
    // Get samples for the first kit
    const samplesResult = await window.evaluate(async () => {
      if (!(window as any).electronAPI?.getAllSamplesForKit) {
        return {
          error: "getAllSamplesForKit API not available",
          success: false,
        };
      }
      return await (window as any).electronAPI.getAllSamplesForKit("A0");
    });

    expect(samplesResult.success).toBe(true);
    expect(Array.isArray(samplesResult.data)).toBe(true);
  });
});
