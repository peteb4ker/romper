import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

// RE-48: the gain knob had no keyboard support, trigger conditions could
// only be set by right-click, and modals had no dialog role, focus trap or
// Escape. The fixture has kits A0 (a kick on voice 1) and B1.
test.describe("[Q-06] Keyboard and assistive technology", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: { ...process.env, ...testEnv.environment },
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

  async function openKit(name: string) {
    await window.locator(`[data-testid="kit-item-${name}"]`).click();
    await window.waitForSelector('[data-testid="kit-editor"]');
  }

  test("[UC-24] the gain knob takes the arrow and Page keys", async () => {
    await openKit("A0");
    await window.getByTitle("Enable editable mode").click();
    const header = window.locator('[data-testid="kit-header"]');
    const selected = window.getByTestId("sample-selected-voice-1");
    await expect(selected).toBeVisible();
    const selectedBefore = await selected.getAttribute("aria-label");

    const knob = window.getByRole("slider", { name: /^Gain/ }).first();
    await knob.focus();
    await window.keyboard.press("ArrowUp");
    await expect(knob).toHaveAttribute("aria-label", "Gain: +1 dB");
    await window.keyboard.press("PageDown");
    await expect(knob).toHaveAttribute("aria-label", "Gain: -5 dB");
    await window.keyboard.press("0");
    await expect(knob).toHaveAttribute("aria-label", "Gain: 0 dB");
    await window.keyboard.press("End");
    await expect(knob).toHaveAttribute("aria-label", "Gain: +12 dB");

    // The arrows changed the gain, not the selected sample
    await expect(selected).toHaveAttribute("aria-label", selectedBefore!);
    await expect(header).toContainText("Modified");
  });

  test("[UC-31] C sets a step's trigger condition from the keyboard", async () => {
    await openKit("A0");
    const handle = window.locator('[data-testid="kit-step-sequencer-handle"]');
    if (await handle.isVisible()) await handle.click();
    const grid = window.locator('[data-testid="kit-step-sequencer-grid"]');
    await grid.waitFor();
    // The grid takes focus when the sequencer opens
    await expect(grid).toBeFocused();

    // Step 2 of voice 1, then its options
    await window.keyboard.press("ArrowRight");
    await window.keyboard.press("c");
    const popover = window.getByTestId("condition-popover");
    await expect(popover).toBeVisible();
    await expect(window.getByTestId("condition-option-always")).toBeFocused();

    // "Always", then 1:2
    await window.keyboard.press("ArrowDown");
    await expect(window.getByTestId("condition-option-1:2")).toBeFocused();
    await window.keyboard.press("Enter");

    await expect(popover).toHaveCount(0);
    await expect(window.getByTestId("seq-condition-0-1")).toBeVisible();
    await expect(window.getByTestId("seq-step-0-1")).toHaveAttribute(
      "aria-label",
      /\(1:2\)/,
    );
    // Focus is back on the grid, so the next key reaches the steps
    await expect(grid).toBeFocused();
  });

  test("[UC-35] a dialog keeps focus inside and closes on Escape", async () => {
    const settings = window.getByRole("button", { name: "Settings" });
    await settings.click();
    const dialog = window.getByRole("dialog", { name: "Preferences" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Tab around more times than the dialog has controls: focus stays in it
    for (let i = 0; i < 12; i++) {
      await window.keyboard.press("Tab");
      const inside = await dialog.evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect(inside).toBe(true);
    }

    await window.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(settings).toBeFocused();
  });
});
