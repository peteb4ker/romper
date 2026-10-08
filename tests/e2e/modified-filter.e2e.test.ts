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

// RE-35: a gain change or a bank rename used to leave the kit out of the
// Modified filter, though the next write changes it on the card
test.describe("[UC-11] Modified filter", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const showModifiedOnly = () =>
    window
      .getByRole("button", {
        name: "Show kits with changes not yet on the SD card",
      })
      .click();

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

  test("[UC-24] a gain change puts the kit in the Modified filter", async () => {
    // Fixture kit A0 has a kick on voice 1
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
    const header = window.locator('[data-testid="kit-header"]');
    await expect(header).not.toContainText("Modified");

    // The knob can sit under the status bar in the hidden test window, so
    // the wheel event goes to the knob itself
    const knob = window.getByRole("slider", { name: /^Gain/ }).first();
    await knob.dispatchEvent("wheel", { deltaY: -100 });
    await expect(knob).toHaveAttribute("aria-label", "Gain: +1 dB");
    await expect(header).toContainText("Modified");

    await window.locator('button[title="Back"]').click();
    await window.locator('[data-testid="kit-grid"]').waitFor();
    await showModifiedOnly();

    await expect(window.getByTestId("kit-item-A0")).toBeVisible();
    await expect(window.getByTestId("kit-item-B1")).toHaveCount(0);
  });

  test("[UC-12] renaming a bank puts its kits in the Modified filter", async () => {
    await window.getByTestId("bank-name-edit-B").first().click();
    const input = window.getByTestId("bank-name-input-B");
    await input.fill("Boards");
    await input.press("Enter");
    await expect(window.getByTestId("bank-name-display-B").first()).toHaveText(
      "Boards",
    );

    await showModifiedOnly();

    await expect(window.getByTestId("kit-item-B1")).toBeVisible();
    await expect(window.getByTestId("kit-item-A0")).toHaveCount(0);
  });
});
