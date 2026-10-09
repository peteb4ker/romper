import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

const KIT = "A0";

/**
 * #522: moving a sample needed a drag, and showing its file in Finder or
 * Explorer a right-click. On the selected sample, Alt+arrows (Option+arrows
 * on macOS) now move it through the drag's move, and Shift+F10 or the
 * context-menu key does what right-clicking it does. The fixture's kit A0
 * has 1_kick.wav on voice 1 and 2_snare.wav on voice 2.
 */
test.describe("[Q-06] [UC-21] [UC-25] [UC-26] Sample move keys", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const row = (voice: number, name: string) =>
    window
      .locator(`[data-testid="sample-list-voice-${voice}"]`)
      .getByRole("row", { exact: false, name: `Sample ${name} in slot` });
  const selectedRow = (voice: number) =>
    window.locator(`[data-testid="sample-selected-voice-${voice}"]`);

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 15000,
    });
    await window.locator(`[data-testid="kit-item-${KIT}"]`).click();
    await window.waitForSelector('[data-testid="kit-editor"]');
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  /** The kit's samples per voice, in slot order, as the database has them */
  async function voices(): Promise<Record<number, string[]>> {
    return window.evaluate(async (kit) => {
      const res = await globalThis.electronAPI.getAllSamplesForKit(kit);
      const byVoice: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
      for (const s of [...(res.data ?? [])].sort(
        (a, b) => a.slot_number - b.slot_number,
      )) {
        byVoice[s.voice_number].push(s.filename);
      }
      return byVoice;
    }, KIT);
  }

  async function isModified(): Promise<boolean | undefined> {
    return window.evaluate(async (kit) => {
      const res = await globalThis.electronAPI.getKit(kit);
      return res.data?.modified_since_sync;
    }, KIT);
  }

  async function enableEditing() {
    await window.getByTitle("Enable editable mode").click();
    await window
      .locator('button[title="Disable editable mode"]')
      .waitFor({ timeout: 5000 });
  }

  async function pressUndoKey() {
    await window.keyboard.press(
      process.platform === "darwin" ? "Meta+z" : "Control+z",
    );
  }

  test("moves the selected sample to the next voice and down a slot, and undo puts it back", async () => {
    await enableEditing();
    expect(await isModified()).toBe(false);
    await row(1, "1_kick.wav").click();
    await expect(selectedRow(1)).toBeFocused();

    // To voice 2, in the same slot: the snare shifts down
    await window.keyboard.press("Alt+ArrowRight");
    await expect
      .poll(voices)
      .toMatchObject({ 1: [], 2: ["1_kick.wav", "2_snare.wav"] });
    await expect(selectedRow(2)).toHaveAccessibleName(/1_kick\.wav in slot 1/);
    await expect(selectedRow(2)).toBeFocused();
    expect(await isModified()).toBe(true);

    // Down a slot, past the snare
    await window.keyboard.press("Alt+ArrowDown");
    await expect
      .poll(voices)
      .toMatchObject({ 1: [], 2: ["2_snare.wav", "1_kick.wav"] });
    await expect(selectedRow(2)).toHaveAccessibleName(/1_kick\.wav in slot 2/);
    await expect(selectedRow(2)).toBeFocused();

    // Down again from the last sample: it stays
    await window.keyboard.press("Alt+ArrowDown");
    await window.waitForTimeout(500);
    expect(await voices()).toMatchObject({
      2: ["2_snare.wav", "1_kick.wav"],
    });

    // Undo takes back the last move, as for a drag
    await pressUndoKey();
    await expect
      .poll(voices)
      .toMatchObject({ 1: [], 2: ["1_kick.wav", "2_snare.wav"] });
  });

  test("does nothing in a read-only kit", async () => {
    await row(1, "1_kick.wav").click();
    await window.keyboard.press("Alt+ArrowRight");
    await window.waitForTimeout(500);
    expect(await voices()).toMatchObject({
      1: ["1_kick.wav"],
      2: ["2_snare.wav"],
    });
    expect(await isModified()).toBe(false);
  });

  test("Shift+F10 shows the selected sample's file, as a right-click does", async () => {
    // Record the reveal instead of opening Finder or Explorer
    await electronApp.evaluate(({ ipcMain }) => {
      const revealed: string[] = [];
      (globalThis as { __revealed?: string[] }).__revealed = revealed;
      ipcMain.removeHandler("show-item-in-folder");
      ipcMain.handle("show-item-in-folder", (_event, path: string) => {
        revealed.push(path);
      });
    });
    const revealed = () =>
      electronApp.evaluate(
        () => (globalThis as { __revealed?: string[] }).__revealed ?? [],
      );

    await row(2, "2_snare.wav").click();
    await window.keyboard.press("Shift+F10");
    await expect.poll(revealed).toHaveLength(1);
    expect((await revealed())[0]).toMatch(/2_snare\.wav$/);

    await row(1, "1_kick.wav").click({ button: "right" });
    await expect.poll(revealed).toHaveLength(2);
    expect((await revealed())[1]).toMatch(/1_kick\.wav$/);
  });
});
