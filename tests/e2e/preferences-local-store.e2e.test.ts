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
import { openSequencer } from "../utils/e2e-sequencer";

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

  test("[UC-06] [UC-26] closes the open kit and forgets its undo (#568)", async () => {
    // Both stores have a kit A0
    const otherStore = `${testEnv.localStorePath}-other`;
    await fs.copy(testEnv.localStorePath, otherStore);
    extraDirs.push(otherStore);
    await chooseFolderInOpenDialog(electronApp!, otherStore);

    // An edit to the first store's A0, on its undo stack
    await window.locator('[data-testid="kit-item-A0"]').click();
    const editor = window.locator('[data-testid="kit-editor"]');
    await expect(editor).toBeVisible();
    await openSequencer(window);
    const before = await stepPattern();
    await window.locator('[data-testid="seq-step-2-5"]').click();
    await expect.poll(stepPattern).not.toEqual(before);

    // File > Change Local Store..., with the kit still open
    await electronApp!.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send(
        "menu-change-local-store-directory",
      );
    });
    const dialog = window.locator('[data-testid="change-local-store-dialog"]');
    await dialog.getByRole("button", { name: "Choose Directory" }).click();
    await dialog.getByRole("button", { name: "Update Directory" }).click();
    await expect.poll(savedStore).toBe(otherStore);

    await expect(editor).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-item-A0"]')).toBeVisible();

    // The new store's A0 gets a pattern of its own; undo leaves it alone
    const own = Array.from({ length: 4 }, (_, voice) =>
      Array.from({ length: 16 }, (_, step) => (step === voice ? 127 : 0)),
    );
    await window.evaluate(
      (pattern) => window.electronAPI.updateStepPattern("A0", pattern),
      own,
    );
    await pressUndoKey();
    // Give an undo time to reach main
    await window.waitForTimeout(1000);
    expect(await stepPattern()).toEqual(own);
    await expect(editor).toHaveCount(0);
  });

  /** The step pattern of the current store's A0, as saved */
  async function stepPattern() {
    return window.evaluate(async () => {
      const kit = await window.electronAPI.getKit("A0");
      return kit.data?.step_pattern ?? null;
    });
  }

  /** Cmd/Ctrl+Z as a key press, as the user types it */
  async function pressUndoKey() {
    await electronApp!.evaluate(({ BrowserWindow }, isMac) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      const modifiers = [isMac ? "meta" : "control"] as ("control" | "meta")[];
      contents.sendInputEvent({ keyCode: "Z", modifiers, type: "keyDown" });
      contents.sendInputEvent({ keyCode: "Z", modifiers, type: "keyUp" });
    }, process.platform === "darwin");
  }
});
