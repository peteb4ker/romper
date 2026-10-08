import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
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

interface CopyGate {
  copies: number;
  open: () => void;
}

type GateGlobal = { __copyGate: CopyGate } & typeof globalThis;

/**
 * Hold the write at its second file until the test opens the gate, so
 * Cancel lands mid-write however fast the machine copies. The sync copies
 * each sample with `fs.promises.copyFile`; this wraps it in the main
 * process for this app only.
 */
async function holdSecondCopy(app: ElectronApplication) {
  await app.evaluate(() => {
    const fsp = process.getBuiltinModule("node:fs").promises;
    const copyFile = fsp.copyFile.bind(fsp);
    let open = () => {};
    const opened = new Promise<void>((resolve) => {
      open = resolve;
    });
    const gate: CopyGate = { copies: 0, open };
    (globalThis as GateGlobal).__copyGate = gate;
    fsp.copyFile = (async (...args: Parameters<typeof copyFile>) => {
      gate.copies++;
      if (gate.copies >= 2) await opened;
      return copyFile(...args);
    }) as typeof fsp.copyFile;
  });
}

/** Every file on the card, as relative paths, sorted */
async function listCard(card: string): Promise<string[]> {
  const entries = await fs.readdir(card, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(card, path.join(e.parentPath, e.name)))
    .sort();
}

/**
 * UC-34: Cancel in the write dialog stops a write between files. The
 * dialog says the write was cancelled and how far it got, the card holds
 * whole files only with nothing removed, and the next write finishes it.
 */
test.describe("[UC-34] Cancel a write to the card", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let card: string;

  const dialog = () => window.locator('[data-testid="sync-dialog"]');

  /** Open the write dialog and wait for its summary of the fixture's kits */
  async function openWriteDialog() {
    await window.locator('[data-testid="sync-to-sd-card"]').click();
    await expect(dialog()).toBeVisible();
    await expect(window.locator('[data-testid="total-samples"]')).toHaveText(
      "4",
    );
  }

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    card = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-cancel-card-"));
    // An earlier write left a kit the store doesn't have, and the Rample
    // saved its own settings
    await fs.outputFile(path.join(card, "Z9", "1-01 gone.wav"), "gone");
    await fs.outputFile(path.join(card, "_save", "A0.rpl"), "rample");

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
    if (card) await fs.remove(card);
  });

  test("Cancel stops the write, says so, and the next write finishes it", async () => {
    test.setTimeout(30000);
    const before = await listCard(card);
    // Fixture kits A0 and B1: a kick and a snare each, four files
    const expected = ["A0", "B1"].flatMap((kit) => [
      path.join(kit, "1-01 kick.wav"),
      path.join(kit, "2-01 snare.wav"),
    ]);

    await openWriteDialog();
    await holdSecondCopy(electronApp);
    await window.locator('[data-testid="confirm-sync"]').click();

    // The second file is being written when Cancel is pressed
    await expect
      .poll(() =>
        electronApp.evaluate(
          () => (globalThis as GateGlobal).__copyGate.copies,
        ),
      )
      .toBe(2);
    const cancel = window.locator('[data-testid="cancel-write"]');
    await cancel.click();
    await expect(cancel).toHaveText("Cancelling...");
    await expect(cancel).toBeDisabled();
    await electronApp.evaluate(() =>
      (globalThis as GateGlobal).__copyGate.open(),
    );

    // The dialog says the write stopped, after the file in progress
    await expect(window.locator('[data-testid="write-cancelled"]')).toHaveText(
      "Write cancelled",
    );
    await expect(dialog()).toContainText("2/4");
    await expect(dialog()).not.toContainText("Write Complete");
    await expect(window.locator('[data-testid="cancel-sync"]')).toHaveText(
      "Close",
    );

    // The card has the two finished files, whole, and nothing was removed
    const written = (await listCard(card)).filter((f) => !before.includes(f));
    expect(written).toHaveLength(2);
    for (const file of written) {
      expect(expected).toContain(file);
      expect(
        (await fs.readFile(path.join(card, file))).subarray(0, 4).toString(),
      ).toBe("RIFF");
    }
    expect(await listCard(card)).toEqual([...before, ...written].sort());
    // No third file was started after the cancel
    expect(
      await electronApp.evaluate(
        () => (globalThis as GateGlobal).__copyGate.copies,
      ),
    ).toBe(2);

    // Writing again finishes the job: the card mirrors the store
    await window.locator('[data-testid="cancel-sync"]').click();
    await expect(dialog()).toHaveCount(0);
    await openWriteDialog();
    await window.locator('[data-testid="confirm-sync"]').click();
    await expect(dialog().getByText("Write Complete")).toBeVisible({
      timeout: 15000,
    });
    expect(await listCard(card)).toEqual(
      [...expected, path.join("_save", "A0.rpl")].sort(),
    );
  });
});
