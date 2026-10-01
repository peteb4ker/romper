import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
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
    await expect.poll(() => sampleCount(voice)).toBe(before + 1);

    await clickEditMenu("undo");
    await expect.poll(() => sampleCount(voice)).toBe(before);

    await clickEditMenu("redo");
    await expect.poll(() => sampleCount(voice)).toBe(before + 1);
  });

  test("[UC-26] one Cmd/Ctrl+Z undoes exactly one step", async () => {
    const voice = await voiceWithRoom(2);
    const before = await sampleCount(voice);
    await addSample(voice, "first.wav");
    await expect.poll(() => sampleCount(voice)).toBe(before + 1);
    await addSample(voice, "second.wav");
    await expect.poll(() => sampleCount(voice)).toBe(before + 2);

    await pressUndoKey();

    await expect.poll(() => sampleCount(voice)).toBe(before + 1);
    // Give a second handler (the menu's accelerator) time to undo again
    await window.waitForTimeout(1000);
    expect(await sampleCount(voice)).toBe(before + 1);
  });

  test("[UC-26] Cmd/Ctrl+Z in a text field undoes the field once, not Romper's undo", async () => {
    const voice = await voiceWithRoom(1);
    const before = await sampleCount(voice);
    await addSample(voice, "kept.wav");
    await expect.poll(() => sampleCount(voice)).toBe(before + 1);

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

  async function sampleCount(voice: number): Promise<number> {
    return window.evaluate(
      async ([kit, v]) => {
        const res = await window.electronAPI.getAllSamplesForKit(kit);
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
