/**
 * One connection per store (RE-81) and multi-step writes as one unit of
 * work (RE-28).
 *
 * The connection tests count better-sqlite3 constructions with a counting
 * subclass of the real driver. The fault-injection tests make one step of
 * an operation fail with a SQLite trigger (RAISE(ABORT)), so the operation
 * runs unmodified, and then check that none of its earlier steps were kept.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const probe = vi.hoisted(() => ({ opened: [] as string[] }));

vi.mock("electron", () => ({
  app: { getPath: () => "/nonexistent", isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
}));

// The real driver, recording each connection it opens
vi.mock("better-sqlite3", async (importOriginal) => {
  const Real = (
    await importOriginal<{ default: typeof import("better-sqlite3") }>()
  ).default;
  class CountingDatabase extends Real {
    constructor(...args: ConstructorParameters<typeof Real>) {
      super(...args);
      probe.opened.push(String(args[0]));
    }
  }
  return { default: CountingDatabase };
});

import {
  addKit,
  addSample,
  closeAllDbConnections,
  closeDbConnection,
  createRomperDbFile,
  getKit,
  getKits,
  getKitSamples,
  updateVoiceAlias,
  withDbTransaction,
} from "../../electron/main/db/romperDbCoreORM.js";
import {
  getOpenDbConnection,
  openDbConnectionCount,
} from "../../electron/main/db/utils/dbConnections.js";
import { kitService } from "../../electron/main/services/kitService.js";
import { LocalStoreSetupService } from "../../electron/main/services/localStoreSetupService.js";
import { sampleService } from "../../electron/main/services/sampleService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";

let work: string;
let store: string;
let dbDir: string;
let settings: { localStorePath: string };

/** Make every statement that fires `trigger` fail, as a fault partway */
function injectFault(dir: string, name: string, trigger: string) {
  const created = withDbTransaction(dir, (_db, sqlite) =>
    sqlite.exec(
      `CREATE TRIGGER ${name} ${trigger} BEGIN SELECT RAISE(ABORT, 'injected fault'); END`,
    ),
  );
  expect(created.success).toBe(true);
}

function newKit(dir: string, name: string) {
  expect(
    addKit(dir, {
      bank_letter: name.charAt(0),
      editable: true,
      modified_since_sync: false,
      name,
    }).success,
  ).toBe(true);
}

function opened(dir: string) {
  const file = path.join(dir, "romper.sqlite");
  return probe.opened.filter((f) => path.resolve(f) === path.resolve(file))
    .length;
}

function slots(kitName: string, voice: number) {
  return (getKitSamples(dbDir, kitName).data ?? [])
    .filter((s) => s.voice_number === voice)
    .sort((a, b) => a.slot_number - b.slot_number)
    .map((s) => `${s.slot_number}:${s.filename}`);
}

function wav(file: string, hz = 220) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    encodeTestWav([sine(hz, 0.02, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
  return file;
}

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), "romper-uow-"));
  store = path.join(work, "store");
  dbDir = path.join(store, ".romperdb");
  expect(createRomperDbFile(dbDir).success).toBe(true);
  settings = { localStorePath: store };
  // A0 holds three samples on voice 1
  newKit(dbDir, "A0");
  for (const [slot, name] of ["a", "b", "c"].entries()) {
    expect(
      addSample(dbDir, {
        filename: `${name}.wav`,
        kit_name: "A0",
        slot_number: slot,
        source_path: wav(
          path.join(store, "A0", `${name}.wav`),
          110 * (slot + 1),
        ),
        voice_number: 1,
      }).success,
    ).toBe(true);
  }
  probe.opened.length = 0;
});

afterEach(() => {
  // Windows can't delete a database file that's still open
  closeAllDbConnections();
  fs.rmSync(work, { force: true, recursive: true });
});

