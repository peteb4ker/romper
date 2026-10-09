import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { dropFiles } from "../utils/e2e-drop";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import { encodeTestWav, sine } from "../validation/support/wav";

const KIT = "A0";

/**
 * Edit > Undo and Redo reach Romper's undo, not just text fields (RE-65),
 * and one Cmd/Ctrl+Z is one undo step whether the page or the menu's
 * accelerator handles it.
 */
test.describe("Edit menu undo", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let sources: string;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    sources = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-sources-"));

    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });

    await window.locator(`[data-testid="kit-item-${KIT}"]`).click();
    await window.waitForSelector('[data-testid="kit-editor"]', {
      timeout: 5000,
    });
    const unlock = window.locator('button[title="Enable editable mode"]');
    if (await unlock.isVisible()) await unlock.click();
    await window
      .locator('button[title="Disable editable mode"]')
      .waitFor({ timeout: 5000 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    if (testEnv) {
      await cleanupE2EFixture(testEnv);
    }
    await fs.rm(sources, { force: true, recursive: true });
  });

  test("[UC-26] Edit > Undo undoes a sample add, and Edit > Redo puts it back", async () => {
    const voice = await voiceWithRoom(2);
    const before = await sampleCount(voice);

    await addSample(voice, "menu undo.wav");
    await expectSamples(voice, before + 1);

    await clickEditMenu("undo");
    await expectSamples(voice, before);

    await clickEditMenu("redo");
    await expectSamples(voice, before + 1);
  });

  test("[UC-26] one Cmd/Ctrl+Z undoes exactly one step", async () => {
    const voice = await voiceWithRoom(2);
    const before = await sampleCount(voice);
    await addSample(voice, "first.wav");
    await expectSamples(voice, before + 1);
    await addSample(voice, "second.wav");
    await expectSamples(voice, before + 2);

    await pressUndoKey();

    await expectSamples(voice, before + 1);
    // Give a second handler (the menu's accelerator) time to undo again
    await window.waitForTimeout(1000);
    expect(await sampleCount(voice)).toBe(before + 1);
  });

  test("[UC-26] Cmd/Ctrl+Z in a text field undoes the field once, not Romper's undo", async () => {
    const voice = await voiceWithRoom(1);
    const before = await sampleCount(voice);
    await addSample(voice, "kept.wav");
    await expectSamples(voice, before + 1);

    await window.evaluate(() => {
      const input = document.createElement("input");
      input.id = "e2e-text";
      document.body.append(input);
    });
    const field = window.locator("#e2e-text");
    await field.focus();
    await window.keyboard.type("abc");
    // Moving the caret ends the first typing step
    await window.keyboard.press("ArrowLeft");
    await window.keyboard.press("ArrowRight");
    await window.keyboard.type("def");

    await pressUndoKey();
    if (process.platform === "darwin") {
      // On macOS a text field's Cmd+Z works only through the Edit menu: the
      // page leaves the key unhandled and Chromium hands the native key
      // event to the menu bar. A synthesized key has no native event, so
      // that hand-off is done here. Linux and Windows run the real path.
      await clickEditMenu("undo");
    }

    await expect(field).toHaveValue("abc");
    await window.waitForTimeout(1000);
    await expect(field).toHaveValue("abc");
    expect(await sampleCount(voice)).toBe(before + 1);
  });

  test("[UC-26] [Q-02] undoing a delete brings the sample back with its gain (RE-86)", async () => {
    const voice = await voiceWithRoom(2);
    const start = await sampleCount(voice);
    await addSample(voice, "keep one.wav");
    await addSample(voice, "keep two.wav");
    await expectSamples(voice, start + 2);
    // A gain on the sample that will be deleted
    await window.evaluate(
      ([kit, v]) => globalThis.electronAPI.updateSampleGain(kit, v, 0, -7.5),
      [KIT, voice] as const,
    );
    const before = await voiceRows(voice);
    expect(before[0].gain_db).toBe(-7.5);

    const first = window
      .locator(
        `[data-testid="sample-list-voice-${voice}"] [role="row"][aria-label^="Sample "]`,
      )
      .first();
    await first.getByRole("button", { name: "Delete sample" }).click();
    await window
      .locator('[data-testid="confirm-delete-sample-button"]')
      .click();
    await expectSamples(voice, before.length - 1);

    await clickEditMenu("undo");

    // Same files in the same slots, and the gain is back
    await expect.poll(() => voiceRows(voice)).toEqual(before);
  });

  /** A voice's rows as undo should restore them, by slot */
  async function voiceRows(voice: number) {
    return window.evaluate(
      async ([kit, v]) => {
        const res = await globalThis.electronAPI.getAllSamplesForKit(kit);
        return (res.data ?? [])
          .filter((s) => s.voice_number === v)
          .sort((a, b) => a.slot_number - b.slot_number)
          .map((s) => ({
            filename: s.filename,
            gain_db: s.gain_db,
            slot_number: s.slot_number,
            source_path: s.source_path,
          }));
      },
      [KIT, voice] as const,
    );
  }

  async function addSample(voice: number, name: string) {
    const file = path.join(sources, name);
    await fs.writeFile(
      file,
      encodeTestWav([sine(220, 0.2, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    await dropFiles(window, voice, [file]);
  }

  /** Clicks an Edit menu item the way the menu bar does */
  async function clickEditMenu(id: "redo" | "undo") {
    await electronApp.evaluate(({ BrowserWindow, Menu }, itemId) => {
      const target = BrowserWindow.getAllWindows()[0];
      const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
      if (!item) throw new Error(`no Edit menu item "${itemId}"`);
      item.click(undefined, target, target.webContents);
    }, id);
  }

  /**
   * A native Cmd+Z (Ctrl+Z off macOS): it reaches the page first and, if
   * the page leaves it unhandled, the Edit menu's accelerator
   */
  async function pressUndoKey() {
    await electronApp.evaluate(({ BrowserWindow }, isMac) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      const modifiers = [isMac ? "meta" : "control"] as ("control" | "meta")[];
      contents.sendInputEvent({ keyCode: "Z", modifiers, type: "keyDown" });
      contents.sendInputEvent({ keyCode: "Z", modifiers, type: "keyUp" });
    }, process.platform === "darwin");
  }

  /**
   * Waits until the voice holds `count` samples and the editor lists them,
   * so an undo or redo sent next finds the change on its stack (#539). The
   * database changes before the editor records the step: a Redo sent as
   * soon as an undo reaches the database finds nothing to redo and does
   * nothing. The list reloads only after the step is recorded.
   */
  async function expectSamples(voice: number, count: number) {
    await expect.poll(() => sampleCount(voice)).toBe(count);
    await expect(
      window.locator(
        `[data-testid="sample-list-voice-${voice}"] [role="row"][aria-label^="Sample "]`,
      ),
    ).toHaveCount(count);
  }

  async function sampleCount(voice: number): Promise<number> {
    return window.evaluate(
      async ([kit, v]) => {
        const res = await globalThis.electronAPI.getAllSamplesForKit(kit);
        return (res.data ?? []).filter((s) => s.voice_number === v).length;
      },
      [KIT, voice] as const,
    );
  }

  /** A voice with room for `count` more samples */
  async function voiceWithRoom(count: number): Promise<number> {
    for (let voice = 1; voice <= 4; voice++) {
      if ((await sampleCount(voice)) + count <= 12) return voice;
    }
    throw new Error(`no voice in ${KIT} has room for ${count} samples`);
  }
});
