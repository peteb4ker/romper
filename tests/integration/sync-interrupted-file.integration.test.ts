import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { addKit, addSample } from "../../electron/main/db/romperDbCoreORM.js";
import { closeAllDbConnections } from "../../electron/main/db/utils/dbConnections.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";

/** Every file in a card folder, sorted */
function listFolder(folder: string): string[] {
  return fs.readdirSync(folder).sort((a, b) => a.localeCompare(b));
}

/** A tone in `bitDepth` bits: 16 is copied as it is, 24 is converted */
function tone(frequency: number, bitDepth: 16 | 24): Buffer {
  return Buffer.from(
    encodeTestWav([sine(frequency, 0.2, 44100)], {
      bitDepth,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
}

// #882: a write that stops in the middle of a file (the card is pulled,
// fills up or stops responding) must not leave a cut-off WAV under the
// sample's name. Each file is written to a temporary name in its kit folder
// and renamed over the sample's name only once it's complete, so the card
// keeps the copy it had, and the next write puts the new one in place.
describe("[UC-34] [Q-04] A write that stops partway through a file", () => {
  let tempDir: string;
  let store: string;
  let dbDir: string;
  let card: string;
  let settings: { localStorePath: string };
  const kitFolder = () => path.join(card, "A0");
  const COPIED = "1-01 copied.wav";
  const CONVERTED = "2-01 converted.wav";

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-interrupted-"));
    store = path.join(tempDir, "store");
    dbDir = path.join(store, ".romperdb");
    card = path.join(tempDir, "mnt", "RAMPLE");
    fs.mkdirSync(path.join(store, "A0"), { recursive: true });
    fs.mkdirSync(card, { recursive: true });
    createStoreDb(dbDir);
    settings = { localStorePath: store };

    addKit(dbDir, {
      alias: null,
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: true,
      name: "A0",
      step_pattern: null,
    });
    // Voice 1 is copied as it is; voice 2 is 24-bit, so it's converted
    fs.writeFileSync(path.join(store, "A0", "copied.wav"), tone(220, 16));
    fs.writeFileSync(path.join(store, "A0", "converted.wav"), tone(330, 24));
    for (const [voice, filename] of [
      [1, "copied.wav"],
      [2, "converted.wav"],
    ] as const) {
      addSample(dbDir, {
        filename,
        kit_name: "A0",
        slot_number: 0,
        source_path: path.join(store, "A0", filename),
        voice_number: voice,
      });
    }

    // An earlier write put good copies on the card
    const first = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });
    expect(first.success).toBe(true);
    expect(listFolder(kitFolder())).toEqual([COPIED, CONVERTED]);

    // Then the samples change in the store
    fs.writeFileSync(path.join(store, "A0", "copied.wav"), tone(440, 16));
    fs.writeFileSync(path.join(store, "A0", "converted.wav"), tone(550, 24));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Windows can't delete a database file that's still open
    closeAllDbConnections();
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  /**
   * Make every file write into the card stop halfway: half the bytes land,
   * then the card fails, as a pulled or full card does
   */
  function failCardWritesHalfway(call: "copyFile" | "writeFile") {
    const failure = () =>
      Object.assign(new Error("EIO: i/o error, write"), { code: "EIO" });
    const onCard = (target: unknown) =>
      typeof target === "string" && target.startsWith(card);
    const copyFile = fs.promises.copyFile.bind(fs.promises);
    const writeFile = fs.promises.writeFile.bind(fs.promises);
    if (call === "copyFile") {
      vi.spyOn(fs.promises, "copyFile").mockImplementation(
        async (source, target, mode) => {
          if (!onCard(target)) return copyFile(source, target, mode);
          const bytes = await fs.promises.readFile(source);
          await writeFile(target, bytes.subarray(0, bytes.length / 2));
          throw failure();
        },
      );
      return;
    }
    vi.spyOn(fs.promises, "writeFile").mockImplementation(
      async (target, data, options) => {
        if (!onCard(target) || !(data instanceof Uint8Array)) {
          return writeFile(target, data, options);
        }
        await writeFile(target, data.subarray(0, data.length / 2));
        throw failure();
      },
    );
  }

  it.each([
    ["copied", COPIED, "copyFile"],
    ["converted", CONVERTED, "writeFile"],
  ] as const)(
    "keeps the card's good copy of a %s sample and leaves no cut-off file",
    async (_kind, name, call) => {
      const good = {
        [CONVERTED]: fs.readFileSync(path.join(kitFolder(), CONVERTED)),
        [COPIED]: fs.readFileSync(path.join(kitFolder(), COPIED)),
      };
      // Only this sample's write fails
      failCardWritesHalfway(call);

      const result = await syncService.startKitSync(settings, {
        sdCardPath: card,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/EIO/);
      // The sample's name still holds the whole earlier copy, and the
      // temporary file is gone
      expect(fs.readFileSync(path.join(kitFolder(), name))).toEqual(good[name]);
      expect(listFolder(kitFolder())).toEqual([COPIED, CONVERTED]);

      // The next write puts the new copy in place
      vi.restoreAllMocks();
      const again = await syncService.startKitSync(settings, {
        sdCardPath: card,
      });
      expect(again.success).toBe(true);
      expect(listFolder(kitFolder())).toEqual([COPIED, CONVERTED]);
      expect(fs.readFileSync(path.join(kitFolder(), COPIED))).toEqual(
        fs.readFileSync(path.join(store, "A0", "copied.wav")),
      );
      expect(fs.readFileSync(path.join(kitFolder(), CONVERTED))).not.toEqual(
        good[CONVERTED],
      );
    },
  );

  it("removes a temporary file an interrupted write left behind", async () => {
    // A crash or a pulled card can leave one; it isn't a sample
    const leftover = path.join(kitFolder(), "romper-0123abcd.tmp");
    fs.writeFileSync(leftover, "half a sample");

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(true);
    expect(listFolder(kitFolder())).toEqual([COPIED, CONVERTED]);
  });
});
