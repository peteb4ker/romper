import { expect, test } from "@playwright/test";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * Sample audio end to end: the fixture's WAVs are real 16-bit PCM, and
 * extraction points each sample's source_path at the extracted copy, so the
 * main process can read them and the renderer can decode and draw them.
 */
test.describe("Sample audio", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();

    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: {
        ...process.env,
        ...testEnv.environment,
      },
      timeout: 30000,
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    if (testEnv) {
      await cleanupE2EFixture(testEnv);
    }
  });

  test("main process serves a sample's audio buffer from ROMPER_LOCAL_PATH", async () => {
    const result = await window.evaluate(async () => {
      const res = await window.electronAPI.getSampleAudioBuffer("A0", 1, 0);
      const bytes = res.data ? new Uint8Array(res.data) : null;
      return {
        byteLength: bytes?.byteLength ?? 0,
        error: res.error,
        header: bytes
          ? String.fromCodePoint(
              ...bytes.subarray(0, 4),
              ...bytes.subarray(8, 12),
            )
          : null,
        success: res.success,
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.header).toBe("RIFFWAVE");
    expect(result.byteLength).toBeGreaterThan(44);
  });

  test("voice panel draws a waveform for a loaded sample", async () => {
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]', {
      timeout: 5000,
    });

    const canvas = window.locator(
      '[data-testid="voice-panel-1"] [data-testid="sample-waveform-1-0"]',
    );
    await expect(canvas).toBeVisible();

    // The canvas starts blank and the envelope is drawn once decodeAudioData
    // resolves, so poll for painted pixels.
    await expect
      .poll(
        () =>
          canvas.evaluate((el: HTMLCanvasElement) => {
            const ctx = el.getContext("2d");
            if (!ctx) return 0;
            const { data } = ctx.getImageData(0, 0, el.width, el.height);
            let painted = 0;
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] > 0) painted++;
            }
            return painted;
          }),
        { timeout: 5000 },
      )
      .toBeGreaterThan(0);
  });
});
