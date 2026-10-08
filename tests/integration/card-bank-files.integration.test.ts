import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import {
  createRomperDbFile,
  updateBank,
} from "../../electron/main/db/romperDbCoreORM.js";
import {
  CARD_NOT_RESPONDING_MESSAGE,
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../../electron/main/services/cardWatchdog.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #656: a write put the bank name files on the card root with synchronous
// fs calls. On a card whose driver stopped responding (#653), one of them
// blocked the main process and froze the window. They're now asynchronous,
// under the card watchdog.

/** The watchdog's limit in these tests: long enough to count turns */
const SHORT_WATCHDOG_MS = 200;

describe("[UC-34] [Q-01] writing the bank name files to the card (#656)", () => {
  let tempDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };

  const rtfFiles = () =>
    fs
      .readdirSync(sdCardPath)
      .filter((file) => file.endsWith(".rtf"))
      .sort((a, b) => a.localeCompare(b));
  const nameBank = (letter: string, artist: string) =>
    expect(
      updateBank(dbDir(), letter, {
        artist,
        rtf_filename: `${letter} - ${artist}.rtf`,
      }).success,
    ).toBe(true);
  const dbDir = () => path.join(settings.localStorePath, ".romperdb");

  beforeEach(() => {
    tempDir = createTempStore("card-bank-files-");
    const localStorePath = path.join(tempDir, "store");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(localStorePath, { recursive: true });
    fs.mkdirSync(sdCardPath, { recursive: true });
    settings = { localStorePath };
    createRomperDbFile(dbDir());

    // What an earlier write left: an old name for bank A, and a kit the
    // store no longer has
    fs.writeFileSync(path.join(sdCardPath, "A - Old Name.rtf"), "{\\rtf1}");
    fs.mkdirSync(path.join(sdCardPath, "C0"));
    fs.writeFileSync(path.join(sdCardPath, "C0", "1-01 kick.wav"), "x");
  });

  afterEach(() => {
    cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    vi.restoreAllMocks();
    removeTempStore(tempDir);
  });

  it("writes a name file for every named bank, replacing the old ones", async () => {
    nameBank("A", "ALWIS");
    nameBank("B", "Dr. Octagon");

    const result = await syncService.startKitSync(settings, { sdCardPath });

    expect(result.success).toBe(true);
    expect(rtfFiles()).toEqual(["A - ALWIS.rtf", "B - Dr. Octagon.rtf"]);
    for (const file of rtfFiles()) {
      expect(fs.readFileSync(path.join(sdCardPath, file), "utf8")).toBe(
        String.raw`{\rtf1}`,
      );
    }
    // The stale kit went too, after the name files
    expect(fs.existsSync(path.join(sdCardPath, "C0"))).toBe(false);
  });

  it("fails the write, and keeps the window responsive, when a name file is never written", async () => {
    nameBank("A", "ALWIS");
    // The card's driver stops responding: writing a name file never
    // finishes. Other writes go through.
    const writeFile = fs.promises.writeFile;
    const hung = vi
      .spyOn(fs.promises, "writeFile")
      .mockImplementation((file, ...rest) =>
        String(file).endsWith(".rtf")
          ? new Promise<void>(() => undefined)
          : writeFile(file, ...rest),
      );
    cardWatchdogSettings.timeoutMs = SHORT_WATCHDOG_MS;

    // Count event-loop turns while the write waits: a call that held the
    // main thread would let none through until it returned
    let turns = 0;
    let writing = true;
    const tick = () => {
      if (!writing) return;
      turns++;
      setImmediate(tick);
    };
    setImmediate(tick);
    let timerFired = false;
    setTimeout(() => {
      timerFired = true;
    }, SHORT_WATCHDOG_MS / 4);

    const started = performance.now();
    const result = await syncService.startKitSync(settings, { sdCardPath });
    writing = false;

    expect(hung).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain(CARD_NOT_RESPONDING_MESSAGE);
    // It gave up at the watchdog's limit, not the default minute
    expect(performance.now() - started).toBeLessThan(CARD_OPERATION_TIMEOUT_MS);
    // Other work ran while the write waited on the card
    expect(timerFired).toBe(true);
    expect(turns).toBeGreaterThan(10);
    // The write stopped there: the old name was removed before the new one
    // was written, and nothing the store no longer has was removed
    expect(rtfFiles()).toEqual([]);
    expect(fs.existsSync(path.join(sdCardPath, "C0"))).toBe(true);
  });
});
