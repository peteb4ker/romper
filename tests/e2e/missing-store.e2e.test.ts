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
 * RE-80: a local store on a drive that isn't connected at launch is kept,
 * not forgotten. Romper shows the Invalid Local Store dialog (not the
 * first-run wizard), and Try Again opens the store once the drive is back.
 * The test stands in for the drive by moving the fixture store away and
 * back.
 *
 * #553: while the store is missing, Romper doesn't read it: no kit load,
 * which used to race the store's status and report errors. (The startup
 * bank scan that raced it too is gone, #567.) The renderer logs the load
 * when it starts, so the tests check that log rather than wait for the
 * errors the race sometimes produced.
 */

// Logged when the kit load starts
const KIT_LOAD_STARTED = "[useKitDataManager] Loading kits from";

// How long main holds back the store's status at launch
const STATUS_DELAY_MS = 750;

/**
 * Holds back main's first answer to get-local-store-status, so the
 * renderer runs for a while with the saved path but no status. That is the
 * window #553's race needed; on a fast machine the status usually arrived
 * first and hid it. Playwright attaches before the app is ready, so the
 * handler isn't registered yet and wrapping ipcMain.handle catches it; if
 * it already is, its entry in ipcMain's handler map is wrapped instead.
 */
async function holdBackFirstStoreStatus(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }, delayMs) => {
    type Handler = (...args: unknown[]) => unknown;
    const channel = "get-local-store-status";
    let held = false;
    const delayed =
      (handler: Handler): Handler =>
      async (...args) => {
        if (!held) {
          held = true;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        return handler(...args);
      };
    const handlers = (
      ipcMain as unknown as { _invokeHandlers?: Map<string, Handler> }
    )._invokeHandlers;
    const registered = handlers?.get(channel);
    if (registered) {
      handlers?.set(channel, delayed(registered));
      return;
    }
    const register = ipcMain.handle.bind(ipcMain);
    ipcMain.handle = (name, handler) =>
      register(name, name === channel ? delayed(handler as Handler) : handler);
  }, STATUS_DELAY_MS);
}
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
  let rendererLogs: string[];
  const logged = (text: string) =>
    rendererLogs.filter((line) => line.includes(text)).length;

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
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js", `--user-data-dir=${userData}`],
      env: appEnv(
        {
          ROMPER_SDCARD_PATH: testEnv.environment.ROMPER_SDCARD_PATH,
          ROMPER_USER_DATA_DIR: userData,
        },
        { omit: ["ROMPER_LOCAL_PATH"] },
      ),
      timeout: 30000,
    });
    await holdBackFirstStoreStatus(electronApp);
    window = await electronApp.firstWindow();
    rendererLogs = [];
    window.on("console", (msg) => {
      rendererLogs.push(msg.text());
    });
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
    // The missing store isn't read
    expect(logged(KIT_LOAD_STARTED)).toBe(0);

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
    // Once it's back, its kits are loaded
    await expect.poll(() => logged(KIT_LOAD_STARTED)).toBeGreaterThan(0);
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

    // Neither the missing store nor the store being set up was read
    expect(logged(KIT_LOAD_STARTED)).toBe(0);
  });
});
