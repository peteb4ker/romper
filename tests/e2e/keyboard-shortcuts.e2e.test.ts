import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import type { ElectronAPI } from "../../shared/electronApi";

import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

type ApiWindow = { electronAPI: ElectronAPI } & typeof globalThis;

// RE-38: "F" both jumped to bank F and bookmarked the focused kit, and the
// single-key shortcuts ignored Cmd, Ctrl and Alt, so a menu accelerator
// such as Cmd+, also stepped to the previous kit. In the kit browser plain
// letters now only jump to banks and Shift+F stars the focused kit; in the
// kit editor F stars the open kit (#504). Combinations with Cmd, Ctrl or Alt
// are left to the menu and the system. The fixture has kits A0 and B1.
test.describe("[UC-07] [UC-10] Keyboard shortcuts", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const card = (kit: string) =>
    window.locator(`[data-testid="kit-item-${kit}"]`);
  // The open kit's name (the header also names the previous and next kits)
  const openKit = () => window.locator('[data-testid="kit-header-name"]');
  const savedFavourite = (kitName: string) =>
    window.evaluate(async (name) => {
      const res = await (globalThis as unknown as ApiWindow).electronAPI.getKit(
        name,
      );
      return res.data?.is_favorite;
    }, kitName);

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
    await expect(card("A0").getByTitle("Add to favorites")).toBeVisible();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("Shift+F stars the focused kit in the browser, and F and * don't", async () => {
    await window.keyboard.press("a");
    await expect(card("A0")).toBeFocused();

    await window.keyboard.press("f");
    await window.keyboard.press("*");
    // Nothing should happen; give a save time to show if it would
    await window.waitForTimeout(300);
    await expect(card("A0").getByTitle("Add to favorites")).toBeVisible();
    expect(await savedFavourite("A0")).toBe(false);

    await window.keyboard.press("Shift+F");
    await expect(card("A0").getByTitle("Remove from favorites")).toBeVisible();
    expect(await savedFavourite("A0")).toBe(true);
    // Shift+F doesn't also jump away from the focused kit
    await expect(card("A0")).toBeFocused();

    await window.keyboard.press("Shift+F");
    await expect(card("A0").getByTitle("Add to favorites")).toBeVisible();
    expect(await savedFavourite("A0")).toBe(false);
  });

  test("F stars the open kit in the editor", async () => {
    await card("B1").click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await expect(openKit()).toHaveText("B1");
    const headerStar = window
      .locator('[data-testid="kit-editor"]')
      .getByTitle(/to favorites|from favorites/);

    await expect(headerStar).toHaveAttribute("title", "Add to favorites");
    await window.keyboard.press("f");
    await expect(headerStar).toHaveAttribute("title", "Remove from favorites");
    expect(await savedFavourite("B1")).toBe(true);

    await window.keyboard.press("f");
    await expect(headerStar).toHaveAttribute("title", "Add to favorites");
    expect(await savedFavourite("B1")).toBe(false);
  });

  test("a bank letter with Ctrl, Cmd or Alt held doesn't jump", async () => {
    await window.keyboard.press("a");
    await expect(card("A0")).toBeFocused();

    for (const combo of ["Control+b", "Meta+b", "Alt+b"]) {
      await window.keyboard.press(combo);
    }
    await expect(card("A0")).toHaveAttribute("aria-selected", "true");
    await expect(card("B1")).toHaveAttribute("aria-selected", "false");

    await window.keyboard.press("b");
    await expect(card("B1")).toBeFocused();
  });

  test("Cmd+, or Ctrl+, in the kit editor doesn't step to the previous kit", async () => {
    await card("B1").click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await expect(openKit()).toHaveText("B1");

    // Send the combinations as the page receives them. A real Cmd+, goes
    // to the menu first on macOS, and what Ctrl or Alt with "," types
    // differs by platform and layout.
    for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
      await window.evaluate((mod) => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            key: ",",
            [mod]: true,
          }),
        );
      }, modifier);
    }
    // Nothing should happen; give a kit change time to show if it would
    await window.waitForTimeout(500);
    await expect(openKit()).toHaveText("B1");
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();

    // The plain key still works
    await window.keyboard.press(",");
    await expect(openKit()).toHaveText("A0");
  });
});
