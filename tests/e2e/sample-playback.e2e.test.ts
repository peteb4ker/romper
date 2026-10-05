import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Locator,
  type Page,
} from "playwright";

import { dropFiles } from "../utils/e2e-drop";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import { encodeTestWav, sine } from "../validation/support/wav";

interface AudioProbe {
  /** The context the sources play through */
  context: BaseAudioContext | null;
  sounds: Sound[];
}

type ProbeWindow = { __audioProbe: AudioProbe } & typeof globalThis;

/** What the audio probe saw of one buffer source the app started */
interface Sound {
  /** Seconds of audio in the source's buffer */
  duration: number;
  /** The source finished: played out, or stopped */
  ended: boolean;
  /** The app called stop() on it */
  stopped: boolean;
}

/**
 * Watch every AudioBufferSourceNode the renderer starts, without changing
 * the app: wrap start() and stop() on the prototype and listen for `ended`
 * (the app sets `onended`, which a listener doesn't replace).
 */
async function installAudioProbe(window: Page) {
  await window.evaluate(() => {
    const probe: AudioProbe = { context: null, sounds: [] };
    (globalThis as ProbeWindow).__audioProbe = probe;
    const proto = AudioBufferSourceNode.prototype;
    const sounds = new WeakMap<AudioBufferSourceNode, Sound>();
    const { start, stop } = proto;
    proto.start = function (this: AudioBufferSourceNode, ...args) {
      const sound: Sound = {
        duration: this.buffer?.duration ?? 0,
        ended: false,
        stopped: false,
      };
      probe.sounds.push(sound);
      probe.context = this.context;
      sounds.set(this, sound);
      this.addEventListener("ended", () => {
        sound.ended = true;
      });
      return start.apply(this, args);
    } as typeof proto.start;
    proto.stop = function (this: AudioBufferSourceNode, ...args) {
      const sound = sounds.get(this);
      if (sound) sound.stopped = true;
      return stop.apply(this, args);
    } as typeof proto.stop;
  });
}

/** The probe's view: sounds started, still sounding, and the audio clock */
async function readProbe(window: Page) {
  return window.evaluate(() => {
    const { context, sounds } = (globalThis as ProbeWindow).__audioProbe;
    return {
      contextState: context?.state ?? null,
      currentTime: context?.currentTime ?? 0,
      sounding: sounds.filter((s) => !s.ended).length,
      sounds: sounds.map((s) => ({ ...s })),
    };
  });
}

/**
 * UC-29 end to end: pressing Play (or Space on the selected sample) starts
 * the sample's audio through the shared AudioContext, the sample shows as
 * playing until it ends or is stopped, and starting a second sample on the
 * same voice stops the first (voice choke).
 */
