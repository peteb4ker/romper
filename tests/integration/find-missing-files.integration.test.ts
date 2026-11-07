import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const probe = vi.hoisted(() => ({
  dialog: {
    answer: null as null | string,
    asked: [] as { defaultPath?: string; message: string; title: string }[],
  },
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
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
      { isDestroyed: () => false, webContents: { send: () => undefined } },
    ],
  },
  dialog: {
    showOpenDialog: (options: {
      defaultPath?: string;
      message: string;
      title: string;
    }) => {
      probe.dialog.asked.push(options);
      const answer = probe.dialog.answer;
      return Promise.resolve(
        answer === null
          ? { canceled: true, filePaths: [] }
          : { canceled: false, filePaths: [answer] },
      );
    },
  },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      probe.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => probe.handlers.delete(channel),
  },
  shell: { openExternal: () => undefined, showItemInFolder: () => undefined },
}));

import type {
  FindMissingFilesResult,
  RestoredMissingFile,
  RestoreMissingFileResult,
} from "../../shared/electronApi.js";

import {
  addKit,
  addSample,
  getKit,
  getKitSamples,
  markKitAsSynced,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { registerIpcHandlers } from "../../electron/main/ipcHandlers.js";
import { pathAccess } from "../../electron/main/security/pathAccess.js";
import { forgetMadeCopies } from "../../electron/main/services/missingFileRestore.js";
import {
  missingFileSearch,
  missingFileSearchSettings,
} from "../../electron/main/services/missingFileSearch.js";
import {
  storeCheckService,
  storeCheckSettings,
} from "../../electron/main/services/storeCheckService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #823, stage 6 of docs/developer/store-check.md: "Find missing files…"
// looks for a kit's missing files in the store's kit folders and one
// folder the user picks (D1), matches by name, size and header (D3), and
// copies a file back into the store or points the sample at it (D2),
// never over a file, undoably. Through the real IPC handlers.

type Result<T> = { data?: T; error?: string; success: boolean };

const DEFAULT_CHECK = { ...storeCheckSettings };
const DEFAULT_SEARCH = { ...missingFileSearchSettings };
const OFFLINE = "/Volumes/RomperDriveThatIsNotThere";
/** The sync fs calls main must never make here */
const SYNC_FS_CALLS = [
  "accessSync",
  "copyFileSync",
  "existsSync",
  "linkSync",
  "lstatSync",
  "mkdirSync",
  "openSync",
  "readdirSync",
  "readFileSync",
  "readSync",
  "realpathSync",
  "renameSync",
  "rmdirSync",
  "rmSync",
  "statSync",
  "unlinkSync",
  "writeFileSync",
] as const;

let work: string;
let store: string;
let dbDir: string;
let samples: string;

function addRow(kit: string, voice: number, slot: number, file: string) {
  expect(
    addSample(dbDir, {
      filename: path.basename(file),
      kit_name: kit,
      slot_number: slot,
      source_path: file,
      voice_number: voice,
    }).success,
  ).toBe(true);
}

/**
 * A0 is editable, with "1 tom.wav" and "1 hat.wav" in voice 1; B0 is
 * read-only (an imported kit), with "1 kick.wav" and "1 snare.wav". Each
 * kit's files are in its folder in the store. A0 also has "2 loop.wav"
 * from outside the store, as an added sample is.
 */
async function generateStore() {
  expect(createStoreDb(dbDir).success).toBe(true);
  for (const [kit, editable] of [
    ["A0", true],
    ["B0", false],
  ] as const) {
    expect(
      addKit(dbDir, {
        alias: null,
        bank_letter: kit[0],
        editable,
        locked: false,
        modified_since_sync: false,
        name: kit,
        step_pattern: null,
      }).success,
    ).toBe(true);
    const names = editable
      ? ["1 tom.wav", "1 hat.wav"]
      : ["1 kick.wav", "1 snare.wav"];
    for (const [slot, name] of names.entries()) {
      const file = path.join(store, kit, name);
      wav(file, 200 + slot + (editable ? 50 : 0));
      addRow(kit, 1, slot, file);
    }
  }
  const loop = path.join(work, "elsewhere", "2 loop.wav");
  wav(loop, 330);
  addRow("A0", 2, 0, loop);
  markKitAsSynced(dbDir, "A0");
  markKitAsSynced(dbDir, "B0");
  // Every row is checked once, so each has its size and header
  await passFinds([]);
}

async function invoke(channel: string, ...args: unknown[]) {
  const handler = probe.handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler({}, ...args);
}

/** A WAV file; `hz` and `seconds` change its bytes and size */
function wav(file: string, hz = 220, seconds = 0.05, sampleRate = 44100) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    encodeTestWav([sine(hz, seconds, sampleRate)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate,
    }),
  );
}

