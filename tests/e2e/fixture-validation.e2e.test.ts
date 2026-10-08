import { type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

test.describe("Fixture System Validation", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    // Extract pre-built E2E fixtures
    testEnv = await extractE2EFixture();

    // Launch the Electron app with fixture environment
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });

    window = await electronApp.firstWindow();
    // From Electron 44 the first window is returned while it still shows its
    // initial blank document, which is already "loaded"; wait for the app
    // itself, or the page load replaces the context mid-test.
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
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
    const kitsResult = await window.evaluate(() =>
      globalThis.electronAPI.getKits(),
    );

    expect(kitsResult.success).toBe(true);
    expect(kitsResult.data).toHaveLength(2);
    expect(kitsResult.data?.map((kit) => kit.name)).toEqual(
      expect.arrayContaining(["A0", "B1"]),
    );
  });

  test("should have valid local store status", async () => {
    // Check local store validation via IPC
    const localStoreStatus = await window.evaluate(() =>
      globalThis.electronAPI.getLocalStoreStatus(),
    );

    expect(localStoreStatus.hasLocalStore).toBe(true);
    expect(localStoreStatus.isValid).toBe(true);
    expect(localStoreStatus.error).toBe(null);
    expect(localStoreStatus.localStorePath).toEqual(
      testEnv.environment.ROMPER_LOCAL_PATH,
    );
  });

  test("should load samples for kits", async () => {
    // Get samples for the first kit
    const samplesResult = await window.evaluate(() =>
      globalThis.electronAPI.getAllSamplesForKit("A0"),
    );

    expect(samplesResult.success).toBe(true);
    expect(Array.isArray(samplesResult.data)).toBe(true);
  });
});
