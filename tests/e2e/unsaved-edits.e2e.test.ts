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
import { openSequencer } from "../utils/e2e-sequencer";

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

// RE-91: a gain, a voice name, a level or a sample mode that main didn't
// save used to stay on screen with nothing said. Each now goes back to what
// was saved, and one message says so.
test.describe("[UC-36] Edits that aren't saved say so (RE-91)", () => {
  test.use({
    expectedMessages: {
      "a refused save is an error toast, mirrored to the console": {
        pattern:
          /Couldn't save the (gain|name|level|sample mode) for .*Try again\./,
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
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });

    // Fixture kit A0: a kick on voice 1
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
    await window.waitForSelector('[data-testid="drop-zone-voice-3"]');
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("[UC-24] [UC-27] a gain or voice name that isn't saved goes back", async () => {
    await refuseSaves(electronApp, "update-sample-gain");
    await refuseSaves(electronApp, "update-voice-alias");
    const errors = window.locator('[data-testid="message-error"]');

    // Gain: turn the kick's knob up a step
    const knob = window
      .locator('[data-testid="voice-panel-1"]')
      .getByRole("slider")
      .first();
    const before = await knob.getAttribute("aria-valuenow");
    await knob.hover();
    await window.mouse.wheel(0, -100);

    await expect(errors).toHaveCount(1);
    await expect(errors).toContainText(
      /Couldn't save the gain for .+\.wav, so it's back to [+-]?\d+ dB\. Try again\./,
    );
    await expect(knob).toHaveAttribute("aria-valuenow", before ?? "0");

    // Voice name
    const name = window.locator('[data-testid="voice-name-1"]');
    const oldName = await name.textContent();
    await window.getByTitle("Edit voice name").first().click();
    const input = window.locator("input:focus");
    await input.fill("Not Saved");
    await input.press("Enter");

    await expect(
      window.getByText("Couldn't save the name for voice 1. Try again."),
    ).toBeVisible();
    await expect(name).toHaveText(oldName ?? "");
  });

  test("[UC-32] a level or sample mode that isn't saved goes back", async () => {
    await refuseSaves(electronApp, "update-voice-volume");
    await refuseSaves(electronApp, "update-voice-sample-mode");
    await openSequencer(window);

    // Level: drop voice 1 to 0
    const level = window.locator('[data-testid="voice-volume-0"]');
    const before = await level.inputValue();
    await level.focus();
    await level.press("Home");

    await expect(
      window.getByText(
        `Couldn't save the level for voice 1, so it's back to ${before}. Try again.`,
      ),
    ).toBeVisible();
    await expect(level).toHaveValue(before);

    // Sample mode: switch voice 1 to random
    await window.locator('[data-testid="sample-mode-0-random"]').click();

    await expect(
      window.getByText(
        "Couldn't save the sample mode for voice 1, so it's back to 1st. Try again.",
      ),
    ).toBeVisible();
    await expect(
      window.locator('[data-testid="sample-mode-0-first"]'),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
