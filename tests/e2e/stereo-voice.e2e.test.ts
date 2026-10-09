import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import type { ElectronAPI } from "../../shared/electronApi";

import { appEnv } from "../utils/e2e-app-env";
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
      env: appEnv(testEnv.environment),
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

  test("[UC-28] main refuses to link voice 4 or a voice whose next voice has samples (#541)", async () => {
    // Asked through IPC, as a renderer bug or stale view could: voice 4
    // can't be linked, and voice 1's next voice holds the fixture's snare
    const results = await window.evaluate(async () => {
      const api = (globalThis as unknown as ApiWindow).electronAPI;
      return {
        busy: await api.updateVoiceStereoMode("A0", 1, true),
        voice4: await api.updateVoiceStereoMode("A0", 4, true),
      };
    });
    expect(results.voice4).toEqual({
      error: "Voice 4 can't be linked.",
      success: false,
    });
    expect(results.busy).toEqual({
      error: "Voices 1 and 2 can't be linked: voice 2 has samples.",
      success: false,
    });
    const stereoVoices = await window.evaluate(async () => {
      const res = await (globalThis as unknown as ApiWindow).electronAPI.getKit(
        "A0",
      );
      return (res.data?.voices ?? [])
        .filter((v) => v.stereo_mode)
        .map((v) => v.voice_number);
    });
    expect(stereoVoices).toEqual([]);
    // And the editor shows no pair
    await expect(window.locator('[data-testid^="stereo-badge-"]')).toHaveCount(
      0,
    );
  });

  // #537 final stereo rules: a drop of a stereo sample asks first (S5)
  async function writeStereo(name: string) {
    const file = path.join(sourceDir, name);
    await fs.writeFile(
      file,
      encodeTestWav([sine(220, 0.3, 44100), sine(330, 0.3, 44100, 0.3)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    return file;
  }
  async function writeMono(name: string) {
    const file = path.join(sourceDir, name);
    await fs.writeFile(
      file,
      encodeTestWav([sine(220, 0.3, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    return file;
  }
  const message = () => window.locator('[data-testid="message-display"]');
  /** Drop once the voice's drop zone is there (the editable switch shows it) */
  async function dropOn(voice: number, files: string[]) {
    await expect(
      window.locator(`[data-testid="drop-zone-voice-${voice}"]`),
    ).toBeVisible();
    await dropFiles(window, voice, files);
  }

  test("[UC-19] a stereo sample rule 2 would link asks, and Link links it; a mono sample then quarantines the kit (#537, #574)", async () => {
    await expect(
      window.locator('[data-testid="kit-quarantine-notice"]'),
    ).toHaveCount(0);
    await dropOn(3, [await writeStereo("pad.wav")]);

    const prompt = window.getByRole("dialog");
    await expect(prompt).toHaveText(
      /pad\.wav is stereo\. Link voices 3 and 4 as a stereo pair\?/,
    );
    await prompt.getByRole("button", { name: "Link" }).click();

    await expect(
      window.locator('[data-testid="stereo-badge-3"]'),
    ).toBeVisible();
    // Linked by hand, so not labelled as automatic
    await expect(
      window.locator('[data-testid="auto-linked-label-3"]'),
    ).toHaveCount(0);
    await expect
      .poll(() => samplesOnVoice(window, 3), { timeout: 10000 })
      .toEqual(["pad.wav"]);

    // A mono sample on the pair is added, with a warning, and the kit is
    // quarantined until it's fixed
    await dropOn(3, [await writeMono("click.wav")]);
    await expect(message()).toContainText(
      "click.wav is a mono sample, but voices 3 and 4 are a stereo pair and expect stereo samples.",
    );
    await expect(
      window.locator('[data-testid="mono-in-pair-label-3-1"]'),
    ).toHaveText("Mono sample in a stereo pair");
    const notice = window.locator('[data-testid="kit-quarantine-notice"]');
    await expect(notice).toContainText("Quarantined");
    await expect(notice).toContainText(
      "click.wav is a mono sample in the stereo pair on voices 3 and 4. Unlink them, or replace click.wav with a stereo sample.",
    );

    // Unlinking fixes it, says what changes, and notes the mixdown
    await window.locator('[data-testid="stereo-badge-3"]').click();
    await expect(message()).toContainText(
      "Voices 3 and 4 are unlinked. Voice 3's stereo samples will be written to the card as mono.",
    );
    await expect(notice).toHaveCount(0);
    await expect(window.locator('[data-testid="stereo-note-3"]')).toHaveText(
      "Mixed down to mono instead of playing across 2 voices",
    );
  });

  test("[UC-19] Keep mono adds the stereo sample unlinked, and is remembered", async () => {
    await dropOn(3, [await writeStereo("pad.wav")]);

    const prompt = window.getByRole("dialog");
    await prompt.getByRole("button", { name: "Keep mono" }).click();

    await expect(prompt).toHaveCount(0);
    await expect
      .poll(() => samplesOnVoice(window, 3), { timeout: 10000 })
      .toEqual(["pad.wav"]);
    await expect(window.locator('[data-testid="stereo-badge-3"]')).toHaveCount(
      0,
    );
    await expect(window.locator('[data-testid="stereo-note-3"]')).toHaveText(
      "Mixed down to mono instead of playing across 2 voices",
    );

    // Remembered: another stereo sample doesn't ask again
    await expect(
      window
        .locator('[data-testid="sample-list-voice-3"]')
        .getByRole("row", { name: "Sample pad.wav in slot 1" }),
    ).toBeVisible();
    await dropOn(3, [await writeStereo("pad 2.wav")]);
    await expect(
      window
        .locator('[data-testid="sample-list-voice-3"]')
        .getByRole("row", { name: "Sample pad 2.wav in slot 2" }),
    ).toBeVisible();
    await expect(window.getByRole("dialog")).toHaveCount(0);
  });

  test("[UC-19] a stereo sample on a mono voice that also holds a mono sample is mixed down, without asking", async () => {
    // Voice 1 holds the fixture's mono kick (rule 1)
    await dropOn(1, [await writeStereo("pad.wav")]);

    await expect
      .poll(() => samplesOnVoice(window, 1), { timeout: 10000 })
      .toContain("pad.wav");
    await expect(window.getByRole("dialog")).toHaveCount(0);
    await expect(window.locator('[data-testid="stereo-note-1"]')).toHaveText(
      "Mixed down to mono instead of playing across 2 voices",
    );
  });

  test("[UC-28] a voice next to a pair notes why it can't pair, and the pair stays (#537 rule 3)", async () => {
    // An empty pair on voices 3 and 4, then a stereo sample on voice 2
    await window.locator('[data-testid="link-button-3-4"]').click();
    await expect(
      window.locator('[data-testid="stereo-badge-3"]'),
    ).toBeVisible();
    await dropOn(2, [await writeStereo("pad.wav")]);

    await expect(window.locator('[data-testid="stereo-note-2"]')).toHaveText(
      "Voice 2 can't pair with voice 3 because voices 3 and 4 are linked. Unlink them to pair voices 2 and 3.",
    );
    await expect(
      window.locator('[data-testid="stereo-badge-3"]'),
    ).toBeVisible();
    await expect(window.getByRole("dialog")).toHaveCount(0);
  });
});
