import { type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

// The suite runs with ROMPER_HEADLESS=true (see playwright.config.ts). A
// hidden window must still behave like a visible one, or specs that rely on
// animation frames, timers or visibility would pass or fail for the wrong
// reasons.
test.describe("Headless window", () => {
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

  // RE-68: the installed app also uses the "Romper" folder, so a run without
  // the override would overwrite the developer's real settings.
  test("keeps settings out of the installed app's folder", async () => {
    const override = process.env.ROMPER_USER_DATA_DIR;
    expect(override).toBeTruthy();
    const paths = await electronApp.evaluate(({ app }) => ({
      appData: app.getPath("appData"),
      userData: app.getPath("userData"),
    }));
    expect(paths.userData).toBe(override);
    expect(paths.userData.startsWith(paths.appData)).toBe(false);
  });

  test("keeps the window hidden when ROMPER_HEADLESS=true", async () => {
    const isVisible = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    );

    expect(isVisible).toBe(process.env.ROMPER_HEADLESS !== "true");
  });

  test("renders as a visible, unthrottled page", async () => {
    const state = await window.evaluate(async () => {
      const frames = await new Promise<number>((resolve) => {
        let count = 0;
        const tick = () => {
          count++;
          if (count < 10) requestAnimationFrame(tick);
          else resolve(count);
        };
        requestAnimationFrame(tick);
        setTimeout(() => resolve(count), 2000);
      });
      return {
        frames,
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      };
    });

    expect(state).toEqual({
      frames: 10,
      hidden: false,
      visibilityState: "visible",
    });
  });
});
