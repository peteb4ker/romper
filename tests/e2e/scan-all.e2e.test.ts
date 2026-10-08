import * as fs from "node:fs";
import * as path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import type { ElectronAPI } from "../../shared/electronApi";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import { openStoreDb } from "../utils/e2e-store-db";

type ApiWindow = { electronAPI: ElectronAPI } & typeof globalThis;

const NEW_FILE = "3_extra.wav";

// RE-43: File > Scan All scanned only the kits the current search or
// filters showed, and with the kit editor open it scanned the banks only
test.describe("[UC-13] Scan All", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  /** Samples of `kitName` in the database, by file name */
  const sampleFiles = (kitName: string) =>
    window.evaluate(async (name) => {
      const res = await (
        globalThis as unknown as ApiWindow
      ).electronAPI.getAllSamplesForKit(name);
      return (res.data ?? []).map((sample) => sample.filename);
    }, kitName);

  /** What the File > Scan All menu item does, after its confirmation */
  const scanAllFromMenu = async () => {
    await window.evaluate(() => {
      globalThis.confirm = () => true;
    });
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send("menu-scan-all-kits");
    });
  };

  const launch = async () => {
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  };

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    // A new WAV in each fixture kit's folder, for the scan to find
    const wav = path.join(process.cwd(), "tests", "fixtures", "kick.wav");
    for (const kit of ["A0", "B1"]) {
      fs.copyFileSync(wav, path.join(testEnv.localStorePath, kit, NEW_FILE));
    }

    await launch();
    expect(await sampleFiles("A0")).not.toContain(NEW_FILE);
    expect(await sampleFiles("B1")).not.toContain(NEW_FILE);
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("scans every kit while a search hides some of them", async () => {
    await window.getByLabel("Search kits").fill("B1");
    await expect(window.locator('[data-testid="kit-item-A0"]')).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-item-B1"]')).toBeVisible();

    await scanAllFromMenu();

    await expect(
      window.locator('[data-testid="bulk-scan-complete"]'),
    ).toContainText("All 2 kits scanned", { timeout: 10000 });
    expect(await sampleFiles("A0")).toContain(NEW_FILE);
    expect(await sampleFiles("B1")).toContain(NEW_FILE);
  });

  // #586: the result used to clear after five seconds, failed kits and all
  test("keeps the failed kits on screen until dismissed", async () => {
    fs.rmSync(path.join(testEnv.localStorePath, "B1"), {
      force: true,
      recursive: true,
    });

    await scanAllFromMenu();

    const result = window.locator('[data-testid="bulk-scan-complete"]');
    await expect(result).toContainText("1 failed", { timeout: 10000 });
    await expect(result).toContainText("B1");
    // Past the five seconds a clean result shows for
    await window.waitForTimeout(6000);
    await expect(result).toContainText("1 failed");

    await window
      .locator('[data-testid="kit-browser-header"]')
      .getByRole("button", { name: "Dismiss message" })
      .click();
    await expect(result).toHaveCount(0);
  });

  // #620: a scan that failed outright still cleared after five seconds
  test.describe("in a store with no kits", () => {
    test.use({
      expectedMessages: {
        "the test scans a store with no kits, which fails on purpose": {
          pattern: /^No kits to scan$/,
          sources: ["ui"],
        },
      },
    });

    test("keeps a scan that fails outright on screen until dismissed", async () => {
      // A store with no kits: there's nothing to scan
      await electronApp.close();
      const db = openStoreDb(testEnv.localStorePath);
      try {
        db.exec("DELETE FROM samples; DELETE FROM voices; DELETE FROM kits;");
      } finally {
        db.close();
      }
      await launch();
      await expect(window.locator('[data-testid^="kit-item-"]')).toHaveCount(0);

      await scanAllFromMenu();

      const result = window.locator('[data-testid="bulk-scan-error"]');
      await expect(result).toHaveText("No kits to scan", { timeout: 10000 });
      // Past the five seconds a clean result shows for
      await window.waitForTimeout(6000);
      await expect(result).toHaveText("No kits to scan");

      await window
        .locator('[data-testid="kit-browser-header"]')
        .getByRole("button", { name: "Dismiss message" })
        .click();
      await expect(result).toHaveCount(0);
    });
  });

  test("scans every kit from the kit editor", async () => {
    await window.locator('[data-testid="kit-item-B1"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');

    await scanAllFromMenu();

    await expect(
      window.locator('[data-testid="message-success"]', {
        hasText: "All 2 kits scanned",
      }),
    ).toBeVisible({ timeout: 10000 });
    expect(await sampleFiles("A0")).toContain(NEW_FILE);
    expect(await sampleFiles("B1")).toContain(NEW_FILE);
  });
});