const pick = (kit: string) =>
  invoke("pick-search-folder", kit) as Promise<Result<null | string>>;
const find = (kit: string, folder: string) =>
  invoke("find-missing-files", kit, folder) as Promise<
    Result<FindMissingFilesResult>
  >;
const restore = (kit: string, sampleId: number, foundPath: string) =>
  invoke("restore-missing-file", kit, {
    foundPath,
    kind: "restore",
    sampleId,
  }) as Promise<Result<RestoreMissingFileResult>>;
const undo = (kit: string, restored: RestoredMissingFile) =>
  invoke("restore-missing-file", kit, { kind: "undo", restored }) as Promise<
    Result<RestoreMissingFileResult>
  >;

/** Pick `folder` in the dialog and search it */
async function search(kit: string, folder = samples) {
  probe.dialog.answer = folder;
  const picked = await pick(kit);
  expect(picked).toEqual({ data: folder, success: true });
  const found = await find(kit, folder);
  expect(found.success).toBe(true);
  return found.data!;
}

const rowOf = (kit: string, name: string) =>
  getKitSamples(dbDir, kit).data!.find((row) => row.filename === name)!;

const fileOf = (kit: string, name: string) => path.join(store, kit, name);

const kitsFound = () => storeCheckService.getStatus().kits;

/** Count the sync fs calls `run` makes */
async function countSyncFsCalls(run: () => Promise<unknown>) {
  const calls: string[] = [];
  const originals = SYNC_FS_CALLS.map((name) => [name, fs[name]] as const);
  for (const [name, original] of originals) {
    (fs as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
      calls.push(name);
      return (original as (...a: unknown[]) => unknown)(...args);
    };
  }
  syncBuiltinESMExports();
  try {
    await run();
  } finally {
    for (const [name, original] of originals) {
      (fs as unknown as Record<string, unknown>)[name] = original;
    }
    syncBuiltinESMExports();
  }
  return calls;
}

/** Move a file away and let a pass record it missing */
async function lose(kit: string, name: string, to: string, kits = [kit]) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(name.startsWith("/") ? name : fileOf(kit, name), to);
  storeCheckService.cancel();
  await passFinds(kits);
}

async function passFinds(kits: string[]) {
  await invoke("get-store-check-status");
  await vi.waitFor(
    () => expect(storeCheckService.getStatus().lastCompletedAt).not.toBeNull(),
    { timeout: 10_000 },
  );
  expect(kitsFound().map((kit) => kit.kitName)).toEqual(kits);
}

