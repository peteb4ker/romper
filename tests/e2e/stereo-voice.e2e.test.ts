import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import type { ElectronAPI } from "../../shared/electronApi";

import { dropFiles } from "../utils/e2e-drop";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import { encodeTestWav, sine } from "../validation/support/wav";

type ApiWindow = { electronAPI: ElectronAPI } & typeof globalThis;

/** Kit A0's samples on a voice, read through the app's own IPC */
async function samplesOnVoice(window: Page, voice: number) {
  return window.evaluate(async (v) => {
    const res = await (
      globalThis as unknown as ApiWindow
    ).electronAPI.getAllSamplesForKit("A0");
    return (res.data ?? [])
      .filter((s) => s.voice_number === v)
      .map((s) => s.filename);
  }, voice);
}

test.describe("Stereo voice linking", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let sourceDir: string;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-src-"));
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: { ...process.env, ...testEnv.environment },
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });

    // Fixture kit A0: a kick on voice 1, a snare on voice 2, 3 and 4 empty
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    if (sourceDir) await fs.rm(sourceDir, { force: true, recursive: true });
  });

  test("[UC-28] unlinking a voice that holds a stereo file removes the stereo badge (RE-69)", async () => {
    await window.locator('[data-testid="link-button-3-4"]').click();
    const badge = window.locator('[data-testid="stereo-badge-3"]');
    await expect(badge).toBeVisible();

    const file = path.join(sourceDir, "stereo pad.wav");
    await fs.writeFile(
      file,
      encodeTestWav([sine(220, 0.3, 44100), sine(330, 0.3, 44100, 0.3)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    await dropFiles(window, 3, [file]);
    await expect
      .poll(() => samplesOnVoice(window, 3), { timeout: 10000 })
      .toEqual(["stereo pad.wav"]);

    // Unlinking only clears the voice's stereo setting: the 2-channel file
    // stays on voice 3 and is mixed to mono at the next write (RE-29)
    await badge.click();
    await expect(badge).toHaveCount(0);
    await expect(
      window.locator('[data-testid="link-button-3-4"]'),
    ).toBeVisible();
    expect(await samplesOnVoice(window, 3)).toEqual(["stereo pad.wav"]);
    const voice3 = await window.evaluate(async () => {
      const res = await (globalThis as unknown as ApiWindow).electronAPI.getKit(
        "A0",
      );
      return res.data?.voices?.find((v) => v.voice_number === 3);
    });
    expect(voice3?.stereo_mode).toBe(false);
  });
  test("[UC-28] a read-only kit can't be linked or unlinked (RE-71)", async () => {
    // Link while editable, then lock the kit again
    await window.locator('[data-testid="link-button-3-4"]').click();
    await expect(
      window.locator('[data-testid="stereo-badge-3"]'),
    ).toBeVisible();
    await window.getByTitle("Disable editable mode").click();

    // The pair still shows, but nothing offers to change it
    await expect(
      window.locator('[data-testid="stereo-badge-3"]'),
    ).toBeVisible();
    await expect(
      window.locator('button[data-testid="stereo-badge-3"]'),
    ).toHaveCount(0);
    await expect(window.locator('[data-testid^="link-button-"]')).toHaveCount(
      0,
    );

    // And main refuses it, whatever the renderer does
    const result = await window.evaluate(async () =>
      (globalThis as unknown as ApiWindow).electronAPI.updateVoiceStereoMode(
        "A0",
        3,
        false,
      ),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/isn't editable/);
    const voice3 = await window.evaluate(async () => {
      const res = await (globalThis as unknown as ApiWindow).electronAPI.getKit(
        "A0",
      );
      return res.data?.voices?.find((v) => v.voice_number === 3);
    });
    expect(voice3?.stereo_mode).toBe(true);
  });
});