describe("[Q-01] [Q-02] one connection per store (RE-81)", () => {
  it("opens the store once for a run of reads and edits", () => {
    closeAllDbConnections();

    expect(getKits(dbDir).success).toBe(true);
    const added = sampleService.addSampleToSlot(
      settings,
      "A0",
      2,
      0,
      wav(path.join(work, "in", "added.wav")),
    );
    expect(added.error).toBeUndefined();
    expect(
      sampleService.moveSampleInKit(settings, "A0", 1, 0, 1, 2, "insert")
        .success,
    ).toBe(true);
    expect(
      sampleService.replaceSampleInSlot(
        settings,
        "A0",
        2,
        0,
        wav(path.join(work, "in", "replacement.wav"), 330),
      ).success,
    ).toBe(true);
    expect(
      sampleService.deleteSampleFromSlot(settings, "A0", 1, 0).success,
    ).toBe(true);
    expect(kitService.createKit(settings, "B0").success).toBe(true);
    expect(updateVoiceAlias(dbDir, "B0", 1, "Kick").success).toBe(true);

    expect(opened(dbDir)).toBe(1);
    expect(openDbConnectionCount()).toBe(1);
  });

  it("keeps one connection per store, and reopens a store after it's closed", () => {
    const other = path.join(work, "other", ".romperdb");
    expect(createRomperDbFile(other).success).toBe(true);
    newKit(other, "C0");
    expect(openDbConnectionCount()).toBe(2);

    closeDbConnection(dbDir);
    expect(getOpenDbConnection(dbDir)).toBeUndefined();
    expect(getKit(dbDir, "A0").data?.name).toBe("A0");
    expect(getKit(other, "C0").data?.name).toBe("C0");

    expect(opened(dbDir)).toBe(1);
    expect(opened(other)).toBe(1);
  });

  it("closes a failed setup's database before moving it aside", () => {
    const setup = new LocalStoreSetupService();
    const target = path.join(work, "new-store");
    const setupDb = path.join(target, ".romperdb");
    expect(setup.createSetupDatabase(setupDb).success).toBe(true);
    expect(getOpenDbConnection(setupDb)).toBeDefined();

    const cleaned = setup.cleanupFailedSetup(target);

    expect(cleaned.removed).toBe(true);
    expect(getOpenDbConnection(setupDb)).toBeUndefined();
    expect(fs.existsSync(setupDb)).toBe(false);
  });
});

describe("[Q-02] a failure partway through a change saves none of it (RE-28)", () => {
  it("creating a kit: no kit without its voices", () => {
    injectFault(dbDir, "no_voices", "BEFORE INSERT ON voices");

    const result = kitService.createKit(settings, "B0");

    expect(result.success).toBe(false);
    expect(getKit(dbDir, "B0").data).toBeNull();
  });

  it("deleting a sample: a reindex that fails puts the sample back", () => {
    injectFault(dbDir, "no_reindex", "BEFORE UPDATE OF slot_number ON samples");

    const result = sampleService.deleteSampleFromSlot(settings, "A0", 1, 0);

    expect(result.success).toBe(false);
    expect(slots("A0", 1)).toEqual(["0:a.wav", "1:b.wav", "2:c.wav"]);
    expect(getKit(dbDir, "A0").data?.modified_since_sync).toBe(false);
  });

  it("adding a sample: a modified flag that fails takes the sample with it", () => {
    injectFault(
      dbDir,
      "no_flag",
      "BEFORE UPDATE OF modified_since_sync ON kits",
    );

    const result = sampleService.addSampleToSlot(
      settings,
      "A0",
      2,
      0,
      wav(path.join(work, "in", "added.wav")),
    );

    expect(result.success).toBe(false);
    expect(slots("A0", 2)).toEqual([]);
  });

  it("moving a sample within a kit: the move is undone with its flag", () => {
    injectFault(
      dbDir,
      "no_flag",
      "BEFORE UPDATE OF modified_since_sync ON kits",
    );

    const result = sampleService.moveSampleInKit(
      settings,
      "A0",
      1,
      0,
      1,
      2,
      "insert",
    );

    expect(result.success).toBe(false);
    expect(slots("A0", 1)).toEqual(["0:a.wav", "1:b.wav", "2:c.wav"]);
  });

  it("importing a kit in setup: no kit and no samples when a later step fails", () => {
    const setup = new LocalStoreSetupService();
    const target = path.join(work, "new-store");
    const setupDb = path.join(target, ".romperdb");
    expect(setup.createSetupDatabase(setupDb).success).toBe(true);
    wav(path.join(target, "A0", "1 KICK.wav"));
    wav(path.join(target, "A0", "2 SNARE.wav"), 330);
    // The kit's modified flag is written after the kit and its samples
    injectFault(
      setupDb,
      "no_clear",
      "BEFORE UPDATE OF modified_since_sync ON kits",
    );

    const result = setup.importSetupKit(setupDb, "A0");

    expect(result.success).toBe(false);
    expect(getKit(setupDb, "A0").data).toBeNull();
    expect(getKitSamples(setupDb, "A0").data).toEqual([]);
  });

  it("nested units of work: an inner failure undoes only itself", () => {
    const outer = withDbTransaction(dbDir, () => {
      newKit(dbDir, "B0");
      const inner = withDbTransaction(dbDir, () => {
        newKit(dbDir, "B1");
        throw new Error("inner step failed");
      });
      expect(inner).toEqual({ error: "inner step failed", success: false });
      return "done";
    });

    expect(outer).toEqual({ data: "done", success: true });
    expect(getKit(dbDir, "B0").data?.name).toBe("B0");
    expect(getKit(dbDir, "B1").data).toBeNull();
  });

  it("nested units of work: an outer failure undoes the inner work too", () => {
    const outer = withDbTransaction(dbDir, () => {
      expect(withDbTransaction(dbDir, () => newKit(dbDir, "B0")).success).toBe(
        true,
      );
      throw new Error("later step failed");
    });

    expect(outer.success).toBe(false);
    expect(getKit(dbDir, "B0").data).toBeNull();
  });
});
