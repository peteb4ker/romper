/**
 * Main refuses the edits the kit editor refuses on a read-only kit (#572):
 * sample adds, replaces, moves and deletes, undo of those, gain, voice
 * names and deleting the kit. Each refusal leaves the store as it was.
 * Sequencer settings still change on a read-only kit.
 *
 * Runs the real services, the ones the IPC handlers call, on a real store.
 */
import type { Sample } from "@romper/shared/db/schema.js";

import { snapshotVoices } from "@romper/shared/undoTypes.js";
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
  createRomperDbFile,
  getKit,
  getKitSamples,
  updateKit,
  updateSampleGain,
  updateVoiceAlias,
} from "../../electron/main/db/romperDbCoreORM.js";
import { kitService } from "../../electron/main/services/kitService.js";
import { sampleService } from "../../electron/main/services/sampleService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

let work: string;
let dbDir: string;
let settings: { localStorePath: string };
let newWav: string;

const READ_ONLY = "A0";
const EDITABLE = "A1";

function sampleRow(kitName: string, voice: number, slot: number) {
  const file = wav(`${kitName}-${voice}-${slot}.wav`);
  return {
    filename: path.basename(file),
    kit_name: kitName,
    slot_number: slot,
    source_path: file,
    voice_number: voice,
  };
}

/** What a refused edit must leave alone: the kit, its voices and samples */
function state(kitName: string) {
  const kit = getKit(dbDir, kitName).data;
  const samples = (getKitSamples(dbDir, kitName).data ?? [])
    .map(({ id: _id, ...row }) => row)
    .sort(
      (a, b) =>
        a.voice_number - b.voice_number || a.slot_number - b.slot_number,
    );
  return { kit, samples };
}

function wav(name: string): string {
  const file = path.join(work, "in", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    encodeTestWav([sine(220, 0.02, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
  return file;
}

beforeEach(() => {
  work = createTempStore("romper-read-only-kit-");
  const store = path.join(work, "store");
  dbDir = path.join(store, ".romperdb");
  expect(createRomperDbFile(dbDir).success).toBe(true);
  settings = { localStorePath: store };
  for (const [name, editable] of [
    [READ_ONLY, false],
    [EDITABLE, true],
  ] as const) {
    expect(
      addKit(dbDir, {
        bank_letter: "A",
        editable,
        modified_since_sync: false,
        name,
      }).success,
    ).toBe(true);
    expect(addSample(dbDir, sampleRow(name, 1, 0)).success).toBe(true);
    expect(addSample(dbDir, sampleRow(name, 1, 1)).success).toBe(true);
  }
  newWav = wav("new.wav");
});

afterEach(() => {
  removeTempStore(work);
});

const NOT_EDITABLE = `Kit ${READ_ONLY} isn't editable.`;

describe("[UC-17] main refuses edits to a read-only kit (#572)", () => {
  const refusals: [string, () => { error?: string; success: boolean }][] = [
    [
      "add-sample-to-slot",
      () => sampleService.addSampleToSlot(settings, READ_ONLY, 2, 0, newWav),
    ],
    [
      "delete-sample-from-slot",
      () => sampleService.deleteSampleFromSlot(settings, READ_ONLY, 1, 0),
    ],
    [
      "delete-sample-from-slot-without-reindexing",
      () =>
        sampleService.deleteSampleFromSlotWithoutReindexing(
          settings,
          READ_ONLY,
          1,
          0,
        ),
    ],
    [
      "move-sample-in-kit",
      () =>
        sampleService.moveSampleInKit(
          settings,
          READ_ONLY,
          1,
          0,
          2,
          0,
          "insert",
        ),
    ],
    [
      "restore-kit-voices",
      () =>
        sampleService.restoreVoices(
          settings,
          READ_ONLY,
          snapshotVoices([] as Sample[], [1]),
        ),
    ],
    ["update-sample-gain", () => updateSampleGain(dbDir, READ_ONLY, 1, 0, -6)],
    [
      "update-voice-alias",
      () => updateVoiceAlias(dbDir, READ_ONLY, 1, "Kicks"),
    ],
    ["delete-kit", () => kitService.deleteKit(settings, READ_ONLY)],
  ];

  it.each(refusals)("%s leaves the kit as it was", (_channel, edit) => {
    const before = state(READ_ONLY);

    const result = edit();

    expect(result.success).toBe(false);
    expect(result.error).toContain(NOT_EDITABLE);
    expect(state(READ_ONLY)).toEqual(before);
  });

  it("move-sample-between-kits refuses a read-only source or destination", () => {
    const before = [state(READ_ONLY), state(EDITABLE)];

    for (const [fromKit, toKit] of [
      [READ_ONLY, EDITABLE],
      [EDITABLE, READ_ONLY],
    ]) {
      const result = sampleService.moveSampleBetweenKits(settings, {
        fromKit,
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toKit,
        toSlot: 0,
        toVoice: 2,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain(NOT_EDITABLE);
    }
    expect([state(READ_ONLY), state(EDITABLE)]).toEqual(before);
  });

  it("allows the same edits once the kit is editable", () => {
    expect(updateKit(dbDir, READ_ONLY, { editable: true }).success).toBe(true);

    expect(updateVoiceAlias(dbDir, READ_ONLY, 1, "Kicks").success).toBe(true);
    expect(updateSampleGain(dbDir, READ_ONLY, 1, 0, -6).success).toBe(true);
    expect(
      sampleService.addSampleToSlot(settings, READ_ONLY, 2, 0, newWav).success,
    ).toBe(true);
    expect(
      sampleService.deleteSampleFromSlot(settings, READ_ONLY, 1, 1).success,
    ).toBe(true);
    expect(kitService.deleteKit(settings, READ_ONLY).success).toBe(true);
  });

  it("still lets the sequencer change a read-only kit", () => {
    expect(updateKit(dbDir, READ_ONLY, { bpm: 150 }).success).toBe(true);
    expect(getKit(dbDir, READ_ONLY).data?.bpm).toBe(150);
  });
});
