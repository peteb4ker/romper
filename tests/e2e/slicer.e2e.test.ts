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

/**
 * Plays the sequencer until what the probe recorded satisfies `done`, then
 * stops it. It waits on what played rather than a fixed time, so a slow
 * machine plays for longer instead of failing on a count (#579).
 */
async function playUntil(
  window: Page,
  done: (probe: AudioProbe) => boolean,
  message: string,
): Promise<AudioProbe> {
  await window.evaluate(() => {
    (globalThis as ProbeWindow).__probe.starts = [];
  });
  await window.getByRole("button", { name: "Play sequencer" }).click();
  await expect
    .poll(async () => done(await readProbe(window)), {
      message,
      timeout: 10000,
    })
    .toBe(true);
  await window.getByRole("button", { name: "Stop sequencer" }).click();
  return readProbe(window);
}

function readProbe(window: Page): Promise<AudioProbe> {
  return window.evaluate(() => {
    const probe = (globalThis as ProbeWindow).__probe;
    return { analysers: probe.analysers, starts: [...probe.starts] };
  });
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

test.describe("[UC-33] Slicer playback", () => {
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

    // Both the kick (150 ms) and the snare (100 ms) play slices
    const probe = await playUntil(
      window,
      ({ starts }) => {
        const slices = sliceStartsByBuffer(starts);
        return (slices.get(150) ?? 0) > 0 && (slices.get(100) ?? 0) > 0;
      },
      "both sliced voices play a slice",
    );
    // No voice fell back to playing its whole sample
    expect(probe.starts.every((s) => s.durationMs != null)).toBe(true);
  });

  test("[UC-30] sequencer playback doesn't keep creating VU meter nodes", async () => {
    await window.locator('[data-testid="slice-toggle-0"]').click();
    for (let step = 0; step < 16; step++) {
      await window.locator(`[data-testid="seq-step-0-${step}"]`).click();
    }

    // A bar and a half of triggers at 120 BPM. Meters are made once per
    // slot, not per trigger; they used to pile up in the audio graph (RE-14).
    const probe = await playUntil(
      window,
      ({ starts }) => starts.length >= 24,
      "the sequencer triggers 24 times",
    );
    expect(probe.analysers).toBeLessThanOrEqual(2);
  });
});
