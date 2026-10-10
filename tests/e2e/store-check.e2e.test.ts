import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import {
  createBrokenKitStore,
  removeBrokenKitStore,
} from "../utils/broken-kit-store";
import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import { type E2ETestEnvironment } from "../utils/e2e-fixture-extractor";

// #812, stage 1 of docs/developer/store-check.md: main checks the store's
// sample files in the background once the kit grid has loaded, so a file
// deleted or broken on disk is found without opening its kit. The only
// visible result is the existing quarantine icon on the kit card.
test.describe("[UC-05] [Q-01] The store check finds broken sample files without opening the kit (#812)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const indicator = (kit: string) =>
    window.locator(
      `[data-testid="kit-item-${kit}"] [data-testid="quarantine-indicator"]`,
    );

  /** What the store holds about a sample file, read while the app runs */
  function statusOf(kit: string, filename: string) {
    const db = new DatabaseSync(
      path.join(testEnv.localStorePath, ".romperdb", "romper.sqlite"),
      { readOnly: true },
    );
    try {
      const row = db
        .prepare(
          "SELECT source_status FROM samples WHERE kit_name = ? AND filename = ?",
        )
        .get(kit, filename) as { source_status: null | string } | undefined;
      return row?.source_status;
    } finally {
      db.close();
    }
  }

  test.beforeEach(async () => {
    // A0's snare is gone and B1's kick isn't a WAV any more
    testEnv = await createBrokenKitStore();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
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
  });

  test("a file Romper can't read quarantines its kit's card, and a deleted file's row reads missing, with no kit opened", async () => {
    test.setTimeout(60000);

    // The check starts a few seconds after the grid loads
    await expect(indicator("B1")).toBeVisible({ timeout: 30000 });

    // A missing file doesn't quarantine its kit, and the card shows
    // nothing new for it
    await expect(indicator("A0")).toHaveCount(0);
    expect(statusOf("A0", "2_snare.wav")).toBe("missing");
    expect(statusOf("B1", "1_kick.wav")).toBe("unreadable");
    // The fine files were read once and recorded
    expect(statusOf("A0", "1_kick.wav")).toBe("readable");
  });

  test("is silent otherwise: no message appears, and no other kit is marked", async () => {
    test.setTimeout(60000);
    await expect(indicator("B1")).toBeVisible({ timeout: 30000 });

    await expect(window.locator('[data-testid^="message-"]')).toHaveCount(0);
    await expect(
      window.locator('[data-testid="quarantine-indicator"]'),
    ).toHaveCount(1);
  });
});
