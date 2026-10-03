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

// RE-75: in an editable kit, Scan Kit (`/`) used to rename every voice from
// its first sample, overwriting names typed by hand
test.describe("[UC-27] Voice names", () => {
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
    // Fixture kit A0 has a kick on voice 1
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("a name typed by hand survives a scan", async () => {
    await window.getByTitle("Edit voice name").first().click();
    const input = window.locator("input:focus");
    await input.fill("My Kick");
    await input.press("Enter");
    const name = window.locator('[data-testid="voice-name-1"]');
    await expect(name).toHaveText("My Kick");

    // Scan the kit from the keyboard, away from any text field
    await window.locator('[data-testid="kit-editor"]').click({
      position: { x: 5, y: 5 },
    });
    await window.keyboard.press("/");
    await expect(
      window.locator('[data-testid="kit-scan-status"]'),
    ).toContainText("Found");

    await expect(name).toHaveText("My Kick");
    const saved = await window.evaluate(async () => {
      const res = await (globalThis as unknown as ApiWindow).electronAPI.getKit(
        "A0",
      );
      return res.data?.voices?.find((v) => v.voice_number === 1)?.voice_alias;
    });
    expect(saved).toBe("My Kick");
  });
});
