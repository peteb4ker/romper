import { _electron as electron } from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * Messages from the kit views reach the toast stack (RE-11). They used to go
 * into a second message store that nothing rendered, so no success or error
 * message from the kit browser or editor was ever shown.
 */
test.describe("[UC-36] Messages", () => {
  let electronApp: Awaited<ReturnType<typeof electron.launch>>;
  let window: Awaited<ReturnType<typeof electronApp.firstWindow>>;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("[UC-13] shows the result of File > Scan All as a toast", async () => {
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
    // Nothing is announced on a normal launch
    await expect(window.locator('[data-testid^="message-"]')).toHaveCount(0);
    // The kit editor reports Scan All as a toast; the browser shows it in
    // its scan panel
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');

    // Scan All asks for confirmation first
    await window.evaluate(() => {
      globalThis.confirm = () => true;
    });

    // What the File > Scan All menu item sends to the window
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send("menu-scan-all-kits");
    });

    await expect(
      window.locator('[data-testid="message-success"]').first(),
    ).toContainText("kits scanned", { timeout: 10000 });
  });

  // RE-92: a promise that rejects outside a render, such as an IPC call
  // nobody awaited, used to reach only the console
  test.describe("a promise nobody caught", () => {
    test.use({
      expectedMessages: {
        "this test rejects a promise on purpose, which is logged and shown": {
          pattern:
            /A background task failed|Something Romper was doing in the background didn't finish/,
        },
      },
    });

    test("shows one error message, without the reason", async () => {
      await window.evaluate(() => {
        void Promise.reject(new Error("e2e: nobody awaited this"));
        void Promise.reject(new Error("e2e: nor this"));
      });

      const errors = window.locator('[data-testid="message-error"]');
      await expect(errors).toHaveCount(1);
      await expect(errors).toContainText(
        "Something Romper was doing in the background didn't finish. Check that your last change took effect, and try it again if it didn't.",
      );
      await expect(errors).not.toContainText("nobody awaited");
    });
  });
});