describe("[UC-05] find missing files and put them back (#823, stage 6)", () => {
  beforeEach(async () => {
    work = createTempStore("romper-find-missing-");
    store = path.join(work, "store");
    dbDir = path.join(store, ".romperdb");
    samples = path.join(work, "Samples");
    fs.mkdirSync(samples);
    probe.userData = path.join(work, "user-data");
    fs.mkdirSync(probe.userData);
    probe.dialog.answer = null;
    probe.dialog.asked.length = 0;
    pathAccess.reset();
    missingFileSearch.reset();
    forgetMadeCopies();
    probe.handlers.clear();
    const settings = { localStorePath: store };
    registerIpcHandlers(settings);
    registerDbIpcHandlers(settings);
    Object.assign(storeCheckSettings, DEFAULT_CHECK, {
      pollMs: 5,
      quietMs: 5,
      startupQuietMs: 5,
    });
    await generateStore();
  });

  afterEach(() => {
    storeCheckService.cancel();
    missingFileSearch.reset();
    Object.assign(storeCheckSettings, DEFAULT_CHECK);
    Object.assign(missingFileSearchSettings, DEFAULT_SEARCH);
    pathAccess.reset();
    removeTempStore(work);
  });

  it("finds a read-only kit's file moved to another folder, copies it back without changing the kit, and undo deletes only that copy", async () => {
    const moved = path.join(samples, "Drums", "1 kick.wav");
    await lose("B0", "1 kick.wav", moved);
    const bytes = fs.readFileSync(moved);

    const found = await search("B0");

    // The dialog asks for the file, and opens where it was (D1)
    expect(probe.dialog.asked).toEqual([
      expect.objectContaining({
        defaultPath: path.join(store, "B0"),
        message: "Choose a folder to search for 1 kick.wav",
      }),
    ]);
    const kick = rowOf("B0", "1 kick.wav");
    expect(found).toMatchObject({
      cancelled: false,
      files: [
        {
          fileName: "1 kick.wav",
          found: [{ match: true, path: moved, where: "Samples/Drums" }],
          inStore: true,
          sampleId: kick.id,
        },
      ],
      folderName: "Samples",
      incomplete: null,
    });

    const restored = await restore("B0", kick.id, moved);

    expect(restored.success).toBe(true);
    expect(restored.data?.restored).toMatchObject({
      kind: "copy",
      path: fileOf("B0", "1 kick.wav"),
    });
    expect(fs.readFileSync(fileOf("B0", "1 kick.wav"))).toEqual(bytes);
    // The found file stays where it is; no temporary file is left
    expect(fs.existsSync(moved)).toBe(true);
    expect(fs.readdirSync(path.join(store, "B0")).sort()).toEqual([
      "1 kick.wav",
      "1 snare.wav",
    ]);
    // The row is the same; only its check changed. A copy back isn't an edit
    expect(rowOf("B0", "1 kick.wav")).toMatchObject({
      id: kick.id,
      source_path: kick.source_path,
      source_status: "readable",
    });
    expect(getKit(dbDir, "B0").data?.modified_since_sync).toBe(false);
    // Main checks the kit again at once
    await vi.waitFor(() => expect(kitsFound()).toEqual([]));

    const undone = await undo("B0", restored.data!.restored!);

    expect(undone).toEqual({
      data: { changed: false, restored: null },
      success: true,
    });
    expect(fs.existsSync(fileOf("B0", "1 kick.wav"))).toBe(false);
    expect(fs.existsSync(moved)).toBe(true);
    expect(rowOf("B0", "1 kick.wav").source_status).toBe("missing");
    await vi.waitFor(() =>
      expect(kitsFound()).toEqual([
        expect.objectContaining({ kitName: "B0", missing: 1 }),
      ]),
    );

    // Redo copies it back again
    const redone = await restore("B0", kick.id, moved);
    expect(redone.success).toBe(true);
    expect(fs.readFileSync(fileOf("B0", "1 kick.wav"))).toEqual(bytes);
  });

  it("finds a file moved into another kit's folder in the store, its name's case aside", async () => {
    const into = path.join(store, "A0", "From B0", "1 KICK.WAV");
    await lose("B0", "1 kick.wav", into);

    const found = await search("B0");

    expect(found.files[0].found).toEqual([
      expect.objectContaining({
        match: true,
        path: into,
        where: "A0/From B0",
      }),
    ]);
  });

  it("lists several matches for the user to choose, and copies back the one chosen", async () => {
    const first = path.join(samples, "One", "1 kick.wav");
    const second = path.join(samples, "Two", "1 kick.wav");
    await lose("B0", "1 kick.wav", first);
    fs.mkdirSync(path.dirname(second), { recursive: true });
    fs.copyFileSync(first, second);

    const found = await search("B0");

    expect(found.files[0].found.map((f) => [f.path, f.match])).toEqual([
      [first, true],
      [second, true],
    ]);
    const kick = rowOf("B0", "1 kick.wav");
    expect((await restore("B0", kick.id, second)).success).toBe(true);
    expect(fs.existsSync(fileOf("B0", "1 kick.wav"))).toBe(true);
  });

  it("calls a file with the name but another size or header a possible match, and a match with the size and header (D3)", async () => {
    await lose("B0", "1 kick.wav", path.join(work, "gone", "1 kick.wav"));
    const longer = path.join(samples, "Longer", "1 kick.wav");
    const rate = path.join(samples, "Rate", "1 Kick.wav");
    wav(longer, 200, 0.2);
    // Same length in bytes, another sample rate
    wav(rate, 200, 0.05 * (44100 / 22050), 22050);
    const exact = path.join(samples, "Exact", "1 kick.wav");
    fs.mkdirSync(path.dirname(exact));
    fs.copyFileSync(path.join(work, "gone", "1 kick.wav"), exact);

    const found = await search("B0");

    expect(found.files[0].found.map((f) => [f.path, f.match])).toEqual([
      [exact, true],
      [longer, false],
      [rate, false],
    ]);
  });

  it("says nothing was found, and searches neither hidden folders, packages nor links", async () => {
    await lose("B0", "1 kick.wav", path.join(work, "gone", "1 kick.wav"));
    const original = path.join(work, "gone", "1 kick.wav");
    for (const hidden of [".hidden", "Kit.logicx"]) {
      fs.mkdirSync(path.join(samples, hidden));
      fs.copyFileSync(original, path.join(samples, hidden, "1 kick.wav"));
    }
    fs.symlinkSync(path.join(work, "gone"), path.join(samples, "link"));
    fs.symlinkSync(original, path.join(samples, "1 kick.wav"));

    const found = await search("B0");

    expect(found.files).toEqual([
      expect.objectContaining({ fileName: "1 kick.wav", found: [] }),
    ]);
  });

  it("points a sample from outside the store at the found file, without copying, and undo points it back (D2)", async () => {
    const old = path.join(work, "elsewhere", "2 loop.wav");
    const moved = path.join(samples, "Loops", "2 loop.wav");
    await lose("A0", old, moved);

    const found = await search("A0");

    const loop = rowOf("A0", "2 loop.wav");
    expect(found.files).toEqual([
      expect.objectContaining({ inStore: false, sampleId: loop.id }),
    ]);
    const restored = await restore("A0", loop.id, moved);

    expect(restored.data?.restored).toEqual({
      fileName: "2 loop.wav",
      from: old,
      kind: "repoint",
      sampleId: loop.id,
      to: moved,
    });
    expect(rowOf("A0", "2 loop.wav")).toMatchObject({
      source_path: moved,
      source_status: "readable",
    });
    expect(fs.existsSync(old)).toBe(false);
    expect(getKit(dbDir, "A0").data?.modified_since_sync).toBe(true);
    await vi.waitFor(() => expect(kitsFound()).toEqual([]));

    // Undo points it back only where it pointed before
    const elsewhere = { ...restored.data!.restored!, from: "/etc/hosts" };
    expect((await undo("A0", elsewhere)).success).toBe(false);
    expect(rowOf("A0", "2 loop.wav").source_path).toBe(moved);

    expect((await undo("A0", restored.data!.restored!)).success).toBe(true);
    expect(rowOf("A0", "2 loop.wav")).toMatchObject({
      source_path: old,
      source_status: "missing",
    });
    expect(fs.existsSync(moved)).toBe(true);
  });

  it("refuses to point a read-only kit's sample at a file outside the store: D5's exception is for removal only", async () => {
    const old = path.join(work, "elsewhere", "3 pad.wav");
    wav(old, 440);
    addRow("B0", 3, 0, old);
    const moved = path.join(samples, "3 pad.wav");
    await lose("B0", old, moved);
    await search("B0");
    const pad = rowOf("B0", "3 pad.wav");

    const restored = await restore("B0", pad.id, moved);

    expect(restored).toEqual({
      error: "Kit B0 isn't editable.",
      success: false,
    });
    expect(rowOf("B0", "3 pad.wav").source_path).toBe(old);
  });

  it("leaves a copy that changed since Romper made it, and says so", async () => {
    const moved = path.join(samples, "1 kick.wav");
    await lose("B0", "1 kick.wav", moved);
    await search("B0");
    const kick = rowOf("B0", "1 kick.wav");
    const restored = await restore("B0", kick.id, moved);
    fs.appendFileSync(fileOf("B0", "1 kick.wav"), Buffer.from([0, 0]));

    const undone = await undo("B0", restored.data!.restored!);

    expect(undone).toEqual({
      data: { changed: true, restored: null },
      success: true,
    });
    expect(fs.existsSync(fileOf("B0", "1 kick.wav"))).toBe(true);
    // Nor will a later undo delete it
    expect((await undo("B0", restored.data!.restored!)).success).toBe(false);
    expect(fs.existsSync(fileOf("B0", "1 kick.wav"))).toBe(true);
  });

  it("never overwrites: a file back at the old place since the search is left alone", async () => {
    const moved = path.join(samples, "1 kick.wav");
    await lose("B0", "1 kick.wav", moved);
    await search("B0");
    const kick = rowOf("B0", "1 kick.wav");
    wav(fileOf("B0", "1 kick.wav"), 999);
    const there = fs.readFileSync(fileOf("B0", "1 kick.wav"));

    const restored = await restore("B0", kick.id, moved);

    expect(restored.success).toBe(false);
    expect(fs.readFileSync(fileOf("B0", "1 kick.wav"))).toEqual(there);
  });

  it("never overwrites a file that appears at the old place while the copy is made", async () => {
    const moved = path.join(samples, "1 kick.wav");
    await lose("B0", "1 kick.wav", moved);
    await search("B0");
    const kick = rowOf("B0", "1 kick.wav");
    const target = fileOf("B0", "1 kick.wav");
    const realCopy = fs.promises.copyFile;
    const copy = vi
      .spyOn(fs.promises, "copyFile")
      .mockImplementation(async (from, to, mode) => {
        await realCopy(from, to, mode);
        // Someone puts a file there between the check and the link
        if (!fs.existsSync(target)) fs.writeFileSync(target, "theirs");
      });
    try {
      const restored = await restore("B0", kick.id, moved);

      expect(restored).toEqual({
        error: `A file is already at ${target}`,
        success: false,
      });
      expect(fs.readFileSync(target, "utf8")).toBe("theirs");
      // The temporary copy is gone
      expect(fs.readdirSync(path.join(store, "B0")).sort()).toEqual([
        "1 kick.wav",
        "1 snare.wav",
      ]);
    } finally {
      copy.mockRestore();
    }
  });

  it("copies in place, still never over a file, where the drive has no links", async () => {
    const moved = path.join(samples, "1 kick.wav");
    await lose("B0", "1 kick.wav", moved);
    await search("B0");
    const kick = rowOf("B0", "1 kick.wav");
    const target = fileOf("B0", "1 kick.wav");
    const link = vi.spyOn(fs.promises, "link").mockRejectedValue(
      Object.assign(new Error("EPERM: operation not permitted"), {
        code: "EPERM",
      }),
    );
    try {
      const restored = await restore("B0", kick.id, moved);
      expect(restored.success).toBe(true);
      expect(fs.readFileSync(target)).toEqual(fs.readFileSync(moved));

      // Undo, then a file appears before the copy: it is left alone
      expect((await undo("B0", restored.data!.restored!)).success).toBe(true);
      const realCopy = fs.promises.copyFile;
      const copy = vi
        .spyOn(fs.promises, "copyFile")
        .mockImplementation(async (from, to, mode) => {
          if (to === target) fs.writeFileSync(target, "theirs");
          await realCopy(from, to, mode);
        });
      try {
        expect((await restore("B0", kick.id, moved)).error).toBe(
          `A file is already at ${target}`,
        );
        expect(fs.readFileSync(target, "utf8")).toBe("theirs");
      } finally {
        copy.mockRestore();
      }
    } finally {
      link.mockRestore();
    }
  });

  it("puts back the kit's folder when it went with the file, and undo takes away only what it made", async () => {
    const away = path.join(work, "B0 moved");
    fs.renameSync(path.join(store, "B0"), away);
    storeCheckService.cancel();
    await passFinds(["B0"]);
    await search("B0", away);
    const kick = rowOf("B0", "1 kick.wav");

    const restored = await restore(
      "B0",
      kick.id,
      path.join(away, "1 kick.wav"),
    );

    expect(restored.success).toBe(true);
    expect(fs.readdirSync(path.join(store, "B0"))).toEqual(["1 kick.wav"]);
    expect((await undo("B0", restored.data!.restored!)).success).toBe(true);
    expect(fs.existsSync(path.join(store, "B0"))).toBe(false);
    expect(fs.existsSync(store)).toBe(true);
  });

  it("[Q-03] searches only a folder the user picked, and puts back only a file the search offered", async () => {
    const moved = path.join(samples, "1 kick.wav");
    await lose("B0", "1 kick.wav", moved);
    const kick = rowOf("B0", "1 kick.wav");

    expect((await find("B0", samples)).success).toBe(false);
    expect((await restore("B0", kick.id, moved)).success).toBe(false);
    // Cancelling the dialog gives no folder
    expect(await pick("B0")).toEqual({ data: null, success: true });

    await search("B0");
    const other = path.join(work, "other.wav");
    wav(other);
    expect((await restore("B0", kick.id, other)).error).toContain(
      "Access denied",
    );
  });

  it("never searches for a file on a drive that isn't connected (D6)", async () => {
    addRow("A0", 3, 0, `${OFFLINE}/away.wav`);
    await lose("A0", "1 tom.wav", path.join(samples, "1 tom.wav"));

    const found = await search("A0");

    expect(found.files.map((f) => f.fileName)).toEqual(["1 tom.wav"]);
  });

  it("asks for several files at once", async () => {
    await lose("B0", "1 kick.wav", path.join(samples, "1 kick.wav"));
    await lose("B0", "1 snare.wav", path.join(samples, "1 snare.wav"));

    await search("B0");

    expect(probe.dialog.asked[0].message).toBe(
      "Choose a folder to search for 2 missing files",
    );
  });

  it("stops at its limit and says so", async () => {
    await lose("B0", "1 kick.wav", path.join(samples, "z", "1 kick.wav"));
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(samples, `a${i}.txt`), "");
    }
    missingFileSearchSettings.maxEntries = 3;

    const found = await search("B0");

    expect(found.incomplete).toBe("limit");
  });

  it("can be cancelled, and a drive that doesn't answer doesn't hold it up", async () => {
    await lose("B0", "1 kick.wav", path.join(samples, "1 kick.wav"));
    probe.dialog.answer = samples;
    await pick("B0");
    const realReaddir = fs.promises.readdir;
    const hung = vi
      .spyOn(fs.promises, "readdir")
      .mockImplementation(((folder: string, ...rest: unknown[]) =>
        folder === samples
          ? new Promise(() => undefined)
          : (realReaddir as (...a: unknown[]) => unknown)(
              folder,
              ...rest,
            )) as typeof fs.promises.readdir);
    try {
      const running = find("B0", samples);
      await vi.waitFor(() =>
        expect(hung.mock.calls.some(([f]) => f === samples)).toBe(true),
      );
      await invoke("cancel-find-missing-files");
      storeCheckSettings.operationTimeoutMs = 50;
      expect((await running).data).toMatchObject({ cancelled: true });

      const timedOut = await find("B0", samples);
      expect(timedOut.data).toMatchObject({
        cancelled: false,
        incomplete: "notResponding",
      });
    } finally {
      hung.mockRestore();
    }
  });

  it("[Q-01] makes no sync fs call to search, copy back or undo", async () => {
    const moved = path.join(samples, "Deep", "1 kick.wav");
    await lose("B0", "1 kick.wav", moved);
    const kick = rowOf("B0", "1 kick.wav");
    probe.dialog.answer = samples;

    const calls = await countSyncFsCalls(async () => {
      await pick("B0");
      await find("B0", samples);
      const restored = await restore("B0", kick.id, moved);
      await undo("B0", restored.data!.restored!);
    });

    expect(calls).toEqual([]);
  });

  it("refuses bad arguments", async () => {
    expect(((await pick("")) as Result<null>).success).toBe(false);
    expect((await find("B0", "")).success).toBe(false);
    for (const request of [null, {}, { kind: "restore", sampleId: "1" }]) {
      expect(
        ((await invoke("restore-missing-file", "B0", request)) as Result<null>)
          .success,
      ).toBe(false);
    }
  });
});
