import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/** The event ErrorBoundary's test-only trigger listens for (test mode) */
const RENDER_FAULT_EVENT = "romper:e2e-render-fault";

/**
 * Make one guarded area of the window fail to render, as a crash in that
 * area would: its error boundary's test-only trigger throws on the next
 * render (ROMPER_TEST_MODE, which the fixture environment sets).
 */
async function crash(window: Page, area: string) {
  await window.evaluate(
    ([event, detail]) => {
      globalThis.dispatchEvent(new CustomEvent(event, { detail }));
    },
    [RENDER_FAULT_EVENT, area] as const,
  );
}

/**
 * UC-36: an error boundary around the kit editor and the kit list catches
 * a crash in that area and shows a recovery screen (Try again, Back, Reload
 * window) instead of a blank window, and each way out works.
 */
test.describe("[UC-36] Recovery screen after a crash", () => {
  test.use({
    expectedMessages: {
      "the test makes an area fail to render, which the boundary logs and shows":
        { pattern: /render fault forced by an e2e test/ },
    },
  });

  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const boundary = () => window.locator('[data-testid="error-boundary"]');

  /** Open fixture kit A0 in the kit editor */
  async function openKit() {
    await window.locator('[data-testid="kit-item-A0"]').click();
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    await expect(
      window.locator('[data-testid="voice-panel-1"]').getByText("1_kick.wav"),
    ).toBeVisible();
  }

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

  test("a crash in the kit editor shows the recovery screen, and Back returns to the kits", async () => {
    await openKit();
    await crash(window, "Kit editor");

    // The editor is replaced by the recovery screen, not a blank window
    await expect(boundary()).toBeVisible();
    await expect(boundary()).toHaveAttribute("role", "alert");
    await expect(boundary()).toContainText("Kit editor stopped working");
    await expect(boundary()).toContainText("Your library is unchanged");
    await expect(boundary()).toContainText(
      "Kit editor: render fault forced by an e2e test",
    );
    await expect(window.locator('[data-testid="kit-editor"]')).toHaveCount(0);
    await expect(
      window.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    await expect(
      window.getByRole("button", { name: "Reload window" }),
    ).toBeVisible();

    // The rest of the window still works
    await expect(window.locator('[data-testid="status-bar"]')).toBeVisible();

    await window.getByRole("button", { name: "Back to kits" }).click();
    await expect(boundary()).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-grid"]')).toBeVisible();

    // And the kit opens again
    await openKit();
  });

  test("Try again shows the kit editor again", async () => {
    await openKit();
    await crash(window, "Kit editor");
    await expect(boundary()).toBeVisible();

    await window.getByRole("button", { name: "Try again" }).click();

    await expect(boundary()).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    await expect(
      window.locator('[data-testid="voice-panel-1"]').getByText("1_kick.wav"),
    ).toBeVisible();
  });

  test("Reload window brings the app back", async () => {
    await openKit();
    await crash(window, "Kit editor");
    await expect(boundary()).toBeVisible();

    await Promise.all([
      window.waitForEvent("load"),
      window.getByRole("button", { name: "Reload window" }).click(),
    ]);

    await expect(window.locator('[data-testid="kits-view"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(boundary()).toHaveCount(0);
    await expect(window.locator('[data-testid="kit-item-A0"]')).toBeVisible();
    await openKit();
  });

  test("a crash in the kit list offers Try again and Reload, but no Back", async () => {
    await expect(window.locator('[data-testid="kit-grid"]')).toBeVisible();
    await crash(window, "Kit list");

    await expect(boundary()).toContainText("Kit list stopped working");
    await expect(
      window.locator('[data-testid="error-boundary-back"]'),
    ).toHaveCount(0);
    await expect(window.locator('[data-testid="status-bar"]')).toBeVisible();

    await window.getByRole("button", { name: "Try again" }).click();
    await expect(boundary()).toHaveCount(0);
    await openKit();
  });
});
