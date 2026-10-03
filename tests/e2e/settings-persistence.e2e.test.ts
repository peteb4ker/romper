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
 * RE-21: only the store and card paths were loaded at startup, so the theme
 * and "Confirm destructive actions" reset on every launch (and the next
 * write erased them from the file). Change both in Preferences, quit, and
 * launch again with the same profile.
 */
test.describe("[UC-35] Preferences survive a relaunch", () => {
  let electronApp: ElectronApplication | undefined;
  let testEnv: E2ETestEnvironment;
  let userData: string;

  async function launch(): Promise<Page> {
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js", `--user-data-dir=${userData}`],
      env: {
        ...process.env,
        ...testEnv.environment,
        ROMPER_USER_DATA_DIR: userData,
      },
      timeout: 30000,
    });
    const window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 15000,
    });
    return window;
  }

  async function openPreferences(window: Page) {
    await window.getByRole("button", { name: "Settings" }).click();
    await expect(
      window.getByRole("heading", { name: "Preferences" }),
    ).toBeVisible();
  }

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    userData = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-user-"));
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    await fs.remove(userData).catch(() => {});
  });

  test("keeps the theme and Confirm destructive actions", async () => {
    let window = await launch();

    await openPreferences(window);
    const confirm = window.getByLabel("Confirm destructive actions");
    await expect(confirm).toBeChecked(); // on by default
    // Controlled: it changes once main has saved the setting
    await confirm.click();
    await expect(confirm).not.toBeChecked();
    await window.getByRole("button", { name: "Appearance" }).click();
    await window.getByRole("button", { name: "Dark theme" }).click();
    await expect(window.locator("html")).toHaveClass(/\bdark\b/);

    await electronApp!.close();
    electronApp = undefined;

    const saved = await fs.readJson(
      path.join(userData, "romper-settings.json"),
    );
    expect(saved).toMatchObject({
      confirmDestructiveActions: false,
      themeMode: "dark",
    });

    // Same profile, new launch
    window = await launch();

    await expect(window.locator("html")).toHaveClass(/\bdark\b/);
    await openPreferences(window);
    await expect(
      window.getByLabel("Confirm destructive actions"),
    ).not.toBeChecked();
    await window.getByRole("button", { name: "Appearance" }).click();
    await expect(
      window.getByRole("button", { name: "Dark theme" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
