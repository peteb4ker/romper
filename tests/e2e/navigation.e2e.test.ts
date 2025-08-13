import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

test.describe("Back Navigation E2E Tests", () => {
  let electronApp: any;
  let window: any;

  test.beforeEach(async () => {
    // Launch the Electron app
    electronApp = await electron.launch({
      args: ["."],
      env: {
        ...process.env,
        NODE_ENV: "test",
        ROMPER_TEST_MODE: "true",
      },
    });

    // Get the first window
    window = await electronApp.firstWindow();

    // Wait for the app to load
    await window.waitForLoadState("domcontentloaded");

    // Wait for the main content to be ready
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test("should navigate from kit list to kit details and back successfully", async () => {
    // Wait for kit list to load
    await window.waitForSelector('[data-testid="kit-list"]', {
      timeout: 10000,
    });

    // Verify we're on the kit list page
    const kitListVisible = await window.isVisible('[data-testid="kit-list"]');
    expect(kitListVisible).toBe(true);

    // Find and click on the first kit item
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    await firstKit.waitFor({ state: "visible", timeout: 5000 });

    const kitTestId = await firstKit.getAttribute("data-testid");
    const kitName = kitTestId?.replace("kit-item-", "");
    expect(kitName).toBeTruthy();

    await firstKit.click();

    // Wait for navigation to kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Verify we're on the kit details page
    const kitDetailsVisible = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsVisible).toBe(true);

    // Verify the kit name is displayed in the title
    const kitTitleElement = await window.locator("text=" + kitName);
    await expect(kitTitleElement).toBeVisible();

    // Find and click the back button (using title attribute)
    const backButton = await window.locator('button[title="Back"]');
    await backButton.waitFor({ state: "visible" });
    await backButton.click();

    // Wait for navigation back to kit list
    await window.waitForSelector('[data-testid="kit-list"]', { timeout: 5000 });

    // Verify we're back on the kit list page
    const backToKitList = await window.isVisible('[data-testid="kit-list"]');
    expect(backToKitList).toBe(true);

    // Verify kit details page is no longer visible
    const kitDetailsGone = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsGone).toBe(false);
  });

  test("should preserve kit list state after back navigation", async () => {
    // Wait for kit list to load
    await window.waitForSelector('[data-testid="kit-list"]', {
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

    // Wait for kit list
    await window.waitForSelector('[data-testid="kit-list"]', { timeout: 5000 });

    // Verify kit list state is preserved
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

  test("should handle rapid back navigation without errors", async () => {
    // Wait for kit list to load
    await window.waitForSelector('[data-testid="kit-list"]', {
      timeout: 10000,
    });

    // Navigate to first kit
    const firstKit = await window.locator('[data-testid^="kit-item-"]').first();
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Rapidly click back button multiple times
    const backButton = await window.locator('button[title="Back"]');
    await backButton.click();
    await backButton.click(); // Second click should be ignored
    await backButton.click(); // Third click should be ignored

    // Wait for navigation back to kit list
    await window.waitForSelector('[data-testid="kit-list"]', { timeout: 5000 });

    // Verify we end up on kit list (not in some broken state)
    const kitListVisible = await window.isVisible('[data-testid="kit-list"]');
    expect(kitListVisible).toBe(true);

    // Verify no error dialogs are shown (basic check for UI stability)
    const hasErrors = await window.locator("text=Error").count();
    expect(hasErrors).toBe(0);
  });

  test("should not restore kit selection after explicit back navigation", async () => {
    // This test verifies that HMR state restoration is properly blocked
    // after explicit navigation (the core fix we implemented)

    // Wait for kit list to load
    await window.waitForSelector('[data-testid="kit-list"]', {
      timeout: 10000,
    });

    // Navigate to a specific kit
    const targetKit = await window.locator('[data-testid="kit-item"]').nth(2); // Third kit
    const kitName = await targetKit.getAttribute("data-kit-name");
    await targetKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Verify we're on the correct kit
    const kitTitle = await window.locator('[data-testid="kit-title"]');
    await expect(kitTitle).toContainText(kitName);

    // Navigate back using back button (explicit navigation)
    const backButton = await window.locator('[data-testid="back-button"]');
    await backButton.click();

    // Wait for kit list
    await window.waitForSelector('[data-testid="kit-list"]', { timeout: 5000 });

    // Simulate HMR by forcing a page refresh (in real HMR this would be automatic)
    await window.reload();
    await window.waitForSelector('[data-testid="kit-list"]', {
      timeout: 10000,
    });

    // Verify we stay on the kit list and don't auto-navigate back to kit details
    // (This would happen if HMR restoration wasn't properly blocked)
    const kitListStillVisible = await window.isVisible(
      '[data-testid="kit-list"]',
    );
    expect(kitListStillVisible).toBe(true);

    const kitDetailsNotVisible = await window.isVisible(
      '[data-testid="kit-details"]',
    );
    expect(kitDetailsNotVisible).toBe(false);
  });

  test("should handle keyboard navigation (Escape key for back)", async () => {
    // Wait for kit list to load
    await window.waitForSelector('[data-testid="kit-list"]', {
      timeout: 10000,
    });

    // Navigate to first kit
    const firstKit = await window.locator('[data-testid="kit-item"]').first();
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Press Escape key to go back
    await window.keyboard.press("Escape");

    // Wait for navigation back to kit list
    await window.waitForSelector('[data-testid="kit-list"]', { timeout: 5000 });

    // Verify we're back on the kit list page
    const kitListVisible = await window.isVisible('[data-testid="kit-list"]');
    expect(kitListVisible).toBe(true);
  });

  test("should maintain browser history for back/forward navigation", async () => {
    // Wait for kit list to load
    await window.waitForSelector('[data-testid="kit-list"]', {
      timeout: 10000,
    });

    // Navigate to first kit
    const firstKit = await window.locator('[data-testid="kit-item"]').first();
    const kitName = await firstKit.getAttribute("data-kit-name");
    await firstKit.click();

    // Wait for kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Use browser back button
    await window.goBack();

    // Wait for navigation back to kit list
    await window.waitForSelector('[data-testid="kit-list"]', { timeout: 5000 });

    // Verify we're on kit list
    const kitListVisible = await window.isVisible('[data-testid="kit-list"]');
    expect(kitListVisible).toBe(true);

    // Use browser forward button
    await window.goForward();

    // Wait for navigation forward to kit details
    await window.waitForSelector('[data-testid="kit-details"]', {
      timeout: 5000,
    });

    // Verify we're back on kit details for the same kit
    const kitTitle = await window.locator('[data-testid="kit-title"]');
    await expect(kitTitle).toContainText(kitName);
  });

  test("should handle navigation with no kits available", async () => {
    // This test ensures navigation works even when kit list is empty

    // Wait for the app to load
    await window.waitForSelector('[data-testid="app-content"]', {
      timeout: 10000,
    });

    // Check if we have an empty state or kit list
    const hasKits = await window.locator('[data-testid="kit-item"]').count();

    if (hasKits === 0) {
      // Verify empty state is shown
      const emptyState = await window.isVisible('[data-testid="empty-state"]');
      expect(emptyState).toBe(true);

      // Verify back button is not available/functional when there's nothing to navigate from
      const backButton = await window.isVisible('[data-testid="back-button"]');
      expect(backButton).toBe(false);
    } else {
      // If kits are available, this test is not applicable
      test.skip();
    }
  });

  test("should handle deep linking and direct navigation", async () => {
    // Wait for kit list to load first
    await window.waitForSelector('[data-testid="kit-list"]', {
      timeout: 10000,
    });

    // Get a kit name for direct navigation
    const firstKit = await window.locator('[data-testid="kit-item"]').first();
    const kitName = await firstKit.getAttribute("data-kit-name");

    if (kitName) {
      // Navigate directly to kit details via URL hash
      await window.evaluate((name) => {
        window.location.hash = `#/kits/${name}`;
      }, kitName);

      // Wait for kit details to load
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 5000,
      });

      // Verify we're on the correct kit details page
      const kitTitle = await window.locator('[data-testid="kit-title"]');
      await expect(kitTitle).toContainText(kitName);

      // Navigate back and verify it works
      const backButton = await window.locator('[data-testid="back-button"]');
      await backButton.click();

      // Wait for kit list
      await window.waitForSelector('[data-testid="kit-list"]', {
        timeout: 5000,
      });

      const kitListVisible = await window.isVisible('[data-testid="kit-list"]');
      expect(kitListVisible).toBe(true);
    } else {
      test.skip();
    }
  });
});
