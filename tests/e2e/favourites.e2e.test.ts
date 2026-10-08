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

type ApiWindow = { electronAPI: ElectronAPI } & typeof globalThis;

const savedFavourite = (window: Page, kitName: string) =>
  window.evaluate(async (name) => {
    const res = await (globalThis as unknown as ApiWindow).electronAPI.getKit(
      name,
    );
    return res.data?.is_favorite;
  }, kitName);

// RE-37: the browser kept its own map of favourites that overrode the
// database value, while the editor toggled the kit list. A star set in the
// grid didn't show in the editor, starring it there again unstarred it in
// the database, and the grid kept showing the stale star.
test.describe("[UC-10] Favourites", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const gridCard = () => window.locator('[data-testid="kit-item-A0"]');
  const header = () => window.locator('[data-testid="kit-header"]');

  const openA0 = async () => {
    await gridCard().click();
    await window.waitForSelector('[data-testid="kit-editor"]');
  };

  const backToBrowser = async () => {
    await header().getByTitle("Back").click();
    await expect(gridCard()).toBeVisible();
  };

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
    // The fixture's A0 starts as a kit that isn't a favourite
    await expect(gridCard().getByTitle("Add to favorites")).toBeVisible();
    expect(await savedFavourite(window, "A0")).toBe(false);
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("a star set in the grid shows in the editor, and unstarring there shows in the grid", async () => {
    await gridCard().getByTitle("Add to favorites").click();
    await expect(gridCard().getByTitle("Remove from favorites")).toBeVisible();
    expect(await savedFavourite(window, "A0")).toBe(true);

    await openA0();
    await expect(header().getByTitle("Remove from favorites")).toBeVisible();

    await header().getByTitle("Remove from favorites").click();
    await expect(header().getByTitle("Add to favorites")).toBeVisible();
    expect(await savedFavourite(window, "A0")).toBe(false);

    await backToBrowser();
    await expect(gridCard().getByTitle("Add to favorites")).toBeVisible();

    // The Favorites filter agrees: A0 is no longer in it
    await window
      .getByRole("button", { name: "Show only favorite kits" })
      .click();
    await expect(gridCard()).toHaveCount(0);
  });

  test("a star set in the editor shows in the grid and the Favorites filter", async () => {
    await openA0();
    await header().getByTitle("Add to favorites").click();
    await expect(header().getByTitle("Remove from favorites")).toBeVisible();
    expect(await savedFavourite(window, "A0")).toBe(true);

    await backToBrowser();
    await expect(gridCard().getByTitle("Remove from favorites")).toBeVisible();

    await window
      .getByRole("button", { name: "Show only favorite kits" })
      .click();
    await expect(gridCard()).toBeVisible();

    // Unstarring in the filtered grid removes A0 from it
    await gridCard().getByTitle("Remove from favorites").click();
    await expect(gridCard()).toHaveCount(0);
    expect(await savedFavourite(window, "A0")).toBe(false);
  });
});
