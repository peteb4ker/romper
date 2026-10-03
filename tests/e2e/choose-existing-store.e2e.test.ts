import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

import { chooseFolderInOpenDialog } from "../utils/e2e-dialogs";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * Choose Existing Store in the setup wizard: point Romper at a folder that
 * already holds a local store, and the library opens. Choosing the
 * `.romperdb` folder itself is refused with a message that says what's
 * wrong. Playwright can't click the native folder picker, so main's
 * `dialog.showOpenDialog` answers with the folder.
 */
test.describe("[UC-04] Choose an existing local store", () => {
  test.use({
    expectedMessages: {
      "each test starts with no local store, so the wizard opens": {
        pattern: /No local store configured/,
        sources: ["main-stdout"],
      },
    },
  });

  let electronApp: ElectronApplication | undefined;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let userData: string;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    userData = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-user-"));

    // No saved store and no override, so the wizard opens as on a new machine
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (e): e is [string, string] =>
          e[1] !== undefined && e[0] !== "ROMPER_LOCAL_PATH",
      ),
    );
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js", `--user-data-dir=${userData}`],
      env: {
        ...env,
        ROMPER_SDCARD_PATH: testEnv.environment.ROMPER_SDCARD_PATH,
        ROMPER_USER_DATA_DIR: userData,
      },
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    await fs.remove(userData).catch(() => {});
  });

  async function browseForExistingStore(folder: string) {
    await chooseFolderInOpenDialog(electronApp!, folder);
    await window.locator('[data-testid="choose-existing-store-btn"]').click();
    await window.locator('[data-testid="browse-existing-store-btn"]').click();
  }

  test("opens the library in a folder that holds a store", async () => {
    await browseForExistingStore(testEnv.localStorePath);

    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-item-A0"]')).toBeVisible({
      timeout: 15000,
    });

    // Saved, so the next launch opens the same store
    await expect
      .poll(
        async () =>
          (
            await fs
              .readJson(path.join(userData, "romper-settings.json"))
              .catch(() => ({}))
          ).localStorePath,
      )
      .toBe(testEnv.localStorePath);
  });

  test("refuses the .romperdb folder itself and says why", async () => {
    await browseForExistingStore(
      path.join(testEnv.localStorePath, ".romperdb"),
    );

    await expect(
      window.getByText(
        "This directory does not contain a valid Romper database (.romperdb folder).",
      ),
    ).toBeVisible();
    // Still choosing: nothing was opened or saved
    await expect(
      window.locator('[data-testid="browse-existing-store-btn"]'),
    ).toBeVisible();
    await expect(window.locator('[data-testid="kit-item-A0"]')).toHaveCount(0);
    const settingsFile = path.join(userData, "romper-settings.json");
    const saved = (await fs.pathExists(settingsFile))
      ? await fs.readJson(settingsFile)
      : {};
    expect(saved.localStorePath).toBeUndefined();
  });
});
