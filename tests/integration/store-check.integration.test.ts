import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const probe = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  pushes: [] as { channel: string; payload: unknown }[],
  /** Where main keeps its settings file */
  userData: "",
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => probe.userData,
    getVersion: () => "0.0.0-test",
    isPackaged: false,
    quit: () => undefined,
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {
          send: (channel: string, payload: unknown) =>
            probe.pushes.push({ channel, payload }),
        },
      },
    ],
  },
  dialog: { showOpenDialog: () => Promise.resolve({ canceled: true }) },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      probe.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => probe.handlers.delete(channel),
  },
  shell: { openExternal: () => undefined, showItemInFolder: () => undefined },
}));

import {
  addKit,
  addSample,
  getKitSamples,
  updateSampleMetadata,
  updateSampleSourceStatusTx,
  withDbTransaction,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { ipcActivity } from "../../electron/main/ipcActivity.js";
import { registerIpcHandlers } from "../../electron/main/ipcHandlers.js";
import { pathAccess } from "../../electron/main/security/pathAccess.js";
import {
  checkSampleFile,
  scanService,
} from "../../electron/main/services/scanService.js";
import {
  storeCheckService,
  storeCheckSettings,
} from "../../electron/main/services/storeCheckService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #812: a sample file deleted or broken on disk was only noticed when its
// kit opened (#537). Main now checks every kit's sample rows against their
// files in the background, a kit at a time, once the kit grid has loaded
// (stage 1 of docs/developer/store-check.md).

type Finding = {
  folderMissing: boolean;
  kitName: string;
  missing: number;
  notConnected: { samples: number; volume: string }[];
  notResponding: string[];
  quarantined: boolean;
  unavailableVolumes: string[];
  unreadable: number;
  untracked: string[];
};

/** A finding with nothing in it, to spread the one thing a test expects */
const CLEAN: Finding = {
  folderMissing: false,
  kitName: "",
  missing: 0,
  notConnected: [],
  notResponding: [],
  quarantined: false,
  unavailableVolumes: [],
  unreadable: 0,
  untracked: [],
};

type Status = {
  data: {
    kits: Finding[];
    lastCompletedAt: null | number;
    state: string;
  };
  success: boolean;
};

const KITS = ["A0", "A1", "B0"];
/** Imported kits are read-only; A0 is a kit made in Romper */
const READ_ONLY = new Set(["A1", "B0"]);
const DEFAULT_SETTINGS = { ...storeCheckSettings };

let work: string;
let store: string;
let dbDir: string;

/** Three kits (A0, A1, B0) of two files each, never checked; A1 and B0 are read-only */
function generateStore() {
  expect(createStoreDb(dbDir).success).toBe(true);
  for (const kit of KITS) {
    expect(
      addKit(dbDir, {
        alias: null,
        bank_letter: kit[0],
        editable: !READ_ONLY.has(kit),
        locked: false,
        modified_since_sync: false,
        name: kit,
        step_pattern: null,
      }).success,
    ).toBe(true);
    for (const slot of [0, 1]) {
      const filename = `1 ${slot}.wav`;
      const file = path.join(store, kit, filename);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, goodWav());
      expect(
        addSample(dbDir, {
          filename,
          kit_name: kit,
          slot_number: slot,
          source_path: file,
          voice_number: 1,
        }).success,
      ).toBe(true);
    }
  }
}

function goodWav() {
  return encodeTestWav([sine(220, 0.05, 44100)], {
    bitDepth: 16,
    encoding: "pcm",
    sampleRate: 44100,
  });
}

async function invoke(channel: string, ...args: unknown[]) {
  const handler = probe.handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler({}, ...args);
}

const fileOf = (kit: string, slot = 0) =>
  path.join(store, kit, `1 ${slot}.wav`);

const rowOf = (kit: string, slot = 0) =>
  getKitSamples(dbDir, kit).data!.find((s) => s.slot_number === slot)!;

const quarantinedKits = async () =>
  (
    (await invoke("get-all-kits")) as {
      data: { name: string; quarantined: boolean }[];
    }
  ).data
    .filter((kit) => kit.quarantined)
    .map((kit) => kit.name);

/** The kit grid has loaded: ask for the status, which starts the pass */
async function gridLoaded() {
  return (await invoke("get-store-check-status")) as Status;
}

async function untilPassEnds() {
  await vi.waitFor(
    () => expect(storeCheckService.getStatus().lastCompletedAt).not.toBeNull(),
    { timeout: 10_000 },
  );
}

