/**
 * Performance budgets for writing a card (#650, tests/perf/budgets.ts).
 *
 * A write is bound by the card: every file it writes costs its bytes and a
 * FAT update, and an SD card is slow at both. The write used to rewrite
 * every sample each time, so writing an unchanged store to a full card
 * took minutes. Now a file the card already holds byte for byte is left
 * alone. These budgets pin how many files a write puts on the card, and
 * the synchronous fs calls that would hold the main thread while it runs
 * (RE-07). Counts are deterministic, so they're checked on every PR;
 * timings aren't.
 *
 * The store mixes what a real one holds: factory-style 16-bit 44.1 kHz
 * mono files (one with a LIST chunk before the data), 24-bit, 48 kHz and
 * float files that are converted, stereo files on a voice the write links
 * automatically (copied) and on a mono voice (mixed down), and one larger
 * stereo file.
 */
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: () => [] },
}));

import {
  addKit,
  updateSampleGain,
} from "../../electron/main/db/romperDbCoreORM.js";
import { withDbTransaction } from "../../electron/main/db/utils/dbUtilities.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { type NewSample, samples } from "../../shared/db/schema.js";
import { type BudgetName, enforceBudgets } from "../perf/budgets";
import { encodeTestWav, sine } from "../validation/support/wav";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

/** Setup writes a store and a card; Windows runners are slow */
const SLOW_RUNNER_MS = 60_000;
const KITS = ["A0", "A1", "A2", "A3", "B0", "B1", "B2", "B3"];
const SYNC_FS_CALLS = [
  "existsSync",
  "readdirSync",
  "readFileSync",
  "readSync",
  "statSync",
] as const;

interface StoreFile {
  bytes: Buffer;
  name: string;
  voice: number;
}

let work: string;
let store: string;
let card: string;
let settings: { localStorePath: string };

/** Every file on the card, relative to it, with its bytes */
function cardContents(): Map<string, Buffer> {
  const contents = new Map<string, Buffer>();
  for (const entry of fs.readdirSync(card, { recursive: true })) {
    const file = path.join(card, String(entry));
    if (fs.statSync(file).isFile()) {
      contents.set(String(entry), fs.readFileSync(file));
    }
  }
  return contents;
}

function expectWithinBudget(name: BudgetName, measured: object) {
  expect(enforceBudgets(name, measured as Record<string, number>)).toEqual([]);
}

