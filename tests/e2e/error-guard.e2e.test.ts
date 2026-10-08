import type { ElectronApplication, Page } from "@playwright/test";

import { _electron as electron } from "@playwright/test";

import { appEnv } from "../utils/e2e-app-env";
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
/* eslint-disable sonarjs/assertions-in-tests -- the guard's own check is
   the assertion in these tests: test.fail() passes only if the guard fails
   them, so they deliberately call no expect(). */
test.describe("E2E error guard", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
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

  // RE-92: the renderer reports these itself (a toast and a console
  // error) rather than leaving them to Chromium, so they fail a test too
  test("fails a test on a promise nobody caught", async () => {
    test.fail();
    await window.evaluate(() => {
      void Promise.reject(new Error("e2e guard check: rejection"));
    });
    await expect(window.locator('[data-testid="message-error"]')).toBeVisible();
  });

  test("fails a test on an error in the main process's stderr", async () => {
    test.fail();
    await electronApp.evaluate(() => console.error("e2e guard check: main"));
    await window.waitForTimeout(250);
  });

  // Known noise (tests/validation/support/known-noise.ts) from an entry
  // that applies on every platform, so the check runs on each CI runner.
  // (Not the Node inspector's lines: Playwright reads those itself.)
  const NOISE =
    "[33352:1003/151539.925999:ERROR:third_party/blink/renderer/modules/media/audio/mojo_audio_output_ipc.cc:186] MojoAudioOutputIPC failed to acquire factory";

  test("ignores known noise in the main process's stderr", async () => {
    await electronApp.evaluate((_, line) => console.error(line), NOISE);
    await window.waitForTimeout(250);
    await expect(window.locator('[data-testid="kits-view"]')).toBeVisible();
  });

  test("still fails on known-noise text in the renderer console", async () => {
    test.fail();
    await window.evaluate((line) => console.error(line), NOISE);
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