test.describe("[UC-29] Play a sample", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let sourceDir: string;

  /** A tone `seconds` long, written to the source folder for the test to drop */
  async function writeTone(name: string, hz: number, seconds: number) {
    const file = path.join(sourceDir, name);
    await fs.writeFile(
      file,
      encodeTestWav([sine(hz, seconds, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    return file;
  }

  /** The sample row in a voice's slot (1-based, as the UI numbers them) */
  function slot(voice: number, name: string, uiSlot: number): Locator {
    return window.locator(
      `[data-testid="voice-panel-${voice}"] [aria-label="Sample ${name} in slot ${uiSlot}"]`,
    );
  }

  /** Wait until a slot's waveform is drawn, so its audio has decoded */
  async function waitForAudio(row: Locator, voice: number, uiSlot: number) {
    const canvas = row.locator(
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
    sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-play-"));
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: { ...process.env, ...testEnv.environment },
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
    await installAudioProbe(window);

    // Fixture kit A0: a kick on voice 1, a snare on voice 2, 3 and 4 empty
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    if (sourceDir) await fs.rm(sourceDir, { force: true, recursive: true });
  });

  test("Play starts the sample's audio, and it stops when the sample ends", async () => {
    const kick = slot(1, "1_kick.wav", 1);
    await waitForAudio(kick, 1, 1);
    expect((await readProbe(window)).sounds).toHaveLength(0);

    await kick.getByRole("button", { name: "Play" }).click();

    // One source started, with the kick's whole buffer, on a running clock
    await expect
      .poll(async () => (await readProbe(window)).sounds.length)
      .toBe(1);
    const started = await readProbe(window);
    expect(started.sounds[0].duration).toBeGreaterThan(0);
    await expect
      .poll(async () => (await readProbe(window)).contextState)
      .toBe("running");
    await expect
      .poll(async () => (await readProbe(window)).currentTime)
      .toBeGreaterThan(started.currentTime);

    // It plays out on its own: the source ends and the row stops showing it
    await expect
      .poll(async () => (await readProbe(window)).sounding, { timeout: 5000 })
      .toBe(0);
    await expect(kick).toHaveAttribute("data-playing", "false");
    await expect(kick.getByRole("button", { name: "Play" })).toBeVisible();
    expect((await readProbe(window)).sounds[0].stopped).toBe(false);
  });

  test("Stop ends a playing sample", async () => {
    await window.getByTitle("Enable editable mode").click();
    await window.waitForSelector('[data-testid="drop-zone-voice-3"]');
    await dropFiles(window, 3, [await writeTone("long.wav", 220, 4)]);
    const long = slot(3, "long.wav", 1);
    await waitForAudio(long, 3, 1);

    await long.getByRole("button", { name: "Play" }).click();
    await expect(long).toHaveAttribute("data-playing", "true");
    await expect.poll(async () => (await readProbe(window)).sounding).toBe(1);
    const { sounds } = await readProbe(window);
    expect(sounds[0].duration).toBeCloseTo(4, 1);

    // Well before the four seconds are up, Stop silences it
    await long.getByRole("button", { name: "Stop" }).click();
    await expect(long).toHaveAttribute("data-playing", "false");
    await expect.poll(async () => (await readProbe(window)).sounding).toBe(0);
    expect((await readProbe(window)).sounds[0].stopped).toBe(true);
  });

  test("Space plays the selected sample", async () => {
    const snare = slot(2, "2_snare.wav", 1);
    await waitForAudio(snare, 2, 1);

    await snare.click();
    await expect(snare).toHaveAttribute("aria-selected", "true");
    expect((await readProbe(window)).sounds).toHaveLength(0);
    await window.keyboard.press("Space");

    await expect
      .poll(async () => (await readProbe(window)).sounds.length)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await readProbe(window)).sounding, { timeout: 5000 })
      .toBe(0);
    await expect(snare).toHaveAttribute("data-playing", "false");
    // The last start played out rather than being cut off
    expect((await readProbe(window)).sounds.at(-1)?.stopped).toBe(false);
  });

  test("Space starts the selected sample once (#505)", async () => {
    // A focused row's list and the kit editor's window listener both see
    // Space; only the list plays it, so one press starts one sound
    const snare = slot(2, "2_snare.wav", 1);
    await waitForAudio(snare, 2, 1);

    await snare.click();
    await window.keyboard.press("Space");
    await expect
      .poll(async () => (await readProbe(window)).sounds.length)
      .toBeGreaterThan(0);
    // Give a second start time to show up
    await window.waitForTimeout(500);
    expect((await readProbe(window)).sounds).toHaveLength(1);
  });

  test("Space on the kit name only opens the name editor (#587)", async () => {
    const snare = slot(2, "2_snare.wav", 1);
    await waitForAudio(snare, 2, 1);
    await snare.click();
    await expect(snare).toHaveAttribute("aria-selected", "true");

    await window.getByTitle("Edit kit name").focus();
    await window.keyboard.press("Space");

    const field = window.getByRole("textbox", { name: "Kit name" });
    await expect(field).toBeFocused();
    await expect(field).not.toHaveValue(/ $/);
    // Give a stray start time to show up
    await window.waitForTimeout(500);
    expect((await readProbe(window)).sounds).toHaveLength(0);
  });

  test("starting a second sample on a voice stops the first (voice choke)", async () => {
    await window.getByTitle("Enable editable mode").click();
    await window.waitForSelector('[data-testid="drop-zone-voice-3"]');
    await dropFiles(window, 3, [await writeTone("low.wav", 220, 4)]);
    await expect(slot(3, "low.wav", 1)).toBeVisible();
    await dropFiles(window, 3, [await writeTone("high.wav", 440, 4)]);
    const low = slot(3, "low.wav", 1);
    const high = slot(3, "high.wav", 2);
    await waitForAudio(low, 3, 1);
    await waitForAudio(high, 3, 2);

    await low.getByRole("button", { name: "Play" }).click();
    await expect(low).toHaveAttribute("data-playing", "true");
    await expect.poll(async () => (await readProbe(window)).sounding).toBe(1);

    await high.getByRole("button", { name: "Play" }).click();
    await expect(high).toHaveAttribute("data-playing", "true");
    await expect(low).toHaveAttribute("data-playing", "false");

    // At the audio layer too: the first source was stopped, not left to
    // ring under the second, and only the second is still sounding
    await expect.poll(async () => (await readProbe(window)).sounding).toBe(1);
    const { sounds } = await readProbe(window);
    expect(sounds).toHaveLength(2);
    expect(sounds[0]).toMatchObject({ ended: true, stopped: true });
    expect(sounds[1]).toMatchObject({ ended: false, stopped: false });

    // A sample on another voice plays alongside: the choke is per voice
    await slot(1, "1_kick.wav", 1)
      .getByRole("button", { name: "Play" })
      .click();
    await expect
      .poll(async () => (await readProbe(window)).sounds.length)
      .toBe(3);
    expect((await readProbe(window)).sounds[1].stopped).toBe(false);
  });
});
