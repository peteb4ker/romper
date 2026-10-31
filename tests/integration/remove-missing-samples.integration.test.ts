import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const probe = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  pushes: [] as { channel: string; payload: unknown }[],
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

import type { VoiceSnapshot } from "../../shared/undoTypes.js";

import {
  addKit,
  addSample,
  getKit,
  getKitSamples,
  markKitAsSynced,
  updateSampleSourceStatusTx,
  withDbTransaction,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { registerIpcHandlers } from "../../electron/main/ipcHandlers.js";
import { pathAccess } from "../../electron/main/security/pathAccess.js";
import {
  storeCheckService,
  storeCheckSettings,
} from "../../electron/main/services/storeCheckService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #822, stage 5 of docs/developer/store-check.md: "Remove missing samples"
// removes a kit's rows whose files are gone, in one undoable step, read-only
// kits included (D5), and never a row whose file is on a drive that isn't
// connected (D6). Through the real IPC handlers.

type Removed = {
  data?: { samples: number; voicesBefore: VoiceSnapshot[] };
  error?: string;
  success: boolean;
};

const DEFAULT_SETTINGS = { ...storeCheckSettings };
const OFFLINE = "/Volumes/RomperDriveThatIsNotThere";

let work: string;
let store: string;
let dbDir: string;

/**
 * A0 is editable; B0 is read-only, as an imported kit is: voice 1 has
 * kick, snare and hat in slots 1-3, voice 2 has a clap. Every file is there.
 */
function generateStore() {
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
    const files: [number, number, string][] = [
      [1, 0, "1 kick.wav"],
      [1, 1, "1 snare.wav"],
      [1, 2, "1 hat.wav"],
      [2, 0, "2 clap.wav"],
    ];
    for (const [voice, slot, filename] of files) {
      const file = path.join(store, kit, filename);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, goodWav());
      expect(
        addSample(dbDir, {
          filename,
          gain_db: slot === 2 ? -3 : 0,
          kit_name: kit,
          slot_number: slot,
          source_path: file,
          voice_number: voice,
        }).success,
      ).toBe(true);
    }
    markKitAsSynced(dbDir, kit);
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

const remove = (kit: string, undo?: VoiceSnapshot[]) =>
  invoke("remove-missing-samples", kit, undo) as Promise<Removed>;

/** The kit's rows as the user sees them: voice, slot, file, gain, status */
const rowsOf = (kit: string) =>
  getKitSamples(dbDir, kit)
    .data!.map((row) => ({
      filename: row.filename,
      gain_db: row.gain_db,
      slot: row.slot_number,
      source_path: row.source_path,
      source_status: row.source_status,
      voice: row.voice_number,
      wav_channels: row.wav_channels,
      wav_sample_rate: row.wav_sample_rate,
    }))
    .sort((a, b) => a.voice - b.voice || a.slot - b.slot);

const fileOf = (kit: string, name: string) => path.join(store, kit, name);

const kitsFound = () => storeCheckService.getStatus().kits;

const modified = (kit: string) =>
  getKit(dbDir, kit).data?.modified_since_sync ?? null;

async function passFinds(kits: string[]) {
  await invoke("get-store-check-status");
  await vi.waitFor(
    () => expect(storeCheckService.getStatus().lastCompletedAt).not.toBeNull(),
    { timeout: 10_000 },
  );
  expect(kitsFound().map((kit) => kit.kitName)).toEqual(kits);
}

describe("[UC-05] remove missing samples (#822, stage 5)", () => {
  beforeEach(() => {
    work = createTempStore("romper-remove-missing-");
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

  it("removes a read-only kit's missing samples in one step, closes the gaps and flags the kit modified, and the kit is checked again at once (D5)", async () => {
    fs.rmSync(fileOf("B0", "1 kick.wav"));
    fs.rmSync(fileOf("B0", "2 clap.wav"));
    await passFinds(["B0"]);
    expect(kitsFound()[0].missing).toBe(2);
    const before = rowsOf("B0");

    const removed = await remove("B0");

    expect(removed.success).toBe(true);
    expect(removed.data?.samples).toBe(2);
    expect(rowsOf("B0")).toEqual([
      { ...before[1], slot: 0 },
      { ...before[2], slot: 1 },
    ]);
    expect(modified("B0")).toBe(true);
    // Its files weren't touched
    expect(fs.existsSync(fileOf("B0", "1 snare.wav"))).toBe(true);
    // Main checks the kit again: no new pass, and the kit is clean
    await vi.waitFor(() => expect(kitsFound()).toEqual([]));
  });

  it("removes only the rows still missing when it runs: a file put back since the check stays", async () => {
    fs.renameSync(fileOf("B0", "1 kick.wav"), path.join(work, "kick.wav"));
    fs.rmSync(fileOf("B0", "1 hat.wav"));
    await passFinds(["B0"]);
    expect(kitsFound()[0].missing).toBe(2);
    // The kick comes back after the check and before the removal
    fs.renameSync(path.join(work, "kick.wav"), fileOf("B0", "1 kick.wav"));

    const removed = await remove("B0");

    expect(removed.data?.samples).toBe(1);
    expect(rowsOf("B0").map((row) => row.filename)).toEqual([
      "1 kick.wav",
      "1 snare.wav",
      "2 clap.wav",
    ]);
  });

  it("never removes a row whose file is on a drive that isn't connected (D6)", async () => {
    expect(
      addSample(dbDir, {
        filename: "away.wav",
        kit_name: "A0",
        slot_number: 1,
        source_path: `${OFFLINE}/away.wav`,
        voice_number: 2,
      }).success,
    ).toBe(true);
    fs.rmSync(fileOf("A0", "1 snare.wav"));
    await passFinds(["A0"]);
    expect(kitsFound()[0]).toMatchObject({
      missing: 1,
      notConnected: [{ samples: 1, volume: OFFLINE }],
    });

    const removed = await remove("A0");

    expect(removed.data?.samples).toBe(1);
    const rows = rowsOf("A0");
    expect(rows.map((row) => row.filename)).toEqual([
      "1 kick.wav",
      "1 hat.wav",
      "2 clap.wav",
      "away.wav",
    ]);
    expect(rows.at(-1)?.source_status).toBe("missing");
  });

  it("removes nothing when no row is recorded missing, and a row recorded missing whose file is there stays", async () => {
    await passFinds([]);
    expect((await remove("A0")).data?.samples).toBe(0);
    // Recorded missing by an earlier check, but the file is there now
    const kick = getKitSamples(dbDir, "A0").data!.find(
      (row) => row.filename === "1 kick.wav",
    )!;
    withDbTransaction(dbDir, (db) =>
      updateSampleSourceStatusTx(db, kick.id, { source_status: "missing" }),
    );

    const removed = await remove("A0");

    expect(removed).toEqual({
      data: { samples: 0, voicesBefore: [] },
      success: true,
    });
    expect(rowsOf("A0")).toHaveLength(4);
    expect(modified("A0")).toBe(false);
  });

  it("one undo puts the rows back exactly: voice, slot, file, gain, details and status; and the kit is checked again", async () => {
    fs.rmSync(fileOf("B0", "1 kick.wav"));
    fs.rmSync(fileOf("B0", "1 hat.wav"));
    await passFinds(["B0"]);
    const before = rowsOf("B0");
    const removed = await remove("B0");
    await vi.waitFor(() => expect(kitsFound()).toEqual([]));

    const undone = await remove("B0", removed.data!.voicesBefore);

    expect(undone).toEqual({
      data: { samples: 2, voicesBefore: [] },
      success: true,
    });
    expect(rowsOf("B0")).toEqual(before);
    // The files are still gone: the kit's finding comes back at once
    await vi.waitFor(() =>
      expect(kitsFound()).toEqual([
        expect.objectContaining({ kitName: "B0", missing: 2 }),
      ]),
    );

    // Redo is the removal again
    expect((await remove("B0")).data?.samples).toBe(2);
    expect(rowsOf("B0").map((row) => row.filename)).toEqual([
      "1 snare.wav",
      "2 clap.wav",
    ]);
  });

  it("undo refuses, and changes nothing, when the voice changed since", async () => {
    fs.rmSync(fileOf("A0", "1 kick.wav"));
    await passFinds(["A0"]);
    const removed = await remove("A0");
    // A sample added to the voice after the removal
    const added = fileOf("A0", "1 tom.wav");
    fs.writeFileSync(added, goodWav());
    expect(
      (
        (await invoke("add-sample-to-slot", "A0", 1, 2, added)) as {
          success: boolean;
        }
      ).success,
    ).toBe(true);
    const after = rowsOf("A0");

    const undone = await remove("A0", removed.data!.voicesBefore);

    expect(undone.success).toBe(false);
    expect(undone.error).toContain("changed since");
    expect(rowsOf("A0")).toEqual(after);
  });

  it("undo can only put back missing rows: it isn't a way to edit a read-only kit", async () => {
    const [voice1] = removedVoices(rowsOf("B0"));
    // A snapshot that would add a readable sample, or change a gain
    const extra: VoiceSnapshot = {
      samples: [
        ...voice1.samples,
        {
          ...voice1.samples[0],
          slot_number: 5,
          source_path: fileOf("B0", "1 new.wav"),
        },
      ],
      voice: 1,
    };
    const regain: VoiceSnapshot = {
      samples: voice1.samples.map((row) => ({ ...row, gain_db: 6 })),
      voice: 1,
    };
    const before = rowsOf("B0");

    for (const voices of [[extra], [regain]]) {
      const result = await remove("B0", voices);
      expect(result.success).toBe(false);
    }
    expect(rowsOf("B0")).toEqual(before);
    // The kit's general undo path still refuses a read-only kit (#572)
    const restored = (await invoke("restore-kit-voices", "B0", [voice1])) as {
      error: string;
      success: boolean;
    };
    expect(restored.success).toBe(false);
    expect(restored.error).toBe("Kit B0 isn't editable.");
  });

  it("refuses a missing kit and bad arguments", async () => {
    expect((await remove("Z9")).error).toBe("Kit Z9 not found");
    expect(
      ((await invoke("remove-missing-samples", "")) as Removed).success,
    ).toBe(false);
    expect(
      ((await invoke("remove-missing-samples", "A0", "nope")) as Removed)
        .success,
    ).toBe(false);
  });
});

/** The voices of `rows` as a snapshot, as the removal returns them */
function removedVoices(rows: ReturnType<typeof rowsOf>): VoiceSnapshot[] {
  const full = getKitSamples(dbDir, "B0").data!;
  return [1, 2].map((voice) => ({
    samples: full
      .filter((row) => row.voice_number === voice)
      .filter((row) => rows.some((r) => r.source_path === row.source_path))
      .sort((a, b) => a.slot_number - b.slot_number)
      .map((row) => ({
        filename: row.filename,
        gain_db: row.gain_db,
        slot_number: row.slot_number,
        source_mtime_ms: row.source_mtime_ms,
        source_path: row.source_path,
        source_size: row.source_size,
        source_status: row.source_status,
        wav_bit_depth: row.wav_bit_depth,
        wav_bitrate: row.wav_bitrate,
        wav_channels: row.wav_channels,
        wav_format_tag: row.wav_format_tag,
        wav_sample_rate: row.wav_sample_rate,
      })),
    voice,
  }));
}