const allPushes = () =>
  probe.pushes
    .filter((push) => push.channel === "store-check-updated")
    .map((push) => push.payload as Status["data"]);

/** The pushes that carry a kit's finding */
const updates = () => allPushes().filter((push) => push.kits.length > 0);

/** The pushes that only say a pass is over (#824) */
const endings = () => allPushes().filter((push) => push.kits.length === 0);

describe("[UC-05] [Q-01] the store check finds missing and unreadable sample files in the background (#812)", () => {
  beforeEach(() => {
    work = createTempStore("romper-store-check-");
    store = path.join(work, "store");
    dbDir = path.join(store, ".romperdb");
    probe.userData = path.join(work, "user-data");
    fs.mkdirSync(probe.userData);
    generateStore();
    pathAccess.reset();
    probe.handlers.clear();
    probe.pushes.length = 0;
    const settings = { localStorePath: store };
    registerIpcHandlers(settings);
    registerDbIpcHandlers(settings);
    Object.assign(storeCheckSettings, DEFAULT_SETTINGS, {
      pollMs: 5,
      quietMs: 5,
      startupQuietMs: 5,
    });
  });

  afterEach(() => {
    storeCheckService.cancel();
    Object.assign(storeCheckSettings, DEFAULT_SETTINGS);
    pathAccess.reset();
    removeTempStore(work);
  });

  it("marks a kit quarantined when a file can't be read, and a deleted file's row missing, without opening either kit", async () => {
    fs.writeFileSync(fileOf("A1"), "not a wav file");
    fs.rmSync(fileOf("B0", 1));
    // Before the pass nothing is known and no kit is quarantined
    expect(rowOf("A1").source_status).toBeNull();
    expect(await quarantinedKits()).toEqual([]);

    await gridLoaded();
    await untilPassEnds();

    expect(rowOf("A1").source_status).toBe("unreadable");
    expect(rowOf("B0", 1).source_status).toBe("missing");
    // An unreadable file quarantines its kit; a missing one doesn't
    expect(await quarantinedKits()).toEqual(["A1"]);
    // Every other file was read once and recorded as readable
    expect(rowOf("A0").source_status).toBe("readable");
    expect(rowOf("A0").wav_channels).toBe(1);
    expect(rowOf("B0").source_status).toBe("readable");
  });

  it("pushes only the kits whose finding changed, and reports them in the status", async () => {
    fs.writeFileSync(fileOf("A1"), "not a wav file");
    fs.rmSync(fileOf("B0", 1));

    await gridLoaded();
    await untilPassEnds();

    // A0 went from never checked to readable: no finding changed, no push
    expect(updates().flatMap((u) => u.kits)).toEqual([
      { ...CLEAN, kitName: "A1", quarantined: true, unreadable: 1 },
      { ...CLEAN, kitName: "B0", missing: 1 },
    ]);
    const status = (await gridLoaded()).data;
    expect(status.state).toBe("idle");
    expect(status.kits.map((kit) => kit.kitName)).toEqual(["A1", "B0"]);
  });

  it("is silent when every file is fine, and a pass already run isn't started again", async () => {
    await gridLoaded();
    await untilPassEnds();
    expect(updates()).toEqual([]);
    // The renderer is told only that the pass is over, so it can say what
    // it found (it found nothing)
    expect(endings()).toEqual([{ kits: [], state: "idle" }]);
    expect((await gridLoaded()).data.kits).toEqual([]);

    // The grid loading again (a reloaded renderer) doesn't check again
    fs.rmSync(fileOf("A0"));
    await gridLoaded();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(rowOf("A0").source_status).toBe("readable");
  });

  it("sends a kit that's clean again with zero counts", async () => {
    fs.writeFileSync(fileOf("A1"), "not a wav file");
    await gridLoaded();
    await untilPassEnds();
    expect(updates()).toHaveLength(1);

    // The file is put back and the store's check starts again (as after a
    // store change)
    fs.writeFileSync(fileOf("A1"), goodWav());
    storeCheckService.cancel();
    await gridLoaded();
    await untilPassEnds();

    expect(updates().at(-1)).toMatchObject({
      kits: [{ ...CLEAN, kitName: "A1" }],
    });
    expect(await quarantinedKits()).toEqual([]);
  });

  it("tells the renderer of a missing file the database already held from an earlier session (#824)", async () => {
    // Recorded missing last time; the renderer asked for the status before
    // this pass reached the kit, so it hasn't heard of it
    fs.rmSync(fileOf("B0", 1));
    const row = rowOf("B0", 1);
    withDbTransaction(dbDir, (db) =>
      updateSampleSourceStatusTx(
        db,
        row.id,
        { source_status: "missing" },
        row.source_path,
      ),
    );

    expect((await gridLoaded()).data.kits).toEqual([]);
    await untilPassEnds();

    expect(updates().flatMap((u) => u.kits)).toEqual([
      { ...CLEAN, kitName: "B0", missing: 1 },
    ]);
  });

  it("reports a file on a drive that isn't connected as the drive, not as a missing file (D6, #824)", async () => {
    const volume = "/Volumes/RomperDriveThatIsNotThere";
    expect(
      addSample(dbDir, {
        filename: "away.wav",
        kit_name: "A0",
        slot_number: 2,
        source_path: `${volume}/away.wav`,
        voice_number: 1,
      }).success,
    ).toBe(true);
    fs.rmSync(fileOf("A0", 1));

    await gridLoaded();
    await untilPassEnds();

    expect((await gridLoaded()).data.kits).toEqual([
      {
        ...CLEAN,
        kitName: "A0",
        missing: 1,
        notConnected: [{ samples: 1, volume }],
      },
    ]);
    // The row reads missing, as the kit editor labels it
    expect(rowOf("A0", 2).source_status).toBe("missing");
  });

  it("makes no sync fs call and opens no connection", async () => {
    const calls: string[] = [];
    const names = [
      "existsSync",
      "lstatSync",
      "openSync",
      "readdirSync",
      "readFileSync",
      "readSync",
      "realpathSync",
      "statSync",
    ] as const;
    // Warm the connection and the lazily loaded modules first
    await invoke("get-all-kits");
    const originals = names.map((name) => [name, fs[name]] as const);
    for (const [name, original] of originals) {
      (fs as unknown as Record<string, unknown>)[name] = (
        ...args: unknown[]
      ) => {
        calls.push(name);
        return (original as (...a: unknown[]) => unknown)(...args);
      };
    }
    try {
      await gridLoaded();
      await untilPassEnds();
    } finally {
      for (const [name, original] of originals) {
        (fs as unknown as Record<string, unknown>)[name] = original;
      }
    }
    expect(calls).toEqual([]);
  });

  describe("[UC-05] kit folders (#820, stage 2)", () => {
    const folderOf = (kit: string) => path.join(store, kit);
    const statusKits = async () => {
      await gridLoaded();
      await untilPassEnds();
      return (await gridLoaded()).data.kits;
    };
    /** The folders the pass listed, by kit name */
    const listFolders = () => {
      const listed: string[] = [];
      const realReaddir = fs.promises.readdir.bind(fs.promises);
      const spy = vi.spyOn(fs.promises, "readdir").mockImplementation(((
        p: string,
        ...rest: unknown[]
      ) => {
        listed.push(path.relative(store, p));
        return realReaddir(p, ...(rest as []));
      }) as typeof fs.promises.readdir);
      return { listed, restore: () => spy.mockRestore() };
    };

    it("finds a WAV dropped into a read-only kit's folder outside Romper, and pushes it", async () => {
      fs.writeFileSync(path.join(folderOf("A1"), "2 dropped.wav"), goodWav());

      expect(await statusKits()).toEqual([
        { ...CLEAN, kitName: "A1", untracked: ["2 dropped.wav"] },
      ]);
      expect(updates().flatMap((u) => u.kits)).toEqual([
        { ...CLEAN, kitName: "A1", untracked: ["2 dropped.wav"] },
      ]);
    });

    it("ignores macOS AppleDouble files, hidden files and files that aren't voice-prefixed WAVs", async () => {
      const folder = folderOf("A1");
      fs.writeFileSync(path.join(folder, "._2 dropped.wav"), "AppleDouble");
      fs.writeFileSync(path.join(folder, ".DS_Store"), "x");
      fs.writeFileSync(path.join(folder, "notes.txt"), "x");
      fs.writeFileSync(path.join(folder, "kick.wav"), goodWav());

      expect(await statusKits()).toEqual([]);
      expect(updates()).toEqual([]);
    });

    it("doesn't report an editable kit's extra file", async () => {
      fs.writeFileSync(path.join(folderOf("A0"), "2 extra.wav"), goodWav());

      expect(await statusKits()).toEqual([]);
    });

    it("finds a read-only kit whose folder was deleted, with its samples missing", async () => {
      fs.rmSync(folderOf("B0"), { force: true, recursive: true });

      expect(await statusKits()).toEqual([
        { ...CLEAN, folderMissing: true, kitName: "B0", missing: 2 },
      ]);
    });

    it("doesn't report a deleted imported kit's leftover folder, and lists only read-only kits' folders", async () => {
      // The kit was deleted in Romper (database only); its folder stays
      fs.mkdirSync(folderOf("A5"));
      fs.writeFileSync(path.join(folderOf("A5"), "1 left.wav"), goodWav());
      const { listed, restore } = listFolders();
      try {
        expect(await statusKits()).toEqual([]);
      } finally {
        restore();
      }

      expect(listed.sort()).toEqual(["A1", "B0"]);
    });

    it("drops a finding once the file is gone, when the store is checked again", async () => {
      const dropped = path.join(folderOf("A1"), "2 dropped.wav");
      fs.writeFileSync(dropped, goodWav());
      expect(await statusKits()).toHaveLength(1);

      fs.rmSync(dropped);
      // As after a store change: a new pass over the same folders
      storeCheckService.cancel();
      expect(await statusKits()).toEqual([]);
    });
  });

  describe("scheduling", () => {
    it("a stat that never resolves times out without stalling the event loop or other fs work, and its volume is skipped", async () => {
      storeCheckSettings.operationTimeoutMs = 100;
      const hung = fileOf("A1");
      const realStat = fs.promises.stat.bind(fs.promises);
      const spy = vi
        .spyOn(fs.promises, "stat")
        .mockImplementation(((p: string, ...rest: unknown[]) =>
          p === hung
            ? new Promise(() => undefined)
            : realStat(p, ...(rest as []))) as typeof fs.promises.stat);
      try {
        let turns = 0;
        let waiting = true;
        const tick = () => {
          if (!waiting) return;
          turns++;
          setImmediate(tick);
        };
        setImmediate(tick);

        await gridLoaded();
        // Other fs work still answers while the pass waits on the hung stat
        const other = await fs.promises.readFile(fileOf("A0"));
        expect(other.length).toBeGreaterThan(0);
        await untilPassEnds();
        waiting = false;

        expect(turns).toBeGreaterThan(1);
        // Checked before the hung file
        expect(rowOf("A0").source_status).toBe("readable");
        // The hung file's row is untouched, and so is everything after it
        // on the same volume
        expect(rowOf("A1").source_status).toBeNull();
        expect(rowOf("A1", 1).source_status).toBeNull();
        expect(rowOf("B0").source_status).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it("waits while a write is in flight, and drops what it found if one started meanwhile", async () => {
      fs.rmSync(fileOf("A0"));
      let finishWrite!: () => void;
      const write = ipcActivity.track(
        "startKitSync",
        () =>
          new Promise<void>((resolve) => {
            finishWrite = resolve;
          }),
      );

      await gridLoaded();
      await vi.waitFor(() =>
        expect(storeCheckService.getStatus().state).toBe("paused"),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Nothing is checked while the write runs
      expect(rowOf("A0").source_status).toBeNull();
      expect(storeCheckService.getStatus().state).toBe("paused");

      finishWrite();
      await write;
      await untilPassEnds();
      expect(rowOf("A0").source_status).toBe("missing");
    });

    it("drops what a step found if a write started while it checked", async () => {
      const gone = fileOf("A0");
      fs.rmSync(gone);
      let finishWrite!: () => void;
      let write: Promise<void> | undefined;
      const realStat = fs.promises.stat.bind(fs.promises);
      const spy = vi.spyOn(fs.promises, "stat").mockImplementation(((
        p: string,
        ...rest: unknown[]
      ) => {
        // The write starts while the pass is checking A0's first file
        if (p === gone && !write) {
          write = ipcActivity.track(
            "startKitSync",
            () =>
              new Promise<void>((resolve) => {
                finishWrite = resolve;
              }),
          );
        }
        return realStat(p, ...(rest as []));
      }) as typeof fs.promises.stat);
      try {
        await gridLoaded();
        await vi.waitFor(() => expect(write).toBeDefined());
        await new Promise((resolve) => setTimeout(resolve, 50));
        // The file was found missing, but the write began meanwhile: not
        // recorded
        expect(rowOf("A0").source_status).toBeNull();

        finishWrite();
        await write;
        await untilPassEnds();
      } finally {
        spy.mockRestore();
      }
      // Checked again after the write
      expect(rowOf("A0").source_status).toBe("missing");
    });

    it("a store change cancels the pass: nothing more is recorded", async () => {
      fs.rmSync(fileOf("A0"));
      let finishWrite!: () => void;
      const write = ipcActivity.track(
        "startKitSync",
        () =>
          new Promise<void>((resolve) => {
            finishWrite = resolve;
          }),
      );
      await gridLoaded();
      await vi.waitFor(() =>
        expect(storeCheckService.getStatus().state).toBe("paused"),
      );

      const other = path.join(work, "other-store");
      fs.mkdirSync(other);
      pathAccess.grantRoot(other);
      await invoke("write-settings", "localStorePath", other);
      finishWrite();
      await write;
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(rowOf("A0").source_status).toBeNull();
      expect(storeCheckService.getStatus()).toEqual({
        kits: [],
        lastCompletedAt: null,
        state: "idle",
      });
    });

    it("leaves the kit open in the editor to its own check", async () => {
      fs.rmSync(fileOf("A1"));
      fs.rmSync(fileOf("B0"));
      await invoke("check-kit-sample-files", "A1");
      // The kit-open check recorded A1; put it back so only the pass could
      // change it
      withDbTransaction(dbDir, (db) =>
        updateSampleSourceStatusTx(db, rowOf("A1").id, {
          source_status: null,
        }),
      );

      await gridLoaded();
      await untilPassEnds();

      expect(rowOf("A1").source_status).toBeNull();
      expect(rowOf("B0").source_status).toBe("missing");
    });
  });

  describe("recording", () => {
    it("[Q-01] the update matches the file that was checked as well as the row", () => {
      const row = rowOf("A0");
      const update = (checkedPath: string) =>
        withDbTransaction(dbDir, (db) =>
          updateSampleSourceStatusTx(
            db,
            row.id,
            { source_status: "missing" },
            checkedPath,
          ),
        ).data;

      expect(update(path.join(store, "A0", "another.wav"))).toBe(false);
      expect(rowOf("A0").source_status).toBeNull();
      expect(update(row.source_path)).toBe(true);
      expect(rowOf("A0").source_status).toBe("missing");
    });

    it("[Q-01] the kit-open check can't put a result on a row an edit pointed at another file meanwhile", async () => {
      const row = rowOf("A0");
      const checked = row.source_path;
      const edited = path.join(store, "A0", "edited.wav");
      fs.writeFileSync(edited, goodWav());
      // The stat of the old path is still pending when the edit lands
      let answer!: () => void;
      const realStat = fs.promises.stat.bind(fs.promises);
      const spy = vi.spyOn(fs.promises, "stat").mockImplementation(((
        p: string,
        ...rest: unknown[]
      ) =>
        p === checked
          ? new Promise((_, reject) => {
              answer = () =>
                reject(Object.assign(new Error("gone"), { code: "ENOENT" }));
            })
          : realStat(p, ...(rest as []))) as typeof fs.promises.stat);
      try {
        const check = scanService.checkKitSampleFiles(
          { localStorePath: store },
          "A0",
        );
        await vi.waitFor(() => expect(answer).toBeDefined());
        expect(
          updateSampleMetadata(dbDir, row.id, { source_path: edited }).success,
        ).toBe(true);
        answer();
        await check;
      } finally {
        spy.mockRestore();
      }

      // The old file's "missing" didn't land on the row that now points at
      // another file
      expect(rowOf("A0").source_path).toBe(edited);
      expect(rowOf("A0").source_status).toBeNull();
    });
  });

  describe("checkSampleFile's time limit", () => {
    it("[Q-01] limits the stat and the header read, and a limit that gives up isn't a missing file", async () => {
      const limited: string[] = [];
      const limit = <T>(operation: Promise<T>) => {
        limited.push("operation");
        return operation;
      };

      // Never read: the stat and the header read both go through the limit
      await checkSampleFile(rowOf("A0"), limit);
      expect(limited).toHaveLength(2);
      // Gone: only the stat
      fs.rmSync(fileOf("A1"));
      limited.length = 0;
      const gone = await checkSampleFile(rowOf("A1"), limit);
      expect(limited).toHaveLength(1);
      expect(gone.fields).toEqual({ source_status: "missing" });

      // A stat that never finishes: the limit rejects, which isn't "missing"
      const giveUp = () => Promise.reject(new Error("gave up"));
      await expect(checkSampleFile(rowOf("B0"), giveUp)).rejects.toThrow(
        "gave up",
      );
    });
  });
});
