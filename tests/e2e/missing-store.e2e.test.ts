import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * RE-80: a local store on a drive that isn't connected at launch is kept,
 * not forgotten. Romper shows the Invalid Local Store dialog (not the
 * first-run wizard), and Try Again opens the store once the drive is back.
 * The test stands in for the drive by moving the fixture store away and
 * back.
 */
test.describe("[UC-05] A local store that isn't there at launch", () => {
  test.use({
    expectedMessages: {
      "the saved store is missing at launch, which main reports": {
        pattern: /Saved local store can't be opened|  - (Path|Error):/,
        sources: ["main-stderr"],
      },
    },
  });

  let electronApp: ElectronApplication | undefined;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let userData: string;
  let offline: string;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    userData = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-user-"));
    // A saved store, as the installed app would have it, not an override
    await fs.writeJson(path.join(userData, "romper-settings.json"), {
      localStorePath: testEnv.localStorePath,
    });
    // The drive isn't connected
    offline = `${testEnv.localStorePath}.offline`;
    await fs.move(testEnv.localStorePath, offline);

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
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (await fs.pathExists(offline)) {
      await fs.move(offline, testEnv.localStorePath, { overwrite: true });
    }
    if (testEnv) await cleanupE2EFixture(testEnv);
    await fs.remove(userData).catch(() => {});
  });

  test("keeps the saved store and opens it with Try Again once it's back", async () => {
    await expect(window.getByText("Invalid Local Store")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toHaveCount(0);
    const saved = await fs.readJson(
      path.join(userData, "romper-settings.json"),
    );
    expect(saved.localStorePath).toBe(testEnv.localStorePath);

    // Still missing: Try Again says so and keeps the dialog
    await window.locator('[data-testid="retry-local-store-btn"]').click();
    await expect(window.locator('[data-testid="retry-error"]')).toBeVisible();

    // The drive is connected again
    await fs.move(offline, testEnv.localStorePath);
    await window.locator('[data-testid="retry-local-store-btn"]').click();

    await expect(window.getByText("Invalid Local Store")).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-item-A0"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("can set up a new store instead", async () => {
    await expect(window.getByText("Invalid Local Store")).toBeVisible({
      timeout: 15000,
    });

    await window.getByText("Set Up a New Local Store").click();

    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toBeVisible();
    await expect(window.getByText("Invalid Local Store")).toHaveCount(0);
  });
});
