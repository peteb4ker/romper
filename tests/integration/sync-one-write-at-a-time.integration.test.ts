import type { RampleSaveBackupResult } from "@romper/shared/rampleSave.js";

import { WRITE_IN_PROGRESS_MESSAGE } from "@romper/shared/cardMessages.js";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const probe = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => "/nonexistent",
    getVersion: () => "0.0.0-test",
    isPackaged: false,
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      probe.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => probe.handlers.delete(channel),
  },
}));

/** What the copy of the card's `_save` folder returns instead, when set */
const saveBackup = vi.hoisted(() => ({
  result: undefined as RampleSaveBackupResult | undefined,
}));
vi.mock(
  "../../electron/main/rample/rampleSaveBackup.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../electron/main/rample/rampleSaveBackup.js")
      >();
    return {
      ...actual,
      backupRampleSaveFolder: async (
        ...args: Parameters<typeof actual.backupRampleSaveFolder>
      ) => saveBackup.result ?? actual.backupRampleSaveFolder(...args),
    };
  },
);

import {
  addKit,
  addSample,
  getKit,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerSyncIpcHandlers } from "../../electron/main/db/syncIpcHandlers.js";
import { pathAccess } from "../../electron/main/security/pathAccess.js";
import { CARD_NOT_RESPONDING_MESSAGE } from "../../electron/main/services/cardWatchdog.js";
import { syncFileOperationsService } from "../../electron/main/services/syncFileOperations.js";
import { syncProgressManager } from "../../electron/main/services/syncProgressManager.js";
import { syncSampleProcessingService } from "../../electron/main/services/syncSampleProcessing.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

interface WriteResult {
  data?: { cancelled: boolean; syncedFiles: number };
  error?: string;
  success: boolean;
}

const KITS = ["A0", "A1"];
const VOICES = [1, 2, 3];

/** Each kit's samples as the card names them: <voice>-01 <name>.wav */
const cardName = (voice: number) => `${voice}-01 tone${voice}.wav`;

const REFUSED = { error: WRITE_IN_PROGRESS_MESSAGE, success: false };

