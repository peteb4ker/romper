import type { Sample } from "@romper/shared/db/schema.js";

import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  type KitScanIo,
  MAX_SLOTS_PER_VOICE,
  planKitScanMerge,
} from "../kitScanOperations.js";

const KIT_PATH = path.join("/store", "A0");
const METADATA = {
  // A header read records that the file was readable (#537)
  source_status: "readable" as const,
  wav_bit_depth: 16,
  wav_bitrate: 1411200,
  wav_channels: 2,
  wav_sample_rate: 44100,
};

function io(missing: string[] = []): KitScanIo {
  return {
    fileExists: vi.fn((p: string) => !missing.includes(p)),
    readMetadata: vi.fn(() => METADATA),
  };
}

function row(overrides: Partial<Sample> & Pick<Sample, "filename">): Sample {
  return {
    gain_db: 0,
    id: 1,
    kit_name: "A0",
    slot_number: 0,
    source_path: path.join(KIT_PATH, overrides.filename),
    voice_number: 1,
    ...METADATA,
    ...overrides,
  };
}

const factoryKit = { editable: false, locked: false, name: "A0" };

/** A voice row as planKitScanMerge reads it: unlinked, no stereo choice */
function voice(voiceNumber: number, voiceAlias: null | string) {
  return {
    stereo_choice: null,
    stereo_mode: false,
    voice_alias: voiceAlias,
    voice_number: voiceNumber,
  };
}