function generateStore(): number {
  const dbDir = path.join(store, ".romperdb");
  expect(createStoreDb(dbDir).success).toBe(true);
  const rows: NewSample[] = [];
  KITS.forEach((kit, index) => {
    expect(
      addKit(dbDir, {
        alias: null,
        bank_letter: kit[0],
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: kit,
        step_pattern: null,
      }).success,
    ).toBe(true);
    const slots = new Map<number, number>();
    for (const { bytes, name, voice } of kitFiles(index)) {
      const file = path.join(store, kit, `${voice} ${name}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
      const slot = slots.get(voice) ?? 0;
      slots.set(voice, slot + 1);
      rows.push({
        filename: name,
        kit_name: kit,
        slot_number: slot,
        source_path: file,
        voice_number: voice,
      });
    }
  });
  expect(
    withDbTransaction(dbDir, (db) => db.insert(samples).values(rows).run())
      .success,
  ).toBe(true);
  return rows.length;
}

/** What each kit holds: index 0 is A0 */
function kitFiles(index: number): StoreFile[] {
  const hz = 110 + index * 20;
  const mono16 = (seconds: number, extraChunk = false) =>
    encodeTestWav(
      [sine(hz, seconds, 44100)],
      { bitDepth: 16, encoding: "pcm", sampleRate: 44100 },
      { extraChunk },
    );
  const stereo16 = (seconds: number) =>
    encodeTestWav([sine(hz, seconds, 44100), sine(hz * 1.5, seconds, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    });
  const files: StoreFile[] = [
    // Factory-style samples: plain copies
    { bytes: mono16(0.05), name: "kick.wav", voice: 1 },
    { bytes: mono16(0.08, true), name: "snare.wav", voice: 1 },
    { bytes: mono16(0.03), name: "hat.wav", voice: 1 },
    // Converted: 24-bit, 48 kHz
    {
      bytes: encodeTestWav([sine(hz, 0.05, 44100)], {
        bitDepth: 24,
        encoding: "pcm",
        sampleRate: 44100,
      }),
      name: "tom 24-bit.wav",
      voice: 1,
    },
    {
      bytes: encodeTestWav([sine(hz, 0.05, 48000)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 48000,
      }),
      name: "rim 48k.wav",
      voice: 1,
    },
    // A stereo file on a mono voice: mixed down
    { bytes: mono16(0.04), name: "clap.wav", voice: 2 },
    { bytes: stereo16(0.06), name: "stereo clap.wav", voice: 2 },
  ];
  if (index % 2 === 1) {
    // Voice 3 holds only stereo samples and voice 4 none: linked
    // automatically (#537 rule 2), so they're copied as they are
    files.push(
      { bytes: stereo16(0.1), name: "pad.wav", voice: 3 },
      { bytes: stereo16(0.07), name: "pad 2.wav", voice: 3 },
    );
  } else {
    files.push(
      { bytes: mono16(0.05), name: "perc.wav", voice: 3 },
      { bytes: mono16(0.04), name: "bell.wav", voice: 4 },
      {
        bytes: encodeTestWav([sine(hz, 0.05, 44100)], {
          bitDepth: 32,
          encoding: "float",
          sampleRate: 44100,
        }),
        name: "noise float.wav",
        voice: 4,
      },
    );
  }
  if (index === 0) {
    // One larger file: 2 s of 24-bit 48 kHz stereo
    files.push({
      bytes: encodeTestWav([sine(hz, 2, 48000), sine(hz * 2, 2, 48000)], {
        bitDepth: 24,
        encoding: "pcm",
        sampleRate: 48000,
      }),
      name: "drone.wav",
      voice: 4,
    });
  }
  return files;
}

/**
 * Write the store to the card, counting the files written to the card and
 * the synchronous fs calls made while it ran
 */
async function measureWrite() {
  const counts = { cardWrites: 0, syncFsCalls: 0 };
  const onCard = (target: unknown) =>
    typeof target === "string" && target.startsWith(card + path.sep);
  const promises = fs.promises as unknown as Record<
    string,
    (...a: unknown[]) => unknown
  >;
  const sync = fs as unknown as Record<string, (...a: unknown[]) => unknown>;
  const originals: Record<string, (...a: unknown[]) => unknown> = {
    copyFile: promises.copyFile,
    writeFile: promises.writeFile,
    ...Object.fromEntries(SYNC_FS_CALLS.map((name) => [name, sync[name]])),
  };
  promises.copyFile = (...a: unknown[]) => {
    if (onCard(a[1])) counts.cardWrites++;
    return originals.copyFile(...a);
  };
  promises.writeFile = (...a: unknown[]) => {
    if (onCard(a[0])) counts.cardWrites++;
    return originals.writeFile(...a);
  };
  for (const name of SYNC_FS_CALLS) {
    sync[name] = (...a: unknown[]) => {
      counts.syncFsCalls++;
      return originals[name](...a);
    };
  }
  // Named ESM imports of node:fs see the wrappers too
  syncBuiltinESMExports();
  try {
    const result = await syncService.startKitSync(settings, {
      sdCardPath: card,
    });
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    return { counts, syncedFiles: result.data?.syncedFiles };
  } finally {
    promises.copyFile = originals.copyFile;
    promises.writeFile = originals.writeFile;
    for (const name of SYNC_FS_CALLS) sync[name] = originals[name];
    syncBuiltinESMExports();
  }
}

describe("[UC-34] [Q-01] performance budgets: writing a card (#650)", () => {
  let sampleCount: number;

  beforeEach(() => {
    work = createTempStore("romper-write-budget-");
    store = path.join(work, "store");
    card = path.join(work, "card");
    fs.mkdirSync(card, { recursive: true });
    sampleCount = generateStore();
    settings = { localStorePath: store };
  }, SLOW_RUNNER_MS);

  afterEach(() => {
    removeTempStore(work);
  });

  it(
    "write a full card",
    async () => {
      const { counts, syncedFiles } = await measureWrite();
      expect(syncedFiles).toBe(sampleCount);
      // Every sample is new to the card, so each is written once
      expect(counts.cardWrites).toBe(sampleCount);
      expectWithinBudget("integration/write a full card", counts);
    },
    SLOW_RUNNER_MS,
  );

  it(
    "write an unchanged store to the card again",
    async () => {
      await measureWrite();
      const before = cardContents();

      const { counts, syncedFiles } = await measureWrite();
      // Every sample is still accounted for, but none is written again
      expect(syncedFiles).toBe(sampleCount);
      expect(cardContents()).toEqual(before);
      expectWithinBudget("integration/write an unchanged card again", counts);
    },
    SLOW_RUNNER_MS,
  );

  it(
    "writes again exactly the samples that changed since the last write",
    async () => {
      await measureWrite();
      const dbDir = path.join(store, ".romperdb");

      // A gain change: the converted file differs, so it's written again
      expect(updateSampleGain(dbDir, "A1", 1, 0, -6).success).toBe(true);
      // A source edited in place, at the same size: copied again
      const edited = path.join(store, "B0", "1 hat.wav");
      const bytes = fs.readFileSync(edited);
      bytes[bytes.length - 2] ^= 0x7f;
      fs.writeFileSync(edited, bytes);
      // A card file changed or removed outside Romper: put back
      fs.writeFileSync(path.join(card, "A2", "1-01 kick.wav"), "damaged");
      fs.rmSync(path.join(card, "B1", "3-02 pad 2.wav"));

      const { counts } = await measureWrite();
      expect(counts.cardWrites).toBe(4);
      expect(fs.readFileSync(path.join(card, "B0", "1-03 hat.wav"))).toEqual(
        bytes,
      );
      expect(fs.readFileSync(path.join(card, "A2", "1-01 kick.wav"))).toEqual(
        fs.readFileSync(path.join(store, "A2", "1 kick.wav")),
      );
      expect(fs.existsSync(path.join(card, "B1", "3-02 pad 2.wav"))).toBe(true);
    },
    SLOW_RUNNER_MS,
  );
});
