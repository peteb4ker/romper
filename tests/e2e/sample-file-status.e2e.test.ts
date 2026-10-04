import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import {
  createBrokenKitStore,
  removeBrokenKitStore,
} from "../utils/broken-kit-store";
import { expect, test } from "../utils/e2e-error-guard";
import { type E2ETestEnvironment } from "../utils/e2e-fixture-extractor";

const QUARANTINE_LABEL =
  "Quarantined: this kit won't be written to the card until it's fixed";

// #537, Pete's decisions on #577: catch file problems early and say how to
// fix them. The broken-kit store's A0 has a missing file and B1 a file
// Romper can't read; nothing is known about them until a kit opens or the
// card is written. A missing file is labelled and explained but doesn't
// quarantine the kit; a file Romper can't read quarantines it, in the kit
// editor and on its kit card.
test.describe("[UC-13] [Q-04] Missing and unreadable sample files (#537)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let card: string;

  const kitCard = (kit: string) =>
    window.locator(`[data-testid="kit-item-${kit}"]`);
  const indicator = (kit: string) =>
    kitCard(kit).locator('[data-testid="quarantine-indicator"]');

  async function open(kit: string) {
    await kitCard(kit).click();
    await window.waitForSelector('[data-testid="kit-editor"]');
  }

  async function back() {
    await window
      .locator('[data-testid="kit-header"]')
      .getByTitle("Back")
      .click();
    await window.waitForSelector('[data-testid="kit-grid"]');
  }

  test.beforeEach(async () => {
    testEnv = await createBrokenKitStore();
    card = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-card-"));
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: {
        ...process.env,
        ...testEnv.environment,
        ROMPER_SDCARD_PATH: card,
      },
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await removeBrokenKitStore(testEnv);
    await fs.remove(card).catch(() => {});
  });

  test("a missing file is labelled with how to fix it, and doesn't quarantine the kit", async () => {
    await open("A0");

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
    await expect(indicator("B1")).toHaveCount(0);

    await open("B1");

    await expect(
      window.locator('[data-testid="sample-file-label-1-0"]'),
    ).toHaveText("Can't be read");
    const header = window.locator('[data-testid="kit-header-quarantined"]');
    await expect(header).toHaveText("Quarantined");
    await expect(header).toHaveAttribute("title", QUARANTINE_LABEL);
    await expect(
      window.locator('[data-testid="kit-quarantine-notice"]'),
    ).toContainText("Romper can't read 1_kick.wav.");

    await back();
    await expect(indicator("B1")).toBeVisible();
    await expect(indicator("B1")).toHaveAttribute(
      "aria-label",
      QUARANTINE_LABEL,
    );
    // A0 hasn't been opened, and a missing file wouldn't quarantine it
    await expect(indicator("A0")).toHaveCount(0);
  });

  test("a file deleted since the kit was last opened shows as missing when it opens again", async () => {
    await open("A0");
    await expect(
      window.locator('[data-testid="sample-file-label-1-0"]'),
    ).toHaveCount(0);
    await back();

    // The kick was read and found fine; now it's gone
    await fs.remove(path.join(testEnv.localStorePath, "A0", "1_kick.wav"));
    await open("A0");

    await expect(
      window.locator('[data-testid="sample-file-label-1-0"]'),
    ).toHaveText("File not found");
    await expect(
      window.locator('[data-testid="kit-missing-files-notice"]'),
    ).toContainText("1_kick.wav on voice 1 wasn't found");
  });

  test("a write records what it found, so the kit card shows quarantine without opening the kit", async () => {
    test.setTimeout(60000);
    await expect(indicator("B1")).toHaveCount(0);

    await window.locator('[data-testid="sync-to-sd-card"]').click();
    await window.waitForSelector('[data-testid="sync-dialog"]');
    await window
      .locator('[data-testid="bank-summary"]')
      .waitFor({ state: "visible", timeout: 10000 });
    // A0's missing snare is skipped; B1 is quarantined, not written
    await window.locator('label[for="skipInvalidFiles"]').click();
    await window.locator('[data-testid="confirm-sync"]').click();
    await window
      .locator("text=Write Complete")
      .waitFor({ state: "visible", timeout: 15000 });
    await window.locator('[data-testid="cancel-sync"]').click();
    await window.waitForSelector('[data-testid="sync-dialog"]', {
      state: "detached",
    });

    await expect(indicator("B1")).toBeVisible();
    await expect(indicator("A0")).toHaveCount(0);
    expect(await fs.pathExists(path.join(card, "B1"))).toBe(false);
  });
});
