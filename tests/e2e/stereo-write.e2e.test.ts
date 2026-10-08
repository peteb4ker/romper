import fs from "fs-extra";
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

/** Every file in a card folder, by name, with its bytes */
async function snapshot(folder: string): Promise<Record<string, string>> {
  const names = (await fs.readdir(folder)).sort((a, b) => a.localeCompare(b));
  const entries = await Promise.all(
    names.map(
      async (name) =>
        [
          name,
          (await fs.readFile(path.join(folder, name))).toString("base64"),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

// #537, Pete's final stereo rules v2, rules 4 and 5: a kit with a mono
// sample on a stereo pair is quarantined. A scan says so without changing
// anything, and a write leaves the kit's folder on the card exactly as it
// was while writing the other kits. Romper's design, unverified on hardware.
test.describe("[UC-13] [UC-34] [Q-04] Quarantined kits and the write (#537)", () => {
  test.use({
    expectedMessages: {
      "a mono sample dropped on a stereo pair warns": {
        pattern:
          /is a mono sample, but voices 3 and 4 are a stereo pair and expect stereo samples/,
      },
    },
  });

  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let card: string;
  let sourceDir: string;

  async function write() {
    await window.locator('[data-testid="sync-to-sd-card"]').click();
    await window.waitForSelector('[data-testid="sync-dialog"]');
    await window
      .locator('[data-testid="bank-summary"]')
      .waitFor({ state: "visible", timeout: 10000 });
    return window.locator('[data-testid="sync-dialog"]');
  }

  async function confirmAndClose() {
    await window.locator('[data-testid="confirm-sync"]').click();
    await window
      .locator("text=Write Complete")
      .waitFor({ state: "visible", timeout: 15000 });
    await window.locator('[data-testid="cancel-sync"]').click();
    await window.waitForSelector('[data-testid="sync-dialog"]', {
      state: "detached",
    });
  }

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    card = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-card-"));
    sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-src-"));
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv({
        ...testEnv.environment,
        ROMPER_SDCARD_PATH: card,
      }),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    await fs.remove(card).catch(() => {});
    await fs.remove(sourceDir).catch(() => {});
  });

  test("a quarantined kit isn't written, its card copy stays byte for byte, and the scan and the summary say why", async () => {
    test.setTimeout(60000);
    // The card holds both fixture kits
    await write();
    await confirmAndClose();
    const before = await snapshot(path.join(card, "A0"));

    // In A0, link voices 3 and 4, then drop a stereo and a mono sample on
    // the pair: the mono one quarantines the kit
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
    await window.locator('[data-testid="link-button-3-4"]').click();
    await expect(
      window.locator('[data-testid="stereo-badge-3"]'),
    ).toBeVisible();
    const pad = path.join(sourceDir, "pad.wav");
    await fs.writeFile(
      pad,
      encodeTestWav([sine(220, 0.3, 44100), sine(330, 0.3, 44100, 0.3)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    const click = path.join(sourceDir, "click.wav");
    await fs.writeFile(
      click,
      encodeTestWav([sine(880, 0.1, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    await expect(
      window.locator('[data-testid="drop-zone-voice-3"]'),
    ).toBeVisible();
    await dropFiles(window, 3, [pad]);
    await expect(
      window
        .locator('[data-testid="sample-list-voice-3"]')
        .getByRole("option", { name: "Sample pad.wav in slot 1" }),
    ).toBeVisible();
    await dropFiles(window, 3, [click]);
    await expect(
      window.locator('[data-testid="kit-quarantine-notice"]'),
    ).toContainText("Quarantined");

    // Scan All reports it and changes nothing
    await window.evaluate(() => {
      globalThis.confirm = () => true;
    });
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send("menu-scan-all-kits");
    });
    await expect(
      window.locator('[data-testid="message-display"]', {
        hasText: "1 kit quarantined",
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      window.locator('[data-testid="stereo-badge-3"]'),
    ).toBeVisible();

    // The write summary says what's wrong and how to fix it
    await window.keyboard.press("Escape");
    await window.waitForSelector('[data-testid="kit-grid"]');
    const dialog = await write();
    const quarantined = dialog.locator('[data-testid="quarantined-kits"]');
    await expect(quarantined).toContainText(
      "Kit A0 is quarantined, so it won't be written and its copy on the card stays as it is.",
    );
    await expect(quarantined).toContainText(
      "click.wav is a mono sample in the stereo pair on voices 3 and 4. Unlink them, or replace click.wav with a stereo sample.",
    );
    await confirmAndClose();

    // A0's folder on the card is exactly as it was; B1 is still written
    expect(await snapshot(path.join(card, "A0"))).toEqual(before);
    expect((await fs.readdir(path.join(card, "B1"))).length).toBeGreaterThan(0);
  });
});
