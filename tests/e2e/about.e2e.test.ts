import { type ElectronApplication, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { _electron as electron } from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

// RE-72: the About dialog showed "Version: dev" in every build
test.describe("[UC-37] About", () => {
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

  // package.json's version, which a packaged app also reports through
  // app.getVersion() (an unpackaged launch like this one reports Electron's)
  test("shows the app's version", async () => {
    await window.getByRole("button", { name: "About Romper" }).click();

    await expect(window.getByText(/^Version:/)).toHaveText(
      `Version: ${version}`,
    );
  });
});