describe("[UC-13] planKitScanMerge", () => {
  it("adds a new folder file in the next free slot and keeps existing rows", () => {
    const existing = [row({ filename: "1 kick.wav", id: 1 })];

    const plan = planKitScanMerge({
      existing,
      folder: {
        filesByVoice: { 1: ["1 kick.wav", "1 kick2.wav"], 2: [], 3: [], 4: [] },
        kitPath: KIT_PATH,
      },
      io: io(),
      kit: factoryKit,
      voices: [],
    });

    expect(plan.inserts).toEqual([
      {
        filename: "1 kick2.wav",
        kit_name: "A0",
        slot_number: 1,
        source_path: path.join(KIT_PATH, "1 kick2.wav"),
        voice_number: 1,
        ...METADATA,
      },
    ]);
    expect(plan.result.addedSamples).toBe(1);
    expect(plan.result.scannedSamples).toBe(2);
    expect(plan.metadataUpdates).toEqual([]);
  });

  it("never changes a user row: gain, slot, voice and an external source path survive", () => {
    const external = row({
      filename: "my snare.wav",
      gain_db: -6,
      id: 7,
      slot_number: 3,
      source_path: "/Users/me/Samples/my snare.wav",
      voice_number: 2,
    });
    // A store file the user moved in-app from voice 1 to voice 3
    const moved = row({
      filename: "1 hat.wav",
      gain_db: 4.5,
      id: 8,
      slot_number: 0,
      voice_number: 3,
    });

    const plan = planKitScanMerge({
      existing: [external, moved],
      folder: {
        filesByVoice: { 1: ["1 hat.wav"], 2: [], 3: [], 4: [] },
        kitPath: KIT_PATH,
      },
      io: io(),
      kit: factoryKit,
      voices: [],
    });

    expect(plan.inserts).toEqual([]);
    expect(plan.metadataUpdates).toEqual([]);
    expect(plan.result.missingSamples).toEqual([]);
  });

  it("reports rows whose file is gone instead of deleting them", () => {
    const gone = row({
      filename: "old.wav",
      id: 3,
      slot_number: 2,
      source_path: "/Volumes/USB/old.wav",
      voice_number: 4,
    });

    const plan = planKitScanMerge({
      existing: [gone],
      folder: {
        filesByVoice: { 1: [], 2: [], 3: [], 4: [] },
        kitPath: KIT_PATH,
      },
      io: io(["/Volumes/USB/old.wav"]),
      kit: factoryKit,
      voices: [],
    });

    expect(plan.result.missingSamples).toEqual([
      {
        filename: "old.wav",
        slotNumber: 2,
        sourcePath: "/Volumes/USB/old.wav",
        voiceNumber: 4,
      },
    ]);
    expect(plan.inserts).toEqual([]);
  });

  it("changes nothing on a locked kit", () => {
    const scanIo = io(["/gone.wav"]);
    const plan = planKitScanMerge({
      existing: [
        row({
          filename: "gone.wav",
          source_path: "/gone.wav",
          wav_channels: null,
        }),
      ],
      folder: {
        filesByVoice: { 1: ["1 new.wav"], 2: [], 3: [], 4: [] },
        kitPath: KIT_PATH,
      },
      io: scanIo,
      kit: { ...factoryKit, locked: true },
      voices: [],
    });

    expect(plan.inserts).toEqual([]);
    expect(plan.metadataUpdates).toEqual([]);
    expect(plan.aliasUpdates).toEqual([]);
    expect(plan.result).toMatchObject({
      addedSamples: 0,
      locked: true,
      missingSamples: [],
      scannedSamples: 1,
    });
    expect(scanIo.fileExists).not.toHaveBeenCalled();
    expect(scanIo.readMetadata).not.toHaveBeenCalled();
  });

  it("never fills a voice past 12 samples and reports what it skipped", () => {
    const existing = Array.from({ length: 11 }, (_, slot) =>
      row({ filename: `1 s${slot}.wav`, id: slot + 1, slot_number: slot }),
    );

    const plan = planKitScanMerge({
      existing,
      folder: {
        filesByVoice: {
          1: ["1 x.wav", "1 y.wav", "1 z.wav"],
          2: [],
          3: [],
          4: [],
        },
        kitPath: KIT_PATH,
      },
      io: io(),
      kit: factoryKit,
      voices: [],
    });

    expect(plan.inserts.map((r) => [r.filename, r.slot_number])).toEqual([
      ["1 x.wav", MAX_SLOTS_PER_VOICE - 1],
    ]);
    expect(plan.result.skippedFiles).toEqual([
      { filename: "1 y.wav", reason: "voice_full", voiceNumber: 1 },
      { filename: "1 z.wav", reason: "voice_full", voiceNumber: 1 },
    ]);
  });

  it("fills gaps before appending", () => {
    const plan = planKitScanMerge({
      existing: [
        row({ filename: "1 a.wav", id: 1, slot_number: 0 }),
        row({ filename: "1 c.wav", id: 2, slot_number: 2 }),
      ],
      folder: {
        filesByVoice: {
          1: ["1 a.wav", "1 b.wav", "1 c.wav", "1 d.wav"],
          2: [],
          3: [],
          4: [],
        },
        kitPath: KIT_PATH,
      },
      io: io(),
      kit: factoryKit,
      voices: [],
    });

    expect(plan.inserts.map((r) => [r.filename, r.slot_number])).toEqual([
      ["1 b.wav", 1],
      ["1 d.wav", 3],
    ]);
  });

  it("does not re-add folder files to editable kits, so in-app deletions stick", () => {
    const plan = planKitScanMerge({
      existing: [],
      folder: {
        filesByVoice: { 1: ["1 deleted in app.wav"], 2: [], 3: [], 4: [] },
        kitPath: KIT_PATH,
      },
      io: io(),
      kit: { ...factoryKit, editable: true },
      voices: [],
    });

    expect(plan.inserts).toEqual([]);
    expect(plan.result.skippedFiles).toEqual([
      {
        filename: "1 deleted in app.wav",
        reason: "kit_editable",
        voiceNumber: 1,
      },
    ]);
  });

  it("fills in missing WAV metadata on existing rows whose file is readable", () => {
    const plan = planKitScanMerge({
      existing: [
        row({
          filename: "1 kick.wav",
          id: 5,
          wav_bit_depth: null,
          wav_bitrate: null,
          wav_channels: null,
          wav_sample_rate: null,
        }),
      ],
      folder: {
        filesByVoice: { 1: ["1 kick.wav"], 2: [], 3: [], 4: [] },
        kitPath: KIT_PATH,
      },
      io: io(),
      kit: factoryKit,
      voices: [],
    });

    expect(plan.metadataUpdates).toEqual([{ id: 5, metadata: METADATA }]);
    expect(plan.result.metadataUpdated).toBe(1);
  });

  it("names only voices without a name, from the voice's first sample", () => {
    const plan = planKitScanMerge({
      existing: [row({ filename: "2 snare.wav", id: 1, voice_number: 2 })],
      folder: {
        filesByVoice: {
          1: ["1 kick.wav"],
          2: ["2 snare.wav"],
          3: [],
          4: ["4 hat.wav"],
        },
        kitPath: KIT_PATH,
      },
      io: io(),
      kit: factoryKit,
      voices: [voice(1, null), voice(2, null), voice(4, "My Hats")],
    });

    expect(plan.aliasUpdates).toEqual([
      { alias: "Kick", voiceNumber: 1 },
      { alias: "Snare", voiceNumber: 2 },
    ]);
    expect(plan.result.updatedVoices).toBe(2);
  });

  describe("[UC-13] recording what the scan found about each file (#537)", () => {
    it("records missing and unreadable files, and re-reads them next time", () => {
      const scanIo: KitScanIo = {
        fileExists: vi.fn((p: string) => !p.endsWith("gone.wav")),
        readMetadata: vi.fn((p: string) =>
          p.endsWith("bad.wav") ? null : METADATA,
        ),
      };
      const plan = planKitScanMerge({
        existing: [
          row({ filename: "gone.wav", id: 1 }),
          // Never read: status unknown, no WAV details
          row({
            filename: "bad.wav",
            id: 2,
            slot_number: 1,
            source_status: null,
            wav_bit_depth: null,
            wav_channels: null,
            wav_sample_rate: null,
          }),
          row({
            filename: "fixed.wav",
            id: 3,
            slot_number: 2,
            source_status: "unreadable",
          }),
        ],
        folder: {
          filesByVoice: { 1: [], 2: ["2 new bad.wav"], 3: [], 4: [] },
          kitPath: KIT_PATH,
        },
        io: scanIo,
        kit: factoryKit,
        voices: [],
      });

      expect(plan.statusUpdates).toEqual([
        { id: 1, status: "missing" },
        { id: 2, status: "unreadable" },
      ]);
      // Readable again: re-read, and recorded as readable
      expect(plan.metadataUpdates).toEqual([{ id: 3, metadata: METADATA }]);
      expect(plan.inserts).toEqual([
        expect.objectContaining({
          filename: "2 new bad.wav",
          source_status: "unreadable",
        }),
      ]);
      expect(plan.result.stereo?.quarantine).toEqual([
        { filename: "bad.wav", kind: "unreadable", voiceNumber: 1 },
        { filename: "2 new bad.wav", kind: "unreadable", voiceNumber: 2 },
      ]);
    });
  });
});
