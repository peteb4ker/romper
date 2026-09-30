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

interface AudioProbe {
  analysers: number;
  starts: SourceStart[];
}

type ProbeWindow = { __probe: AudioProbe } & typeof globalThis;

/** One AudioBufferSourceNode.start() call, in ms. */
interface SourceStart {
  bufferMs: number;
  durationMs: null | number;
  offsetMs: number;
}

/**
 * Record every source start and analyser creation in the renderer, so a test
 * can tell which voices played a slice (start with an offset and duration)
 * and whether playback keeps allocating audio nodes. It checks the calls the
 * app makes, not the sound device, so it works on CI machines without one.
 */
async function installAudioProbe(window: Page) {
  await window.evaluate(() => {
    const w = globalThis as ProbeWindow;
    w.__probe = { analysers: 0, starts: [] };
    const origStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      when?: number,
      offset?: number,
      duration?: number,
    ) {
      w.__probe.starts.push({
        bufferMs: Math.round((this.buffer?.duration ?? 0) * 1000),
        durationMs: duration == null ? null : Math.round(duration * 1000),
        offsetMs: Math.round((offset ?? 0) * 1000),
      });
      return origStart.call(this, when, offset, duration);
    } as typeof origStart;
    const origAnalyser = BaseAudioContext.prototype.createAnalyser;
    BaseAudioContext.prototype.createAnalyser = function (
      this: BaseAudioContext,
    ) {
      w.__probe.analysers++;
      return origAnalyser.call(this);
    };
  });
}

async function playFor(window: Page, ms: number): Promise<AudioProbe> {
  await window.evaluate(() => {
    (globalThis as ProbeWindow).__probe.starts = [];
  });
  await window.getByRole("button", { name: "Play sequencer" }).click();
  await window.waitForTimeout(ms);
  await window.getByRole("button", { name: "Stop sequencer" }).click();
  return window.evaluate(() => ({ ...(globalThis as ProbeWindow).__probe }));
}

/** Starts that played part of the sample, counted by buffer length (ms). */
function sliceStartsByBuffer(starts: SourceStart[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const s of starts) {
    if (s.durationMs != null && s.durationMs < s.bufferMs) {
      counts.set(s.bufferMs, (counts.get(s.bufferMs) ?? 0) + 1);
    }
  }
  return counts;
}

test.describe("Slicer playback", () => {
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

    // Fixture kit A0: voice 1 = 150 ms kick, voice 2 = 100 ms snare
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await installAudioProbe(window);
    const handle = window.locator('[data-testid="kit-step-sequencer-handle"]');
    if (await handle.isVisible()) await handle.click();
    await window.waitForSelector('[data-testid="kit-step-sequencer-grid"]');
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("sliced voices keep playing slices after the slicer is closed", async () => {
    for (const voiceIdx of [0, 1]) {
      await window.locator(`[data-testid="slice-toggle-${voiceIdx}"]`).click();
      for (const step of [0, 4, 8, 12]) {
        // A click on a sliced row turns an off step on (and selects it)
        await window
          .locator(`[data-testid="seq-step-${voiceIdx}-${step}"]`)
          .click();
      }
    }
    await expect(window.locator('[data-testid="slice-strip"]')).toBeVisible();

    await window.locator('[data-testid="slice-close"]').click();
    await expect(window.locator('[data-testid="slice-strip"]')).toHaveCount(0);
    for (const voiceIdx of [0, 1]) {
      await expect(
        window.locator(`[data-testid="slice-toggle-${voiceIdx}"]`),
      ).toHaveAttribute("aria-pressed", "true");
    }

    const probe = await playFor(window, 2000);
    const slices = sliceStartsByBuffer(probe.starts);
    // Both the kick (150 ms) and the snare (100 ms) played slices
    expect(slices.get(150) ?? 0).toBeGreaterThan(0);
    expect(slices.get(100) ?? 0).toBeGreaterThan(0);
    // No voice fell back to playing its whole sample
    expect(probe.starts.every((s) => s.durationMs != null)).toBe(true);
  });

  test("sequencer playback doesn't keep creating VU meter nodes", async () => {
    await window.locator('[data-testid="slice-toggle-0"]').click();
    for (let step = 0; step < 16; step++) {
      await window.locator(`[data-testid="seq-step-0-${step}"]`).click();
    }

    const probe = await playFor(window, 3000);

    // About 24 triggers at 120 BPM. Meters are made once per slot, not per
    // trigger; they used to pile up in the audio graph (RE-14).
    expect(probe.starts.length).toBeGreaterThan(15);
    expect(probe.analysers).toBeLessThanOrEqual(2);
  });
});
