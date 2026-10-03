import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Locator,
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

/** Kit A0's samples on a voice, in slot order, read through the app's IPC */
async function samplesOnVoice(window: Page, voice: number) {
  return window.evaluate(async (v) => {
    const res = await (
      globalThis as unknown as ApiWindow
    ).electronAPI.getAllSamplesForKit("A0");
    return (res.data ?? [])
      .filter((s) => s.voice_number === v)
      .sort((a, b) => a.slot_number - b.slot_number)
      .map((s) => ({ filename: s.filename, gain: s.gain_db }));
  }, voice);
}

// RE-45: playback state was keyed by voice and file name, and gain by file
// name alone. Two files with the same name in one voice played together, and
// same-named files in different voices showed one gain between them. Both
// are now keyed by slot.
test.describe("[UC-24] [UC-29] Samples with the same file name (RE-45)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let sourceDir: string;

  /** A two-second tone at `dir/dup.wav`: long enough to still be playing */
  async function writeDup(dir: string, hz: number) {
    const folder = path.join(sourceDir, dir);
    await fs.mkdir(folder, { recursive: true });
    const file = path.join(folder, "dup.wav");
    await fs.writeFile(
      file,
      encodeTestWav([sine(hz, 2, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    return file;
  }

  /** The sample in a voice's slot (1-based, as the UI numbers them) */
  function slot(voice: number, uiSlot: number): Locator {
    return window.locator(
      `[data-testid="voice-panel-${voice}"] [aria-label="Sample dup.wav in slot ${uiSlot}"]`,
    );
  }

  /** Wait until the slot's waveform is drawn, so its audio has loaded */
  async function waitForAudio(voice: number, uiSlot: number) {
    const canvas = slot(voice, uiSlot).locator(
      `[data-testid="sample-waveform-${voice}-${uiSlot - 1}"]`,
    );
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
        { timeout: 10000 },
      )
      .toBeGreaterThan(0);
  }

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
    await window.waitForSelector('[data-testid="drop-zone-voice-3"]');
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    if (sourceDir) await fs.rm(sourceDir, { force: true, recursive: true });
  });

  test("[UC-29] two in one voice play one at a time", async () => {
    // The same name from two folders, dropped one at a time
    await dropFiles(window, 3, [await writeDup("a", 220)]);
    await expect
      .poll(() => samplesOnVoice(window, 3), { timeout: 10000 })
      .toHaveLength(1);
    await dropFiles(window, 3, [await writeDup("b", 330)]);
    await expect
      .poll(async () => (await samplesOnVoice(window, 3)).length, {
        timeout: 10000,
      })
      .toBe(2);
    await waitForAudio(3, 1);
    await waitForAudio(3, 2);

    // Playing slot 1 doesn't play slot 2
    await slot(3, 1).getByRole("button", { name: "Play" }).click();
    await expect(slot(3, 1)).toHaveAttribute("data-playing", "true");
    await expect(slot(3, 2)).toHaveAttribute("data-playing", "false");

    // Playing slot 2 chokes slot 1: the voice is monophonic
    await slot(3, 2).getByRole("button", { name: "Play" }).click();
    await expect(slot(3, 2)).toHaveAttribute("data-playing", "true");
    await expect(slot(3, 1)).toHaveAttribute("data-playing", "false");
  });

  test("[UC-24] [UC-29] two in different voices keep their own gain and playback", async () => {
    await dropFiles(window, 3, [await writeDup("a", 220)]);
    await dropFiles(window, 4, [await writeDup("b", 330)]);
    await expect
      .poll(
        async () =>
          (await samplesOnVoice(window, 3)).length +
          (await samplesOnVoice(window, 4)).length,
        { timeout: 10000 },
      )
      .toBe(2);
    await waitForAudio(3, 1);
    await waitForAudio(4, 1);

    // Playing voice 3's sample doesn't show voice 4's as playing
    await slot(3, 1).getByRole("button", { name: "Play" }).click();
    await expect(slot(3, 1)).toHaveAttribute("data-playing", "true");
    await expect(slot(4, 1)).toHaveAttribute("data-playing", "false");

    // Raising voice 3's gain leaves voice 4's at 0 dB, on screen and stored
    const knob3 = slot(3, 1).getByRole("slider");
    const knob4 = slot(4, 1).getByRole("slider");
    for (let i = 0; i < 3; i++) {
      await knob3.hover();
      await window.mouse.wheel(0, -100);
      await expect(knob3).toHaveAttribute("aria-valuenow", String(i + 1));
    }
    await expect(knob4).toHaveAttribute("aria-valuenow", "0");
    await expect
      .poll(
        async () => [
          (await samplesOnVoice(window, 3))[0]?.gain,
          (await samplesOnVoice(window, 4))[0]?.gain,
        ],
        { timeout: 10000 },
      )
      .toEqual([3, 0]);

    // And after the kit reloads its samples, each shows its own gain
    await window.keyboard.press(".");
    await expect(slot(3, 1)).toHaveCount(0);
    await window.keyboard.press(",");
    await expect(slot(3, 1).getByRole("slider")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    await expect(slot(4, 1).getByRole("slider")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });
});
