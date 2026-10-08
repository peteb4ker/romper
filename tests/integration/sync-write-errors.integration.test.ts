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
  createRomperDbFile,
  getKit,
} from "../../electron/main/db/romperDbCoreORM.js";
import { closeAllDbConnections } from "../../electron/main/db/utils/dbConnections.js";
import { syncProgressManager } from "../../electron/main/services/syncProgressManager.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";

const KITS = ["A0", "A1"];
const VOICES = [1, 2, 3];

/** Every file on the card, as relative paths, sorted */
function listCard(card: string): string[] {
  return fs
    .readdirSync(card, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(card, path.join(e.parentPath, e.name)))
    .sort();
}

// Permissions can't make a folder unwritable on Windows, or for root
const canDenyWrites = process.platform !== "win32" && process.getuid?.() !== 0;

// RE-67, plan item 4: when a write goes wrong part way, the user is told
// why, the store doesn't claim a write that didn't finish ("modified since
// sync" stays on), and nothing is removed from the card, since removals
// come only after every file is written. The next write can then finish
// the job.
describe("[UC-34] [Q-07] A write that goes wrong", () => {
  let tempDir: string;
  let store: string;
  let dbDir: string;
  /** The folder the card is mounted in */
  let mount: string;
  let card: string;
  let settings: { localStorePath: string };
  /** Folders a test made read-only, to make writable again for cleanup */
  const locked: string[] = [];
  /** The store's file for each sample, by kit and voice */
  const source = (kit: string, voice: number) =>
    path.join(store, kit, `tone${voice}.wav`);

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-write-errors-"));
    store = path.join(tempDir, "store");
    dbDir = path.join(store, ".romperdb");
    mount = path.join(tempDir, "mnt");
    card = path.join(mount, "RAMPLE");
    fs.mkdirSync(store, { recursive: true });
    createRomperDbFile(dbDir);
    settings = { localStorePath: store };

    // Two edited kits, a tone on voices 1-3 of each: six files to write
    for (const kit of KITS) {
      addKit(dbDir, {
        alias: null,
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: true,
        name: kit,
        step_pattern: null,
      });
      fs.mkdirSync(path.join(store, kit));
      for (const voice of VOICES) {
        fs.writeFileSync(
          source(kit, voice),
          encodeTestWav([sine(110 * voice, 0.2, 44100)], {
            bitDepth: 16,
            encoding: "pcm",
            sampleRate: 44100,
          }),
        );
        addSample(dbDir, {
          filename: `tone${voice}.wav`,
          kit_name: kit,
          slot_number: 0,
          source_path: source(kit, voice),
          voice_number: voice,
        });
      }
    }

    // An earlier write left a kit the store no longer has, and the Rample
    // saved its own settings
    fs.mkdirSync(path.join(card, "Z9"), { recursive: true });
    fs.writeFileSync(path.join(card, "Z9", "1-01 gone.wav"), "gone");
    fs.mkdirSync(path.join(card, "_save"));
    fs.writeFileSync(path.join(card, "_save", "A0.rpl"), "rample");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of locked.splice(0)) fs.chmodSync(dir, 0o755);
    // Windows can't delete a database file that's still open
    closeAllDbConnections();
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  /** Run `action` once `files` files have been written */
  function afterFiles(files: number, action: () => void) {
    const emit =
      syncProgressManager.emitFileCompletionProgress.bind(syncProgressManager);
    let written = 0;
    vi.spyOn(
      syncProgressManager,
      "emitFileCompletionProgress",
    ).mockImplementation((fileOp) => {
      emit(fileOp);
      if (++written === files) action();
    });
  }

  /** Count the "Write Complete" events the dialog would show */
  function completions(): { count: number } {
    const seen = { count: 0 };
    const emit =
      syncProgressManager.emitCompletionProgress.bind(syncProgressManager);
    vi.spyOn(syncProgressManager, "emitCompletionProgress").mockImplementation(
      (syncedFiles, totalFiles) => {
        seen.count++;
        emit(syncedFiles, totalFiles);
      },
    );
    return seen;
  }

  /** Nothing was removed from the card, and no kit counts as written */
  function expectNothingClaimed() {
    expect(
      fs.readFileSync(path.join(card, "Z9", "1-01 gone.wav"), "utf8"),
    ).toBe("gone");
    expect(fs.readFileSync(path.join(card, "_save", "A0.rpl"), "utf8")).toBe(
      "rample",
    );
    for (const kit of KITS) {
      expect(getKit(dbDir, kit).data?.modified_since_sync, kit).toBe(true);
    }
  }

  it("refuses to write without asking when a sample went missing after the summary, then writes the rest once agreed", async () => {
    const summary = await syncService.generateChangeSummary(settings, card);
    expect(summary.data?.fileCount).toBe(6);
    const before = listCard(card);

    // The user moves a sample away while the summary is open
    fs.rmSync(source("A0", 2));

    const refused = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });
    expect(refused.success).toBe(false);
    expect(refused.error).toBe(
      "1 sample can't be written to the card. Nothing was written. Confirm skipping them in the write summary to continue.",
    );
    expect(listCard(card)).toEqual(before);
    expectNothingClaimed();

    // Agreeing to skip it writes the other five
    const written = await syncService.startKitSync(settings, {
      sdCardPath: card,
      skipInvalidFiles: true,
    });
    expect(written.success).toBe(true);
    expect(written.data?.syncedFiles).toBe(5);
    expect(written.data?.skippedFiles.map((f) => f.filename)).toEqual([
      "tone2.wav",
    ]);
    expect(listCard(card)).toEqual(
      [
        path.join("A0", "1-01 tone1.wav"),
        path.join("A0", "3-01 tone3.wav"),
        path.join("A1", "1-01 tone1.wav"),
        path.join("A1", "2-01 tone2.wav"),
        path.join("A1", "3-01 tone3.wav"),
        path.join("_save", "A0.rpl"),
      ].sort(),
    );
    // The kit missing a sample still has changes the card doesn't
    expect(getKit(dbDir, "A0").data?.modified_since_sync).toBe(true);
    expect(getKit(dbDir, "A1").data?.modified_since_sync).toBe(false);
  });

  it("fails with the reason when a sample disappears during the write, and claims nothing", async () => {
    const done = completions();
    afterFiles(1, () => fs.rmSync(source("A1", 3)));

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Failed to sync kit: .*tone3\.wav/);
    expect(done.count).toBe(0);
    expectNothingClaimed();
    // What was written before it is whole: the store's bytes
    const written = listCard(card).filter((f) => /^A\d/.test(f));
    expect(written).toHaveLength(5);
    for (const file of written) {
      const [kit, name] = file.split(path.sep);
      const voice = Number(name[0]);
      expect(fs.readFileSync(path.join(card, file))).toEqual(
        fs.readFileSync(source(kit, voice)),
      );
    }

    // Put back, the next write finishes the job
    vi.restoreAllMocks();
    fs.writeFileSync(source("A1", 3), fs.readFileSync(source("A0", 3)));
    const again = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });
    expect(again.success).toBe(true);
    expect(fs.existsSync(path.join(card, "Z9"))).toBe(false);
    for (const kit of KITS) {
      expect(getKit(dbDir, kit).data?.modified_since_sync).toBe(false);
    }
  });

  it.runIf(canDenyWrites)(
    "fails with the reason on a card it can't write to, and claims nothing",
    async () => {
      // A card that's write-protected
      for (const dir of [
        card,
        path.join(card, "Z9"),
        path.join(card, "_save"),
      ]) {
        fs.chmodSync(dir, 0o555);
        locked.push(dir);
      }
      const done = completions();

      const result = await syncService.startKitSync(settings, {
        sdCardPath: card,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Failed to sync kit: .*EACCES/);
      expect(done.count).toBe(0);
      expect(listCard(card)).toEqual(
        [path.join("Z9", "1-01 gone.wav"), path.join("_save", "A0.rpl")].sort(),
      );
      expectNothingClaimed();
    },
  );

  it.runIf(canDenyWrites)(
    "fails with the reason when the card is removed during the write, and doesn't make a new folder in its place",
    async () => {
      const done = completions();
      // The card is ejected after the first file: its folder goes, and
      // the folder it was mounted in can't be written to (like /Volumes)
      afterFiles(1, () => {
        fs.rmSync(card, { force: true, recursive: true });
        fs.chmodSync(mount, 0o555);
        locked.push(mount);
      });

      const result = await syncService.startKitSync(settings, {
        sdCardPath: card,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Failed to sync kit: /);
      expect(done.count).toBe(0);
      expect(fs.existsSync(card)).toBe(false);
      for (const kit of KITS) {
        expect(getKit(dbDir, kit).data?.modified_since_sync, kit).toBe(true);
      }
    },
  );
});
