import { type Page } from "@playwright/test";
import fs from "fs-extra";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { _electron as electron, type ElectronApplication } from "playwright";

import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

// RE-64: a kit could only be created in a bank that already had one, so an
// empty library had no way to make its first kit.
test.describe("[UC-14] Create a kit", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  async function launch() {
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: { ...process.env, ...testEnv.environment },
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  }

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("[UC-14] creates the first kit in an empty library", async () => {
    // Empty the fixture store, like the setup wizard's "empty" option
    const db = new DatabaseSync(
      path.join(testEnv.localStorePath, ".romperdb", "romper.sqlite"),
    );
    try {
      db.exec("DELETE FROM samples; DELETE FROM voices; DELETE FROM kits;");
    } finally {
      db.close();
    }
    for (const kitName of testEnv.metadata.kits) {
      await fs.remove(path.join(testEnv.localStorePath, kitName));
    }

    await launch();

    await expect(window.getByTestId("empty-library-hint")).toBeVisible();
    await expect(window.locator('[data-testid^="kit-item-"]')).toHaveCount(0);

    await window.getByTestId("add-kit-A").click();

    await expect(window.getByTestId("kit-item-A0")).toBeVisible({
      timeout: 10000,
    });
    await expect(window.getByTestId("empty-library-hint")).toHaveCount(0);
  });

  test("[UC-14] creates a kit in a bank with no kits", async () => {
    // The fixture has kits in banks A and B only
    await launch();

    await expect(window.getByTestId("add-kit-C")).toHaveCount(0);

    await window
      .getByTestId("bank-nav")
      .getByRole("button", { name: "Jump to bank C" })
      .click();
    await window.getByTestId("add-kit-C").click();

    await expect(window.getByTestId("kit-item-C0")).toBeVisible({
      timeout: 10000,
    });
  });
});
