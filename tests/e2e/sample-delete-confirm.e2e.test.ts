import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * RE-44: "Confirm destructive actions" (on by default) was shown in
 * Preferences but never read, so a sample's trash button deleted at once.
 * With it on, the trash button asks first; with it off, it deletes at once.
 */
test.describe("[UC-23] [UC-35] Confirm destructive actions", () => {
  let electronApp: ElectronApplication | undefined;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let userData: string;

  const voice1Samples = () =>
    window.locator('[data-testid="sample-list-voice-1"] [role="option"]');

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    // Its own profile: turning the preference off must not reach other specs
    userData = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-user-"));
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js", `--user-data-dir=${userData}`],
      env: appEnv({
        ...testEnv.environment,
        ROMPER_USER_DATA_DIR: userData,
      }),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 15000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    await fs.remove(userData).catch(() => {});
  });

  async function openEditableKit() {
    // Fixture kit A0 has a sample on voice 1
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
  }

  test("asks before deleting a sample: Cancel keeps it, Delete removes it", async () => {
    await openEditableKit();
    const before = await voice1Samples().count();
    expect(before).toBeGreaterThan(0);
    const first = voice1Samples().first();
    const name = await first.getAttribute("aria-label");

    await first.getByRole("button", { name: "Delete sample" }).click();
    const prompt = window.locator('[data-testid="confirm-delete-sample"]');
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole("button", { name: "Cancel" })).toBeFocused();

    await prompt.getByRole("button", { name: "Cancel" }).click();
    await expect(prompt).toHaveCount(0);
    await expect(voice1Samples()).toHaveCount(before);
    await expect(window.getByRole("option", { name: name! })).toBeVisible();
    // Still in the kit
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();

    await first.getByRole("button", { name: "Delete sample" }).click();
    await prompt
      .locator('[data-testid="confirm-delete-sample-button"]')
      .click();
    await expect(prompt).toHaveCount(0);
    await expect(voice1Samples()).toHaveCount(before - 1);
  });

  test("deletes at once with the preference off", async () => {
    await window.getByRole("button", { name: "Settings" }).click();
    const confirm = window.getByLabel("Confirm destructive actions");
    await expect(confirm).toBeChecked();
    // Controlled: it changes once main has saved the setting
    await confirm.click();
    await expect(confirm).not.toBeChecked();
    await window.getByRole("button", { name: "Close preferences" }).click();

    await openEditableKit();
    const before = await voice1Samples().count();
    expect(before).toBeGreaterThan(0);

    await voice1Samples()
      .first()
      .getByRole("button", { name: "Delete sample" })
      .click();

    await expect(voice1Samples()).toHaveCount(before - 1);
    await expect(
      window.locator('[data-testid="confirm-delete-sample"]'),
    ).toHaveCount(0);
  });
});
