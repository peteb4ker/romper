import fs from "fs-extra";
import path from "node:path";
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

// #537, Pete's decisions on #577: catch file problems early and say how to
// fix them. The fixture's samples have never been checked, so opening a
// kit checks their files once. A missing file is labelled and explained but
// doesn't quarantine the kit; a file Romper can't read quarantines it, in
// the kit editor and on its kit card.
test.describe("[UC-13] [Q-04] Missing and unreadable sample files (#537)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    // A0's snare is gone; B1's kick isn't a WAV any more
    await fs.remove(path.join(testEnv.localStorePath, "A0", "2_snare.wav"));
    await fs.writeFile(
      path.join(testEnv.localStorePath, "B1", "1_kick.wav"),
      "not a wav file",
    );
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: { ...process.env, ...testEnv.environment },
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("a missing file is labelled with how to fix it, and doesn't quarantine the kit", async () => {
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');

    await expect(
      window.locator('[data-testid="sample-file-label-2-0"]'),
    ).toHaveText("File not found");
    await expect(
      window.locator('[data-testid="kit-missing-files-notice"]'),
    ).toContainText(
      "2_snare.wav on voice 2 wasn't found: it was moved or deleted.",
    );
    // The kick on voice 1 is fine
    await expect(
      window.locator('[data-testid="sample-file-label-1-0"]'),
    ).toHaveCount(0);
    await expect(
      window.locator('[data-testid="kit-header-quarantined"]'),
    ).toHaveCount(0);
    await expect(
      window.locator('[data-testid="kit-quarantine-notice"]'),
    ).toHaveCount(0);
  });

  test("an unreadable file quarantines the kit in the editor and the kit browser", async () => {
    // Before B1 is opened, nothing is known about its files
    await expect(
      window.locator(
        '[data-testid="kit-item-B1"] [data-testid="quarantine-indicator"]',
      ),
    ).toHaveCount(0);

    await window.locator('[data-testid="kit-item-B1"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');

    await expect(
      window.locator('[data-testid="sample-file-label-1-0"]'),
    ).toHaveText("Can't be read");
    const header = window.locator('[data-testid="kit-header-quarantined"]');
    await expect(header).toHaveText("Quarantined");
    await expect(header).toHaveAttribute(
      "title",
      "Quarantined: this kit won't be written to the card until it's fixed",
    );
    await expect(
      window.locator('[data-testid="kit-quarantine-notice"]'),
    ).toContainText("Romper can't read 1_kick.wav.");

    await window
      .locator('[data-testid="kit-header"]')
      .getByTitle("Back")
      .click();
    const indicator = window.locator(
      '[data-testid="kit-item-B1"] [data-testid="quarantine-indicator"]',
    );
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveAttribute(
      "aria-label",
      "Quarantined: this kit won't be written to the card until it's fixed",
    );
    // A0 hasn't been opened, and a missing file wouldn't quarantine it
    await expect(
      window.locator(
        '[data-testid="kit-item-A0"] [data-testid="quarantine-indicator"]',
      ),
    ).toHaveCount(0);
  });
});
