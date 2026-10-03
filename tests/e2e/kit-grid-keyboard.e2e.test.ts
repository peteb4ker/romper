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

// RE-39: the grid treated index 0 as "nothing focused", so the arrow keys
// and Enter did nothing from the first kit, where focus starts; and Up and
// Down used a flat index while the rows are grouped by bank. The fixture
// has A0 and B1, each in its own bank, so they sit in rows one above the
// other.
test.describe("[UC-07] Kit grid keyboard navigation", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const card = (kit: string) =>
    window.locator(`[data-testid="kit-item-${kit}"]`);
  const header = () => window.locator('[data-testid="kit-header"]');

  const expectFocused = async (kit: string) => {
    await expect(card(kit)).toHaveAttribute("aria-selected", "true");
    await expect(card(kit)).toBeFocused();
  };

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
    await expect(card("A0")).toBeVisible();
    await expect(card("B1")).toBeVisible();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("Enter opens the first kit, which has focus by default", async () => {
    await expect(card("A0")).toHaveAttribute("aria-selected", "true");
    await window.locator('[data-testid="kit-grid"]').focus();

    await window.keyboard.press("Enter");

    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    await expect(header()).toContainText("A0");
  });

  test("arrow keys move from the first kit across bank rows", async () => {
    await window.locator('[data-testid="kit-grid"]').focus();

    await window.keyboard.press("ArrowDown");
    await expectFocused("B1");
    await expect(card("A0")).toHaveAttribute("aria-selected", "false");

    await window.keyboard.press("ArrowUp");
    await expectFocused("A0");

    await window.keyboard.press("ArrowRight");
    await expectFocused("B1");

    await window.keyboard.press("ArrowLeft");
    await expectFocused("A0");

    // Down, then Enter, opens the kit moved to
    await window.keyboard.press("ArrowDown");
    await window.keyboard.press("Enter");
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    await expect(header()).toContainText("B1");
  });

  test("a bank letter focuses the bank's first kit, ready for the arrows", async () => {
    await window.keyboard.press("b");
    await expectFocused("B1");

    await window.keyboard.press("ArrowUp");
    await expectFocused("A0");

    await window.keyboard.press("Enter");
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    await expect(header()).toContainText("A0");
  });
});
