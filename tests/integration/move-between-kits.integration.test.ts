/**
 * Move between kits (RE-27) as a single unit of work.
 *
 * It runs through the real services on a real store. Fault injection uses
 * a SQLite trigger (RAISE(ABORT)) on the kit's modified flag, which the
 * move writes last, so it runs unmodified and fails after its other writes.
 */
import type { Sample } from "@romper/shared/db/schema.js";

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/nonexistent", isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
}));

import {
  addKit,
  addSample,
  getKit,
  getKitSamples,
  updateSampleGain,
  updateSampleMetadata,
  withDbTransaction,
} from "../../electron/main/db/romperDbCoreORM.js";
import { sampleService } from "../../electron/main/services/sampleService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

let work: string;
let store: string;
let dbDir: string;
let settings: { localStorePath: string };

function failFlagWrites() {
  const created = withDbTransaction(dbDir, (_db, sqlite) =>
    sqlite.exec(
      "CREATE TRIGGER no_flag BEFORE UPDATE OF modified_since_sync ON kits BEGIN SELECT RAISE(ABORT, 'injected fault'); END",
    ),
  );
  expect(created.success).toBe(true);
}

function kitRows(kitName: string) {
  return (getKitSamples(dbDir, kitName).data ?? []).sort(
    (a, b) => a.voice_number - b.voice_number || a.slot_number - b.slot_number,
  );
}

function modified(kitName: string) {
  return getKit(dbDir, kitName).data?.modified_since_sync;
}

function newKit(name: string) {
  expect(
    addKit(dbDir, {
      bank_letter: name.charAt(0),
      editable: true,
      modified_since_sync: false,
      name,
    }).success,
  ).toBe(true);
}

/** Put a sample in a slot, with a gain and the file's WAV header columns */
function seed(kit: string, voice: number, slot: number, name: string) {
  const file = wav(path.join(store, kit, name), 110 * (slot + voice));
  const added = addSample(dbDir, {
    filename: name,
    kit_name: kit,
    slot_number: slot,
    source_path: file,
    voice_number: voice,
  });
  expect(added.success).toBe(true);
  const id = added.data!.sampleId;
  expect(
    updateSampleMetadata(dbDir, id, {
      wav_bit_depth: 16,
      wav_bitrate: 44100 * 16,
      wav_channels: 1,
      wav_sample_rate: 44100,
    }).success,
  ).toBe(true);
  expect(updateSampleGain(dbDir, kit, voice, slot, -3 - slot).success).toBe(
    true,
  );
}

function slots(kitName: string, voice: number) {
  return kitRows(kitName)
    .filter((s) => s.voice_number === voice)
    .map((s) => `${s.slot_number}:${s.filename}`);
}

function wav(file: string, hz: number) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    encodeTestWav([sine(hz, 0.02, 44100)], {
      bitDepth: 24,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
  return file;
}

beforeEach(() => {
  work = createTempStore("romper-move-between-kits-");
  store = path.join(work, "store");
  dbDir = path.join(store, ".romperdb");
  expect(createStoreDb(dbDir).success).toBe(true);
  settings = { localStorePath: store };
  newKit("A0");
  newKit("B0");
  seed("A0", 1, 0, "a.wav");
  seed("A0", 1, 1, "b.wav");
  seed("A0", 1, 2, "c.wav");
  seed("B0", 1, 0, "x.wav");
  seed("B0", 1, 1, "y.wav");
  // Seeding flags the kits; each test starts from a written card
  withDbTransaction(dbDir, (_db, sqlite) =>
    sqlite.exec("UPDATE kits SET modified_since_sync = 0"),
  );
});

afterEach(() => {
  removeTempStore(work);
});

describe("[UC-22] [Q-02] moving a sample to another kit is one transaction (RE-27)", () => {
  const move = (toSlot: number, toVoice = 1, fromSlot = 1) =>
    sampleService.moveSampleBetweenKits(settings, {
      fromKit: "A0",
      fromSlot,
      fromVoice: 1,
      mode: "insert",
      toKit: "B0",
      toSlot,
      toVoice,
    });

  it("carries the row, gain and WAV metadata, and renumbers both voices", () => {
    const moving = kitRows("A0")[1];

    const result = move(0);

    expect(result.error).toBeUndefined();
    expect(slots("A0", 1)).toEqual(["0:a.wav", "1:c.wav"]);
    expect(slots("B0", 1)).toEqual(["0:b.wav", "1:x.wav", "2:y.wav"]);
    const moved = kitRows("B0").find((s) => s.filename === "b.wav") as Sample;
    expect(moved).toEqual({
      ...moving,
      kit_name: "B0",
      slot_number: 0,
    });
    expect(moved.gain_db).toBe(-4);
    expect(result.data?.movedSample).toEqual(moved);
    expect(modified("A0")).toBe(true);
    expect(modified("B0")).toBe(true);
  });

  it("lands at the end of the destination voice when the slot is past it", () => {
    expect(move(9, 2).success).toBe(true);
    expect(slots("B0", 2)).toEqual(["0:b.wav"]);
  });

  it("refuses a full destination voice and changes nothing", () => {
    for (let slot = 2; slot < 12; slot++) seed("B0", 1, slot, `f${slot}.wav`);
    withDbTransaction(dbDir, (_db, sqlite) =>
      sqlite.exec("UPDATE kits SET modified_since_sync = 0"),
    );
    const before = [...kitRows("A0"), ...kitRows("B0")];

    const result = move(0);

    expect(result.success).toBe(false);
    expect(result.error).toContain("full");
    expect([...kitRows("A0"), ...kitRows("B0")]).toEqual(before);
    expect(modified("A0")).toBe(false);
  });

  it("refuses a destination voice that already has the file", () => {
    const sameFile = kitRows("A0")[1].source_path;
    withDbTransaction(dbDir, (_db, sqlite) =>
      sqlite
        .prepare(
          "UPDATE samples SET source_path = ? WHERE kit_name = 'B0' AND slot_number = 1",
        )
        .run(sameFile),
    );

    const result = move(0);

    expect(result.success).toBe(false);
    expect(slots("A0", 1)).toEqual(["0:a.wav", "1:b.wav", "2:c.wav"]);
  });

  it("a failure partway leaves both kits as they were", () => {
    const before = [...kitRows("A0"), ...kitRows("B0")];
    failFlagWrites();

    const result = move(0);

    expect(result.success).toBe(false);
    expect([...kitRows("A0"), ...kitRows("B0")]).toEqual(before);
  });
});
