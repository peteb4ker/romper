import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

type CountingWindow = { __audioContexts: number } & typeof globalThis;

/**
 * Every sample slot plays through one shared AudioContext (RE-14). Each slot
 * used to open its own, up to 48 per kit, and open a new one whenever its
 * sample changed.
 */
test.describe("Audio contexts", () => {
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

  test("[UC-29] opening kits creates one audio context in all", async () => {
    // Count contexts from here on; none exist before a kit is opened
    await window.evaluate(() => {
      const w = globalThis as CountingWindow;
      w.__audioContexts = 0;
      const Original = globalThis.AudioContext;
      globalThis.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          w.__audioContexts++;
        }
      };
    });

    // Fixture kits A0 and B1 have a sample on voices 1 and 2
    for (const kit of ["A0", "B1", "A0"]) {
      await window.locator(`[data-testid="kit-item-${kit}"]`).click();
      await window.waitForSelector('[data-testid="kit-editor"]');
      await expect(window.locator("canvas").first()).toBeVisible();
      await window.waitForTimeout(300);
      await window.getByRole("button", { name: /back/i }).first().click();
      await window.waitForSelector('[data-testid="kit-grid"]');
    }

    const contexts = await window.evaluate(
      () => (globalThis as CountingWindow).__audioContexts,
    );
    expect(contexts).toBe(1);
  });
});
