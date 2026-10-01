import type { ElectronApplication, Page } from "@playwright/test";

import { _electron as electron } from "@playwright/test";

import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * The guard itself (RE-67): each kind of error the app can report fails the
 * test unless the spec expects it. The failing cases are marked
 * `test.fail()`, so they pass only if the guard fails them.
 */
test.describe("E2E error guard", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: { ...process.env, ...testEnv.environment },
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("fails a test on an unexpected renderer console error", async () => {
    test.fail();
    await window.evaluate(() => console.error("e2e guard check: renderer"));
  });

  test("fails a test on an uncaught page error", async () => {
    test.fail();
    await window.evaluate(() => {
      setTimeout(() => {
        throw new Error("e2e guard check: page");
      });
    });
    await window.waitForTimeout(250);
  });

  test("fails a test on an error in the main process's stderr", async () => {
    test.fail();
    await electronApp.evaluate(() => console.error("e2e guard check: main"));
    await window.waitForTimeout(250);
  });

  test("fails a test on an error toast, even one gone before the end", async () => {
    test.fail();
    await window.evaluate(() => {
      const toast = document.createElement("div");
      toast.dataset.testid = "message-error";
      toast.textContent = "e2e guard check: toast";
      document.body.append(toast);
      setTimeout(() => toast.remove(), 100);
    });
    await window.waitForTimeout(250);
  });

  test.describe("with the errors expected", () => {
    test.use({
      expectedMessages: {
        "these tests report it on purpose": { pattern: /e2e guard check/ },
      },
    });

    test("passes when the spec expects the error", async () => {
      await window.evaluate(() => console.error("e2e guard check: expected"));
      await electronApp.evaluate(() =>
        console.error("e2e guard check: expected in main"),
      );
      await window.waitForTimeout(250);
      await expect(window.locator('[data-testid="kits-view"]')).toBeVisible();
    });
  });
});
