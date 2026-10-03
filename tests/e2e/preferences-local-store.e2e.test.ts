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
 * RE-78: Preferences > Advanced > Change... ignored a folder that isn't a
 * local store without a word. It now says why and keeps the current store;
 * a folder that is one becomes the store. Playwright can't click the native
 * folder picker, so main's `dialog.showOpenDialog` answers with the folder.
 */
test.describe("[UC-05] [UC-06] Changing the local store in Preferences", () => {
  let electronApp: ElectronApplication | undefined;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let userData: string;
  const extraDirs: string[] = [];

  const settingsFile = () => path.join(userData, "romper-settings.json");
  const savedStore = async () =>
    (await fs.readJson(settingsFile())).localStorePath;

  async function openAdvancedPreferences() {
    await window.getByRole("button", { name: "Settings" }).click();
    await window.getByRole("button", { name: "Advanced" }).click();
  }

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    userData = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-user-"));
    // A saved store, as the installed app has it, so a change is saved too
    await fs.writeJson(settingsFile(), {
      localStorePath: testEnv.localStorePath,
    });

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
    await expect(window.locator('[data-testid="kit-item-A0"]')).toBeVisible({
      timeout: 15000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    for (const dir of extraDirs.splice(0)) {
      await fs.remove(dir).catch(() => {});
    }
    await fs.remove(userData).catch(() => {});
  });

  test("says why a folder that isn't a store can't be used", async () => {
    const notAStore = await fs.mkdtemp(
      path.join(os.tmpdir(), "romper-e2e-not-a-store-"),
    );
    extraDirs.push(notAStore);
    await chooseFolderInOpenDialog(electronApp!, notAStore);

    await openAdvancedPreferences();
    await window.getByRole("button", { name: "Change..." }).click();

    await expect(
      window.locator('[data-testid="change-local-store-error"]'),
    ).toHaveText(
      "This directory does not contain a valid Romper database (.romperdb folder).",
    );
    await expect(window.locator("#local-store-path")).toHaveText(
      testEnv.localStorePath,
    );
    expect(await savedStore()).toBe(testEnv.localStorePath);
  });

  test("switches to a folder that holds a store", async () => {
    const otherStore = `${testEnv.localStorePath}-other`;
    await fs.copy(testEnv.localStorePath, otherStore);
    extraDirs.push(otherStore);
    await chooseFolderInOpenDialog(electronApp!, otherStore);

    await openAdvancedPreferences();
    await window.getByRole("button", { name: "Change..." }).click();

    await expect(window.locator("#local-store-path")).toHaveText(otherStore);
    await expect(
      window.locator('[data-testid="change-local-store-error"]'),
    ).toHaveCount(0);
    await expect.poll(savedStore).toBe(otherStore);
  });
});
