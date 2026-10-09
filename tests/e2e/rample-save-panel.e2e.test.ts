import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { RAMPLE_SAVE_TEXT } from "../../app/renderer/components/rample-save/rampleSaveText";
import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import { seedRampleSaveCopy } from "../utils/rample-save-copy";

// #800 (stage 3 of #786): the kit editor's "On the Rample" section shows
// what the device saved for a kit, from the store's latest copy of the
// card's `_save` folder. The fixture's store gets a copy holding A0.rpl and
// settings.rpl; B1 has no file.
test.describe("[UC-08] [Q-08] [Q-06] The Rample's saved settings in the kit editor (#800)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  async function launch() {
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  }

  async function openKit(name: string) {
    await window.locator(`[data-testid="kit-item-${name}"]`).click();
    await window.waitForSelector('[data-testid="kit-editor"]');
  }

  const toggle = () =>
    window.getByRole("button", { exact: true, name: RAMPLE_SAVE_TEXT.title });

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("shows a kit's saved values, collapsed until opened from the keyboard", async () => {
    await seedRampleSaveCopy(testEnv.localStorePath, { A0: { zz_test: 7 } });
    await launch();
    await openKit("A0");

    await expect(toggle()).toHaveAttribute("aria-expanded", "false");
    await expect(window.getByTestId("rample-save-body")).toBeHidden();

    await toggle().focus();
    await window.keyboard.press("Enter");
    await expect(toggle()).toHaveAttribute("aria-expanded", "true");

    const level = window.getByTestId("rample-save-row-level");
    await expect(level.getByRole("cell")).toHaveText([
      "42",
      "127",
      "127",
      "127",
    ]);
    await expect(window.getByTestId("rample-save-firmware")).toHaveText(
      RAMPLE_SAVE_TEXT.firmware("2.00"),
    );
    await expect(window.getByTestId("rample-save-other")).toContainText(
      "zz_test",
    );

    // Another kit, with no file in the copy: no values, not defaults
    await window.keyboard.press(".");
    await expect(window.getByTestId("rample-save-no-file")).toContainText(
      RAMPLE_SAVE_TEXT.noFile("B1"),
    );
    await expect(window.getByTestId("rample-save-voices")).toHaveCount(0);
  });

  test("says there's no copy yet when the store has none", async () => {
    await launch();
    await openKit("A0");
    await toggle().click();
    await expect(window.getByTestId("rample-save-no-copy")).toHaveText(
      RAMPLE_SAVE_TEXT.noCopy,
    );
  });
});
