import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

test.describe("Back Navigation E2E Tests", () => {
  let electronApp: unknown;
  let window: unknown;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    // Extract pre-built E2E fixtures
    testEnv = await extractE2EFixture();

    // Launch the Electron app with fixture environment
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

    // Wait for the main content to be ready (should bypass wizard)
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

  test("should navigate from kit grid to kit details and back successfully", async () => {
    // Wait for kit grid to load
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Verify we're on the kit grid page
    const kitGridVisible = await window.isVisible('[data-testid="kit-grid"]');
    expect(kitGridVisible).toBe(true);

    // Find and click on the first kit item
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    await firstKit.waitFor({ state: "visible", timeout: 5000 });

    const kitTestId = await firstKit.getAttribute("data-testid");
    const kitName = kitTestId?.replace("kit-item-", "");
    expect(kitName).toBeTruthy();

    await firstKit.click();

    // Wait for navigation to kit details (should appear)
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 15000,
    });

    // Verify we're on the kit details page
    const kitDetailsVisible = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsVisible).toBe(true);

    // Find and click the back button (using title attribute)
    const backButton = await window.locator('button[title="Back"]');
    await backButton.waitFor({ state: "visible" });
    await backButton.click();

    // Wait for navigation back to kit grid
    await window.waitForSelector('[data-testid="kit-grid"]', { timeout: 5000 });

    // Verify we're back on the kit grid page
    const backToKitGrid = await window.isVisible('[data-testid="kit-grid"]');
    expect(backToKitGrid).toBe(true);

    // Verify kit details page is no longer visible
    const kitDetailsGone = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsGone).toBe(false);
  });

  test("should preserve kit grid state after back navigation", async () => {
    // Wait for kit grid to load
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Get the initial kit list state (scroll position, selected filters, etc.)
    const initialKitCount = await window
      .locator('[data-testid^="kit-item-"]')
      .count();
    expect(initialKitCount).toBeGreaterThan(0);

    // Navigate to first kit
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    const kitTestId = await firstKit.getAttribute("data-testid");
    const kitName = kitTestId?.replace("kit-item-", "");
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Navigate back
    const backButton = await window.locator('button[title="Back"]');
    await backButton.click();

    // Wait for kit grid
    await window.waitForSelector('[data-testid="kit-grid"]', { timeout: 5000 });

    // Verify kit grid state is preserved
    const finalKitCount = await window
      .locator('[data-testid^="kit-item-"]')
      .count();
    expect(finalKitCount).toBe(initialKitCount);

    // Verify the same kit items are still present
    const firstKitAfterBack = await window
      .locator('[data-testid^="kit-item-"]')
      .first();
    const kitTestIdAfterBack =
      await firstKitAfterBack.getAttribute("data-testid");
    const kitNameAfterBack = kitTestIdAfterBack?.replace("kit-item-", "");
    expect(kitNameAfterBack).toBe(kitName);
  });

  test("should handle navigation guard properly", async () => {
    // Wait for kit grid to load
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Navigate to first kit
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Test navigation guard by checking button state
    const backButton = await window.locator('button[title="Back"]');

    // Verify button is initially enabled
    const initiallyDisabled = await backButton.isDisabled();
    expect(initiallyDisabled).toBe(false);

    // Click back button once (should work)
    await backButton.click();

    // Wait for navigation back to kit grid
    await window.waitForSelector('[data-testid="kit-grid"]', { timeout: 5000 });

    // Verify we end up on kit grid
    const kitGridVisible = await window.isVisible('[data-testid="kit-grid"]');
    expect(kitGridVisible).toBe(true);

    // Verify no error dialogs are shown (basic check for UI stability)
    const hasErrors = await window.locator("text=Error").count();
    expect(hasErrors).toBe(0);
  });

  test("should not restore kit selection after explicit back navigation", async () => {
    // This test verifies that HMR state restoration is properly blocked
    // after explicit navigation (the core fix we implemented)

    // Wait for kit grid to load
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Navigate to a specific kit (we only have 2 kits in fixtures)
    const targetKit = await window.locator('[data-testid^="kit-item-"]').nth(1); // Second kit
    await targetKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Verify we're on the kit details page
    const kitDetailsVisible = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsVisible).toBe(true);

    // Navigate back using back button (explicit navigation)
    const backButton = await window.locator('button[title="Back"]');
    await backButton.click();

    // Wait for kit grid
    await window.waitForSelector('[data-testid="kit-grid"]', { timeout: 5000 });

    // Simulate HMR by forcing a page refresh (in real HMR this would be automatic)
    await window.reload();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Verify we stay on the kit grid and don't auto-navigate back to kit details
    // (This would happen if HMR restoration wasn't properly blocked)
    const kitGridStillVisible = await window.isVisible(
      '[data-testid="kit-grid"]',
    );
    expect(kitGridStillVisible).toBe(true);

    const kitDetailsNotVisible = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsNotVisible).toBe(false);
  });

  test("should handle keyboard navigation (Escape key for back)", async () => {
    // Wait for kit grid to load
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Navigate to first kit
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Press Escape key to go back
    await window.keyboard.press("Escape");

    // Wait for navigation back to kit grid
    await window.waitForSelector('[data-testid="kit-grid"]', { timeout: 5000 });

    // Verify we're back on the kit grid page
    const kitGridVisible = await window.isVisible('[data-testid="kit-grid"]');
    expect(kitGridVisible).toBe(true);
  });

  test("should maintain navigation state with UI controls", async () => {
    // Wait for kit grid to load
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Navigate to first kit
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    const kitTestId = await firstKit.getAttribute("data-testid");
    const kitName = kitTestId?.replace("kit-item-", "");
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Use the app's back button (instead of browser back)
    const backButton = await window.locator('button[title="Back"]');
    await backButton.click();

    // Wait for navigation back to kit grid
    await window.waitForSelector('[data-testid="kit-grid"]', { timeout: 5000 });

    // Verify we're on kit grid
    const kitGridVisible = await window.isVisible('[data-testid="kit-grid"]');
    expect(kitGridVisible).toBe(true);

    // Navigate to the same kit again to test consistent navigation
    const sameKit = await window.locator(`[data-testid="kit-item-${kitName}"]`);
    await sameKit.click();

    // Wait for kit details again
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Verify we're back on kit details page
    const kitDetailsVisible = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsVisible).toBe(true);
  });

  test("should show proper navigation state with available kits", async () => {
    // This test verifies navigation behavior when kits are available

    // Wait for the app to load
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });

    // Wait for kit grid to be available
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 5000,
    });

    // Check that we have kits available
    const hasKits = await window.locator('[data-testid^="kit-item-"]').count();
    expect(hasKits).toBeGreaterThan(0);

    // Verify kit grid is visible
    const kitGridVisible = await window.isVisible('[data-testid="kit-grid"]');
    expect(kitGridVisible).toBe(true);

    // Verify back button is not visible on the main kit grid (since there's nowhere to go back to)
    const backButton = await window.isVisible('button[title="Back"]');
    expect(backButton).toBe(false);

    // Navigate to a kit to verify back button appears
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Now back button should be visible
    const backButtonInDetails = await window.isVisible('button[title="Back"]');
    expect(backButtonInDetails).toBe(true);
  });

  test("should handle consistent navigation through multiple cycles", async () => {
    // Wait for kit grid to load first
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });

    // Get a kit name for navigation testing
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    const kitTestId = await firstKit.getAttribute("data-testid");
    const kitName = kitTestId?.replace("kit-item-", "");

    if (kitName) {
      // Test multiple navigation cycles to ensure stability
      for (let i = 0; i < 3; i++) {
        // Navigate to kit details
        await firstKit.click();

        // Wait for kit details to load
        await window.waitForSelector('[data-testid="kit-details"]', {
          timeout: 5000,
        });

        // Verify we're on the kit details page
        const kitDetailsVisible = await window.isVisible(
          '[data-testid="kit-details"]',
        );
        expect(kitDetailsVisible).toBe(true);

        // Navigate back
        const backButton = await window.locator('button[title="Back"]');
        await backButton.click();

        // Wait for kit grid
        await window.waitForSelector('[data-testid="kit-grid"]', {
          timeout: 5000,
        });

        const kitGridVisible = await window.isVisible(
          '[data-testid="kit-grid"]',
        );
        expect(kitGridVisible).toBe(true);

        // Small delay between cycles to allow state to settle
        await window.waitForTimeout(200);
      }
    } else {
      test.skip();
    }
  });
});
