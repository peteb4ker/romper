import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { expect, test } from "../utils/e2e-error-guard";

const NOT_SAVED = "Couldn't save the local store setting. Try again.";

// How long a whole setup run may take, as the other setup specs allow
// (onboarding-errors). The UI's expect timeout is for the page reacting,
// not for a setup's database and IPC work on a slow runner (#632).
const SETUP_TIMEOUT = 15_000;

/**
 * #528: when Romper can't save which local store to use, it says so and
 * keeps what it has, and trying again saves only the setting. The tests
 * make the save fail by putting a folder where the settings file goes, so
 * main can't replace it on any platform; removing the folder lets the next
 * save through.
 */
test.describe("Saving the local store setting fails (#528)", () => {
  test.use({
    expectedMessages: {
      "each test starts with a store that can't be opened, or none": {
        pattern:
          /No local store configured|Saved local store can't be opened|  - (Path|Error):/,
        sources: ["main-stdout", "main-stderr"],
      },
      "the app says the setting wasn't saved": {
        pattern: /Couldn't save the local store setting\. Try again\./,
        sources: ["ui", "renderer-console"],
      },
      // Main logs the failed rename with its stack and the error's fields
      // (EISDIR here, EPERM on Windows), and the renderer logs the refusal
      "the test makes saving the settings file fail": {
        pattern:
          /Error occurred in handler for 'write-settings'|Failed to update local store path|romper-settings\.json|^\s+at |^\s+(errno|code|syscall|path|dest): |^[{}]$/,
        sources: ["main-stderr", "renderer-console"],
      },
    },
  });

  let electronApp: ElectronApplication | undefined;
  let window: Page;
  let userData: string;
  let tempDirs: string[] = [];

  const settingsFile = () => path.join(userData, "romper-settings.json");

  async function tempDir(prefix: string) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  /** Launches Romper on its own settings, which hold `settings` */
  async function launch(settings: Record<string, unknown>) {
    userData = await tempDir("romper-e2e-user-");
    await fs.writeJson(settingsFile(), settings);
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (e): e is [string, string] =>
          e[1] !== undefined && e[0] !== "ROMPER_LOCAL_PATH",
      ),
    );
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js", `--user-data-dir=${userData}`],
      env: { ...env, ROMPER_USER_DATA_DIR: userData },
      timeout: 30000,
    });
    // The test types the target path, which main asks the user to approve
    await approveLocalStorePrompts(electronApp);
    window = await electronApp.firstWindow();
  }

  /** Saving settings fails until `allowSettingsSave` */
  async function refuseSettingsSave() {
    await fs.remove(settingsFile());
    await fs.outputFile(path.join(settingsFile(), "blocker"), "");
  }

  async function allowSettingsSave() {
    await fs.remove(settingsFile());
  }

  /**
   * Waits until the action just taken has finished, whichever way it went,
   * and returns what it ended on: the first of `outcomes` (test ids) to
   * show. The caller then checks it's the right one, so a wrong outcome
   * fails at once with what happened, and a slow one isn't mistaken for a
   * missing one.
   */
  async function settledOn(...outcomes: string[]) {
    const any = window.locator(
      outcomes.map((id) => `[data-testid="${id}"]`).join(", "),
    );
    await expect(any.first()).toBeVisible({ timeout: SETUP_TIMEOUT });
    return any.first().getAttribute("data-testid");
  }

  async function savedStore() {
    return (await fs.readJson(settingsFile())).localStorePath;
  }

  test.afterEach(async () => {
    await electronApp?.close();
    electronApp = undefined;
    for (const dir of tempDirs) await fs.remove(dir).catch(() => {});
    tempDirs = [];
  });

  test("[UC-01] [UC-03] setup keeps the store it built, and Try again saves only the setting", async () => {
    await launch({});
    const target = path.join(await tempDir("romper-e2e-target-"), "romper");
    await window.locator('[data-testid="wizard-source-blank"]').click();
    await window.locator("#local-store-path-input").fill(target);
    await refuseSettingsSave();

    await window.locator('[data-testid="wizard-initialize-btn"]').click();

    // Setup runs (database, IPC) before the save that fails
    expect(await settledOn("wizard-error", "wizard-post-init-guidance")).toBe(
      "wizard-error",
    );
    await expect(window.locator('[data-testid="wizard-error"]')).toHaveText(
      NOT_SAVED,
    );
    // The finished store is kept, not cleaned up or moved aside
    const db = path.join(target, ".romperdb", "romper.sqlite");
    expect(await fs.pathExists(db)).toBe(true);
    expect(await fs.readdir(target)).toEqual([".romperdb"]);

    // Try again saves the setting, and setup ends as it would have
    await allowSettingsSave();
    await window.locator('[data-testid="wizard-initialize-btn"]').click();

    // The last try's message is still up until the retry clears it, so
    // wait for the outcome this time
    await expect(
      window.locator('[data-testid="blank-folder-guidance"]'),
    ).toBeVisible({ timeout: SETUP_TIMEOUT });
    await expect(window.locator('[data-testid="wizard-error"]')).toHaveCount(0);
    expect(await savedStore()).toBe(target);
    expect(await fs.pathExists(db)).toBe(true);
  });

  test("[UC-05] Set Up a New Local Store says so when it can't forget the saved store", async () => {
    const missing = path.join(await tempDir("romper-e2e-gone-"), "romper");
    await launch({ localStorePath: missing });
    await expect(window.getByText("Invalid Local Store")).toBeVisible({
      timeout: 15000,
    });
    await refuseSettingsSave();

    await window.locator('[data-testid="rerun-wizard-btn"]').click();

    expect(await settledOn("rerun-wizard-error", "local-store-wizard")).toBe(
      "rerun-wizard-error",
    );
    await expect(
      window.locator('[data-testid="rerun-wizard-error"]'),
    ).toHaveText(NOT_SAVED);
    await expect(window.getByText("Invalid Local Store")).toBeVisible();
    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toHaveCount(0);

    // Once it can be saved, the same button opens the setup wizard
    await allowSettingsSave();
    await window.locator('[data-testid="rerun-wizard-btn"]').click();

    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toBeVisible({ timeout: SETUP_TIMEOUT });
    expect(await savedStore()).toBeNull();
  });
});
