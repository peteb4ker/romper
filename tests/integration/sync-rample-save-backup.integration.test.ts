import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { addKit, addSample } from "../../electron/main/db/romperDbCoreORM.js";
import { RAMPLE_SAVE_BACKUP_FOLDER } from "../../electron/main/rample/rampleSaveBackup.js";
import {
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../../electron/main/services/cardWatchdog.js";
import { syncFileOperationsService } from "../../electron/main/services/syncFileOperations.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { syntheticSaveFolder } from "../factories/rampleSave.factory.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #786, stage 2: before every write, Romper keeps a copy of the Rample's
// _save folder in the store, under .romperdb/rample-save/. It only reads
// the card's _save, and a copy that fails doesn't stop the write.

/** Every file under `root`, relative, with its bytes */
function filesUnder(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of fs.readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    files[path.relative(root, full)] = fs.readFileSync(full).toString("hex");
  }
  return files;
}

describe("[UC-34] [Q-04] a write keeps a copy of the card's _save folder first (#786)", () => {
  let tempDir: string;
  let dbDir: string;
  let card: string;
  let saveDir: string;
  let backups: string;
  let settings: { localStorePath: string };

  beforeEach(() => {
    tempDir = createTempStore("sync-rample-save-");
    const store = path.join(tempDir, "store");
    dbDir = path.join(store, ".romperdb");
    card = path.join(tempDir, "card");
    saveDir = path.join(card, "_save");
    backups = path.join(dbDir, RAMPLE_SAVE_BACKUP_FOLDER);
    fs.mkdirSync(store, { recursive: true });
    createStoreDb(dbDir);
    settings = { localStorePath: store };

    // One edited kit with one sample to write
    expect(
      addKit(dbDir, {
        alias: null,
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: true,
        name: "A0",
        step_pattern: null,
      }).success,
    ).toBe(true);
    fs.mkdirSync(path.join(store, "A0"));
    const source = path.join(store, "A0", "tone.wav");
    fs.writeFileSync(
      source,
      encodeTestWav([sine(220, 0.1, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    expect(
      addSample(dbDir, {
        filename: "tone.wav",
        kit_name: "A0",
        slot_number: 0,
        source_path: source,
        voice_number: 1,
      }).success,
    ).toBe(true);

    // The device's saved settings on the card
    fs.mkdirSync(saveDir, { recursive: true });
    for (const [name, bytes] of Object.entries(syntheticSaveFolder())) {
      fs.writeFileSync(path.join(saveDir, name), bytes);
    }
  });

  afterEach(() => {
    cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    vi.restoreAllMocks();
    removeTempStore(tempDir);
  });

  it("copies _save into the store byte for byte before writing anything, and leaves the card's _save as it was", async () => {
    const saveBefore = filesUnder(saveDir);
    // What the store held when the first file went to the card
    let backupsWhenWriting: string[] | undefined;
    const processAllFiles = syncFileOperationsService.processAllFiles.bind(
      syncFileOperationsService,
    );
    vi.spyOn(syncFileOperationsService, "processAllFiles").mockImplementation(
      (...args) => {
        backupsWhenWriting = fs.existsSync(backups)
          ? fs.readdirSync(backups)
          : [];
        return processAllFiles(...args);
      },
    );

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(true);
    expect(result.data?.syncedFiles).toBe(1);
    const backup = result.data?.rampleSaveBackup;
    expect(backup?.status).toBe("copied");
    if (backup?.status !== "copied") return;
    expect(path.dirname(backup.backupPath)).toBe(backups);
    expect(path.basename(backup.backupPath)).toMatch(/-write$/);
    expect(backupsWhenWriting).toEqual([path.basename(backup.backupPath)]);
    expect(filesUnder(backup.backupPath)).toEqual(saveBefore);
    expect(filesUnder(saveDir)).toEqual(saveBefore);
    expect(fs.existsSync(path.join(card, "A0", "1-01 tone.wav"))).toBe(true);
  });

  it("writes as usual to a card without _save, and stores nothing", async () => {
    fs.rmSync(saveDir, { recursive: true });

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(true);
    expect(result.data?.rampleSaveBackup).toEqual({ status: "missing" });
    expect(result.data?.syncedFiles).toBe(1);
    expect(fs.existsSync(backups)).toBe(false);
    expect(fs.readdirSync(card)).toEqual(["A0"]);
  });

  it("still writes when reading _save stops responding, and stores no partial copy", async () => {
    // Long enough for the write's own card operations on a busy runner (#794)
    cardWatchdogSettings.timeoutMs = 1000;
    const readFile = fs.promises.readFile;
    vi.spyOn(fs.promises, "readFile").mockImplementation(((
      file: fs.PathLike,
      ...rest: unknown[]
    ) =>
      String(file).startsWith(saveDir)
        ? new Promise(() => undefined)
        : (readFile as (...args: unknown[]) => Promise<Buffer>)(
            file,
            ...rest,
          )) as typeof fs.promises.readFile);

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(true);
    expect(result.data?.rampleSaveBackup).toMatchObject({
      cardNotResponding: true,
      status: "failed",
    });
    expect(result.data?.syncedFiles).toBe(1);
    expect(fs.existsSync(backups)).toBe(false);
  });

  it("still writes when _save can't be read", async () => {
    // A file where the folder should be: not a folder, never followed
    fs.rmSync(saveDir, { recursive: true });
    fs.writeFileSync(saveDir, "damaged");

    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });

    expect(result.success).toBe(true);
    expect(result.data?.rampleSaveBackup).toMatchObject({
      cardNotResponding: false,
      status: "failed",
    });
    expect(result.data?.syncedFiles).toBe(1);
    expect(fs.readFileSync(saveDir, "utf8")).toBe("damaged");
  });

  it("keeps one copy per write", async () => {
    for (let write = 0; write < 3; write++) {
      const result = await syncService.startKitSync(settings, {
        sdCardPath: card,
      });
      expect(result.data?.rampleSaveBackup?.status).toBe("copied");
    }

    expect(fs.readdirSync(backups)).toHaveLength(3);
  });
});
