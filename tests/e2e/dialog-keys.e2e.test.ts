import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

// #500: the kit browser's and kit editor's shortcuts listen on the window,
// so a bank letter pressed in a dialog jumped banks behind it, and Escape
// in a dialog also left the kit. They now leave keys to an open modal
// dialog, including the favorite key, ";" (#552). The fixture has kits A0
// and B1.
test.describe("[UC-07] Shortcuts behind a dialog", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const card = (kit: string) =>
    window.locator(`[data-testid="kit-item-${kit}"]`);
  const preferences = () => window.getByRole("dialog", { name: "Preferences" });

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("[UC-10] [Q-06] a bank letter or ; pressed in a dialog does nothing behind it", async () => {
    await window.keyboard.press("a");
    await expect(card("A0")).toBeFocused();

    await window.getByRole("button", { name: "Settings" }).click();
    await expect(preferences()).toBeVisible();

    await window.keyboard.press("b");
    await window.keyboard.press(";");
    // Nothing should happen behind the dialog; give a jump time to show
    await window.waitForTimeout(300);
    await expect(card("A0").getByTitle("Add to favorites")).toBeVisible();
    await expect(card("A0")).toHaveAttribute("aria-selected", "true");
    await expect(card("B1")).toHaveAttribute("aria-selected", "false");
    await expect(preferences()).toBeVisible();

    // Closed, the letters work again
    await window.keyboard.press("Escape");
    await expect(preferences()).toHaveCount(0);
    await window.keyboard.press("b");
    await expect(card("B1")).toHaveAttribute("aria-selected", "true");
  });

  test("[UC-10] [UC-18] [Q-06] the kit editor's keys, ; included, wait while a dialog is open", async () => {
    await card("B1").click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    const openKit = window.locator('[data-testid="kit-header-name"]');
    await expect(openKit).toHaveText("B1");
    const sequencerShown = await window
      .locator('[data-testid="kit-step-sequencer-grid"]')
      .isVisible();

    // The native menu's Preferences item sends this event
    await window.evaluate(() =>
      globalThis.dispatchEvent(new CustomEvent("menu-preferences")),
    );
    await expect(preferences()).toBeVisible();

    const headerStar = window
      .locator('[data-testid="kit-editor"]')
      .getByTitle(/to favorites|from favorites/);
    await window.keyboard.press(",");
    await window.keyboard.press("s");
    await window.keyboard.press(";");
    await window.waitForTimeout(300);
    await expect(openKit).toHaveText("B1");
    await expect(headerStar).toHaveAttribute("title", "Add to favorites");
    await expect(
      window.locator('[data-testid="kit-step-sequencer-grid"]'),
    ).toBeVisible({ visible: sequencerShown });

    // Escape closes the dialog, not the kit
    await window.keyboard.press("Escape");
    await expect(preferences()).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    await expect(openKit).toHaveText("B1");
  });
});
