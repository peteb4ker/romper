import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import {
  addKit,
  addSample,
  getKit,
} from "../../electron/main/db/romperDbCoreORM.js";
import { closeAllDbConnections } from "../../electron/main/db/utils/dbConnections.js";
import { syncProgressManager } from "../../electron/main/services/syncProgressManager.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";

const KITS = ["A0", "A1"];
const VOICES = [1, 2, 3];

/** Each kit's samples as the card names them: <voice>-01 <name>.wav */
const cardName = (voice: number) => `${voice}-01 tone${voice}.wav`;

/** Every entry on the card, as relative paths, sorted */
function listCard(card: string): string[] {
  return fs
    .readdirSync(card, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(card, path.join(e.parentPath, e.name)))
    .sort();
}

// UC-34: Cancel stops a write between files. What's on the card then is
// whole files only, nothing has been removed from it, no kit is marked as
// written, and the next write finishes the job.
describe("[UC-34] Cancelling a write to the card", () => {
  let tempDir: string;
  let store: string;
  let dbDir: string;
  let card: string;
  let settings: { localStorePath: string };
  /** The store's file for each card file, keyed like listCard's entries */
  const sources = new Map<string, string>();

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-cancel-"));
    store = path.join(tempDir, "store");
    dbDir = path.join(store, ".romperdb");
    card = path.join(tempDir, "card");
    fs.mkdirSync(store, { recursive: true });
    createStoreDb(dbDir);
    settings = { localStorePath: store };

    // Two edited kits, a tone on voices 1-3 of each: six files to write
    for (const kit of KITS) {
      expect(
        addKit(dbDir, {
          alias: null,
          bank_letter: "A",
          editable: true,
          locked: false,
          modified_since_sync: true,
          name: kit,
          step_pattern: null,
        }).success,
      ).toBe(true);
      fs.mkdirSync(path.join(store, kit));
      for (const voice of VOICES) {
        const file = path.join(store, kit, `tone${voice}.wav`);
        fs.writeFileSync(
          file,
          encodeTestWav([sine(110 * voice, 0.5, 44100)], {
            bitDepth: 16,
            encoding: "pcm",
            sampleRate: 44100,
          }),
        );
        expect(
          addSample(dbDir, {
            filename: `tone${voice}.wav`,
            kit_name: kit,
            slot_number: 0,
            source_path: file,
            voice_number: voice,
          }).success,
        ).toBe(true);
        sources.set(path.join(kit, cardName(voice)), file);
      }
    }

    // An earlier write left a sample and a kit the store no longer has,
    // and the Rample saved its own settings
    fs.mkdirSync(path.join(card, "A0"), { recursive: true });
    fs.writeFileSync(path.join(card, "A0", "4-01 old.wav"), "old");
    fs.mkdirSync(path.join(card, "Z9"));
    fs.writeFileSync(path.join(card, "Z9", "1-01 gone.wav"), "gone");
    fs.mkdirSync(path.join(card, "_save"));
    fs.writeFileSync(path.join(card, "_save", "A0.rpl"), "rample");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Windows can't delete a database file that's still open
    closeAllDbConnections();
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  /** Press Cancel once `files` files have been written, as the dialog does */
  function cancelAfter(files: number) {
    const emit =
      syncProgressManager.emitFileCompletionProgress.bind(syncProgressManager);
    let written = 0;
    vi.spyOn(
      syncProgressManager,
      "emitFileCompletionProgress",
    ).mockImplementation((fileOp) => {
      emit(fileOp);
      if (++written === files) syncService.cancelSync();
    });
  }

  it("stops after the file in progress and leaves the card consistent", async () => {
    const before = listCard(card);
    cancelAfter(2);

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ cancelled: true, syncedFiles: 2 });

    // Two of the six were written, each whole: the same bytes as the store's
    const written = listCard(card).filter((f) => !before.includes(f));
    expect(written).toHaveLength(2);
    for (const file of written) {
      expect(sources.has(file)).toBe(true);
      expect(fs.readFileSync(path.join(card, file))).toEqual(
        fs.readFileSync(sources.get(file)!),
      );
    }

    // Nothing was removed: the stale sample and kit wait for a full write,
    // and the Rample's own files are untouched
    expect(listCard(card)).toEqual([...before, ...written].sort());
    expect(fs.readFileSync(path.join(card, "_save", "A0.rpl"), "utf8")).toBe(
      "rample",
    );

    // No kit counts as written
    for (const kit of KITS) {
      expect(getKit(dbDir, kit).data?.modified_since_sync).toBe(true);
    }
  });

  it("finishes the job on the next write", async () => {
    cancelAfter(2);
    const cancelled = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });
    expect(cancelled.data?.cancelled).toBe(true);
    vi.restoreAllMocks();

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(true);
    // The cancel doesn't carry over: this write runs to the end
    expect(result.data).toMatchObject({ cancelled: false, syncedFiles: 6 });

    // The card now mirrors the store, and the Rample's files stay
    expect(listCard(card)).toEqual(
      [...sources.keys(), path.join("_save", "A0.rpl")].sort(),
    );
    for (const [file, source] of sources) {
      expect(fs.readFileSync(path.join(card, file))).toEqual(
        fs.readFileSync(source),
      );
    }
    for (const kit of KITS) {
      expect(getKit(dbDir, kit).data?.modified_since_sync).toBe(false);
    }
  });

  // #634: the dialog says "Write Complete" on the completion event, and the
  // user may take the card out then. The event used to go out before the
  // card's stale entries were removed, so a card read on it still had them.
  it("reports the next write complete only once the card mirrors the store", async () => {
    cancelAfter(2);
    await syncService.startKitSync(settings, { sdCardPath: card });
    vi.restoreAllMocks();

    const emit =
      syncProgressManager.emitCompletionProgress.bind(syncProgressManager);
    const atCompletion: { card: string[]; written: boolean[] }[] = [];
    vi.spyOn(syncProgressManager, "emitCompletionProgress").mockImplementation(
      (syncedFiles, totalFiles) => {
        atCompletion.push({
          card: listCard(card),
          written: KITS.map(
            (kit) => getKit(dbDir, kit).data?.modified_since_sync === false,
          ),
        });
        emit(syncedFiles, totalFiles);
      },
    );

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.data?.cancelled).toBe(false);
    expect(atCompletion).toEqual([
      {
        card: [...sources.keys(), path.join("_save", "A0.rpl")].sort(),
        written: KITS.map(() => true),
      },
    ]);
  });
});
