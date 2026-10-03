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

/**
 * Makes main refuse every save on an IPC channel, the way a database
 * failure comes back (`success: false`)
 */
async function refuseSaves(app: ElectronApplication, channel: string) {
  await app.evaluate(({ ipcMain }, ch) => {
    ipcMain.removeHandler(ch);
    ipcMain.handle(ch, () => ({
      error: "e2e: this save is refused",
      success: false,
    }));
  }, channel);
}

// #511: a step, condition, BPM, slice, slice division or slicer setting that
// main didn't save used to snap back (or stay on screen) with nothing said.
// Each now goes back to what was saved, and one message says so.
test.describe("[UC-36] Sequencer edits that aren't saved say so (#511)", () => {
  test.use({
    expectedMessages: {
      "a refused save is an error toast, mirrored to the console": {
        pattern:
          /Couldn't (save the (steps|trigger conditions|BPM|slices|slice division)|turn slicing (on|off) for voice \d)\b.*Try again\./,
      },
    },
  });

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

    // Fixture kit A0: a kick on voice 1
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    const handle = window.locator('[data-testid="kit-step-sequencer-handle"]');
    if (await handle.isVisible()) await handle.click();
    await window.waitForSelector('[data-testid="kit-step-sequencer-grid"]');
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("[UC-30] [UC-31] a step, condition or BPM that isn't saved goes back", async () => {
    await refuseSaves(electronApp, "update-step-pattern");
    await refuseSaves(electronApp, "update-trigger-conditions");
    await refuseSaves(electronApp, "update-kit-bpm");
    const errors = window.locator('[data-testid="message-error"]');

    // Step: turn step 6 of voice 3 on or off
    const step = window.locator('[data-testid="seq-step-2-5"]');
    const wasOn = await step.getAttribute("aria-pressed");
    await step.click();

    await expect(
      window.getByText(
        "Couldn't save the steps, so they're back as they were. Try again.",
      ),
    ).toBeVisible();
    await expect(step).toHaveAttribute("aria-pressed", wasOn ?? "false");
    await expect(errors).toHaveCount(1);

    // Trigger condition: set step 6 of voice 3 to play every other loop
    await step.click({ button: "right" });
    await window.locator('[data-testid="condition-option-1:2"]').click();

    await expect(
      window.getByText(
        "Couldn't save the trigger conditions, so they're back as they were. Try again.",
      ),
    ).toBeVisible();
    await expect(
      window.locator('[data-testid="seq-condition-2-5"]'),
    ).toHaveCount(0);

    // BPM: three nudges up, all refused, give one message
    const bpm = window.locator('[data-testid="bpm-input"]');
    const before = await bpm.inputValue();
    await bpm.focus();
    await bpm.press("ArrowUp");
    await bpm.press("ArrowUp");
    await bpm.press("ArrowUp");

    await expect(
      window.getByText(
        `Couldn't save the BPM, so it's back to ${before}. Try again.`,
      ),
    ).toHaveCount(1);
    await expect(bpm).toHaveValue(before);
  });

  test("[UC-33] a slice, slice division or slicer setting that isn't saved goes back", async () => {
    // Slice voice 1 and turn its first step on, both saved
    const toggle = window.locator('[data-testid="slice-toggle-0"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const step = window.locator('[data-testid="seq-step-0-0"]');
    if ((await step.getAttribute("aria-pressed")) !== "true") {
      await step.click();
      await expect(step).toHaveAttribute("aria-pressed", "true");
    }
    await expect(window.locator('[data-testid="slice-strip"]')).toBeVisible();

    await refuseSaves(electronApp, "update-slice-steps");
    await refuseSaves(electronApp, "update-kit-slicer-division");
    await refuseSaves(electronApp, "update-voice-slice-settings");

    // Slice: scroll the step's start slice up three notches, all refused,
    // for one message
    const sliceStart = await step.getAttribute("aria-label");
    await step.hover();
    for (let i = 0; i < 3; i++) await window.mouse.wheel(0, -100);

    await expect(
      window.getByText(
        "Couldn't save the slices, so they're back as they were. Try again.",
      ),
    ).toHaveCount(1);
    await expect(step).toHaveAttribute("aria-label", sliceStart ?? "");

    // Division
    const division = window.locator('[data-testid="slice-division"]');
    const divisionBefore = await division.inputValue();
    await division.selectOption("32");

    await expect(
      window.getByText(
        `Couldn't save the slice division, so it's back to ${divisionBefore} slices. Try again.`,
      ),
    ).toBeVisible();
    await expect(division).toHaveValue(divisionBefore);

    // Slice mode: turning it off isn't saved, so it stays on
    await toggle.click();

    await expect(
      window.getByText("Couldn't turn slicing off for voice 1. Try again."),
    ).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});
