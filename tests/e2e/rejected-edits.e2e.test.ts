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

// RE-40: a refused drop or link used to reach only the console. Each now
// says what happened and what to do, in one toast per drop or click.
test.describe("[UC-36] Refused edits reach the user (RE-40)", () => {
  test.use({
    expectedMessages: {
      "a refused drop or link is a warning toast, mirrored to the console": {
        pattern:
          /wasn't added|weren't added|weren't linked|Duplicate sample: .* already exists in voice/,
      },
    },
  });

  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let sourceDir: string;

  async function writeWav(name: string) {
    const file = path.join(sourceDir, name);
    await fs.writeFile(
      file,
      encodeTestWav([sine(220, 0.05, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    return file;
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
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    if (sourceDir) await fs.rm(sourceDir, { force: true, recursive: true });
  });

  test("[UC-19] a drop with a duplicate and a non-WAV names both in one message", async () => {
    const pad = await writeWav("pad.wav");
    await dropFiles(window, 3, [pad]);
    await expect
      .poll(() => samplesOnVoice(window, 3), { timeout: 10000 })
      .toEqual(["pad.wav"]);

    const notes = path.join(sourceDir, "notes.txt");
    await fs.writeFile(notes, "not audio");
    await dropFiles(window, 3, [pad, notes]);

    const warnings = window.locator('[data-testid="message-warning"]');
    await expect(warnings).toHaveCount(1, { timeout: 10000 });
    await expect(warnings).toHaveText(
      "pad.wav wasn't added: it's already in voice 3. " +
        "notes.txt wasn't added: only WAV files can be added.",
    );
    expect(await samplesOnVoice(window, 3)).toEqual(["pad.wav"]);
  });

  test("[UC-19] files dropped past the 12th say the voice is full", async () => {
    const files = [];
    for (let i = 1; i <= 13; i++) {
      files.push(await writeWav(`hit ${String(i).padStart(2, "0")}.wav`));
    }
    await dropFiles(window, 3, files);

    await expect(window.locator('[data-testid="message-warning"]')).toHaveText(
      "hit 13.wav wasn't added: voice 3 is full (12 samples). Delete one to make room.",
      { timeout: 30000 },
    );
    await expect
      .poll(async () => (await samplesOnVoice(window, 3)).length, {
        timeout: 30000,
      })
      .toBe(12);

    // A drop on the full voice, which has no drop zone left, says so too
    const extra = await writeWav("extra.wav");
    await dropFiles(
      window,
      3,
      [extra],
      '[data-testid="voice-panel-3"] [aria-label="Sample hit 01.wav in slot 1"]',
    );
    await expect(
      window.getByText(
        "extra.wav wasn't added: voice 3 is full (12 samples). Delete one to make room.",
      ),
    ).toBeVisible();
    expect(await samplesOnVoice(window, 3)).toHaveLength(12);
  });

  test("[UC-28] linking onto a voice with samples says why it didn't link", async () => {
    await window.locator('[data-testid="link-button-1-2"]').click();

    await expect(window.locator('[data-testid="message-warning"]')).toHaveText(
      "Voices 1 and 2 weren't linked: voice 2 has samples. Delete or move them, then link again.",
    );
    await expect(window.locator('[data-testid="stereo-badge-1"]')).toHaveCount(
      0,
    );
  });
});
