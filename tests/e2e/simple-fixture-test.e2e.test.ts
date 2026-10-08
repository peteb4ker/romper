import { type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

test.describe("Simple Fixture Loading Test", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();

    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
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

    // Verify kits are loaded via IPC
    const kitsResult = await window.evaluate(() =>
      globalThis.electronAPI.getKits(),
    );

    expect(kitsResult.success).toBe(true);
    expect(kitsResult.data).toHaveLength(2);

    // Verify kit grid is visible
    const kitGridVisible = await window.isVisible('[data-testid="kit-grid"]');
    expect(kitGridVisible).toBe(true);

    // Verify kit items are present
    const kitItems = await window.locator('[data-testid^="kit-item-"]').count();
    expect(kitItems).toBe(2);
  });

  test("[UC-09] search narrows the grid by kit name and sample name", async () => {
    // The fixture has kits A0 and B1, each with 1_kick.wav and 2_snare.wav.
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
    const kits = window.locator('[data-testid^="kit-item-"]');
    await expect(kits).toHaveCount(2);
    const search = window.getByLabel("Search kits");

    await search.fill("B1");
    await expect(kits).toHaveCount(1);
    await expect(window.locator('[data-testid="kit-item-B1"]')).toBeVisible();

    await search.fill("kick");
    await expect(kits).toHaveCount(2);

    await search.fill("no such sample");
    await expect(kits).toHaveCount(0);

    await window.getByLabel("Clear search").click();
    await expect(kits).toHaveCount(2);
  });
});