// #886: only the write dialog being modal stopped a second write starting
// while one ran. A second request began a new job over the running one, so
// the running write's Cancel stopped working once the second finished, and
// a write planned earlier could remove what a later one had just written.
// Main now refuses a write while one is in progress.
describe("[UC-34] [Q-04] One write to the card at a time (#886)", () => {
  let tempDir: string;
  let store: string;
  let dbDir: string;
  let card: string;
  let settings: { localStorePath: string };
  /** The store's file for each card file, keyed by its path on the card */
  const sources = new Map<string, string>();

  beforeEach(() => {
    tempDir = createTempStore("sync-one-write-");
    store = path.join(tempDir, "store");
    dbDir = path.join(store, ".romperdb");
    card = path.join(tempDir, "card");
    fs.mkdirSync(store, { recursive: true });
    fs.mkdirSync(card, { recursive: true });
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
    // A kit an earlier write left, which the store no longer has
    fs.mkdirSync(path.join(card, "Z9"));
    fs.writeFileSync(path.join(card, "Z9", "1-01 gone.wav"), "gone");

    pathAccess.reset();
    pathAccess.grantRoot(card);
    probe.handlers.clear();
    registerSyncIpcHandlers(settings);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    saveBackup.result = undefined;
    pathAccess.reset();
    removeTempStore(tempDir);
  });

  /** Ask main to write, as the dialog does */
  async function requestWrite(sdCardPath = card): Promise<WriteResult> {
    const handler = probe.handlers.get("startKitSync");
    if (!handler) throw new Error("no startKitSync handler");
    return (await handler({}, { sdCardPath })) as WriteResult;
  }

  /** Every file on the card with its bytes */
  function cardSnapshot(): Record<string, string> {
    return Object.fromEntries(
      fs
        .readdirSync(card, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => {
          const file = path.join(e.parentPath, e.name);
          return [
            path.relative(card, file),
            fs.readFileSync(file, "base64"),
          ] as const;
        }),
    );
  }

  /** The card holds exactly the store's samples, and every kit is written */
  function expectCardMirrorsStore() {
    const expected = Object.fromEntries(
      [...sources].map(([file, source]) => [
        file,
        fs.readFileSync(source, "base64"),
      ]),
    );
    expect(cardSnapshot()).toEqual(expected);
    for (const kit of KITS) {
      expect(getKit(dbDir, kit).data?.modified_since_sync).toBe(false);
    }
  }

  /**
   * Start a write and hold it while it plans its first sample, until
   * `release` is called. Resolves once the write is held.
   */
  async function startHeldWrite() {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let held!: () => void;
    const holding = new Promise<void>((resolve) => (held = resolve));
    const plan = syncSampleProcessingService.processSampleForSync.bind(
      syncSampleProcessingService,
    );
    vi.spyOn(
      syncSampleProcessingService,
      "processSampleForSync",
    ).mockImplementationOnce(async (...args) => {
      held();
      await released;
      return plan(...args);
    });
    const first = requestWrite();
    await holding;
    return { first, release };
  }

  it("refuses a second write while one runs, and the first completes", async () => {
    const before = cardSnapshot();
    const { first, release } = await startHeldWrite();

    // Through the write's IPC handler, and by a caller that skips it
    expect(await requestWrite()).toEqual(REFUSED);
    expect(
      await syncService.startKitSync(settings, { sdCardPath: card }),
    ).toEqual(REFUSED);

    // The refusals changed nothing and left the running write's job alone
    expect(cardSnapshot()).toEqual(before);
    expect(syncProgressManager.getCurrentSyncJob()).not.toBeNull();
    for (const kit of KITS) {
      expect(getKit(dbDir, kit).data?.modified_since_sync).toBe(true);
    }

    release();
    expect(await first).toMatchObject({
      data: { cancelled: false, syncedFiles: 6 },
      success: true,
    });
    expectCardMirrorsStore();
    expect(syncProgressManager.getCurrentSyncJob()).toBeNull();
  });

  it("keeps the running write's Cancel working after a refused request", async () => {
    const before = cardSnapshot();
    const { first, release } = await startHeldWrite();
    expect(await requestWrite()).toEqual(REFUSED);

    await probe.handlers.get("cancelKitSync")?.({});
    release();

    expect(await first).toMatchObject({
      data: { cancelled: true, syncedFiles: 0 },
      success: true,
    });
    expect(cardSnapshot()).toEqual(before);
    for (const kit of KITS) {
      expect(getKit(dbDir, kit).data?.modified_since_sync).toBe(true);
    }
  });

  it("accepts the next write once the running one has finished", async () => {
    const { first, release } = await startHeldWrite();
    expect(await requestWrite()).toEqual(REFUSED);
    release();
    expect((await first).success).toBe(true);

    // Something on the card changed since: the next write puts it back
    const removed = path.join("A0", cardName(1));
    fs.rmSync(path.join(card, removed));

    expect(await requestWrite()).toMatchObject({
      data: { cancelled: false },
      success: true,
    });
    expectCardMirrorsStore();
  });

  describe("however a write ends, the next one is accepted", () => {
    it("after the card's path check refuses it", async () => {
      const elsewhere = path.join(tempDir, "elsewhere");
      fs.mkdirSync(elsewhere);
      const refused = await requestWrite(elsewhere);
      expect(refused.success).toBe(false);
      expect(refused.error).toMatch(/Access denied/);

      expect((await requestWrite()).success).toBe(true);
      expectCardMirrorsStore();
    });

    it("after it fails", async () => {
      vi.spyOn(syncFileOperationsService, "processAllFiles").mockRejectedValue(
        new Error("card full"),
      );
      const failed = await requestWrite();
      expect(failed.success).toBe(false);
      expect(failed.error).toMatch(/card full/);
      vi.restoreAllMocks();

      expect((await requestWrite()).success).toBe(true);
      expectCardMirrorsStore();
    });

    it("after the card stops responding", async () => {
      saveBackup.result = {
        cardNotResponding: true,
        error: CARD_NOT_RESPONDING_MESSAGE,
        status: "failed",
      };
      expect(await requestWrite()).toEqual({
        error: CARD_NOT_RESPONDING_MESSAGE,
        success: false,
      });
      saveBackup.result = undefined;

      expect((await requestWrite()).success).toBe(true);
      expectCardMirrorsStore();
    });

    it("after it's cancelled", async () => {
      const { first, release } = await startHeldWrite();
      syncService.cancelSync();
      release();
      expect((await first).data?.cancelled).toBe(true);

      expect(await requestWrite()).toMatchObject({
        data: { cancelled: false, syncedFiles: 6 },
        success: true,
      });
      expectCardMirrorsStore();
    });
  });
});
