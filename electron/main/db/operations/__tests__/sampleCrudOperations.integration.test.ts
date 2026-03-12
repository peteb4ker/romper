import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createRomperDbFile } from "../../utils/dbUtilities.js";
import { addKit } from "../kitCrudOperations.js";
import {
  addSample,
  deleteSamples,
  deleteSamplesWithoutReindexing,
  getAllSamples,
  getKitSamples,
  updateSampleMetadata,
} from "../sampleCrudOperations.js";

describe("Sample CRUD Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;
  const testKitName = "TestKit";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-sample-crud-"));
    dbDir = join(tempDir, ".romperdb");
    createRomperDbFile(dbDir);

    addKit(dbDir, {
      bank_letter: "A",
      editable: true,
      name: testKitName,
    });
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("addSample", () => {
    test("adds a sample and returns its id", () => {
      const result = addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data!.sampleId).toBeGreaterThan(0);
    });

    test("adds multiple samples to different slots", () => {
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 1,
        source_path: "/samples/snare.wav",
        voice_number: 1,
      });

      const samples = getKitSamples(dbDir, testKitName);
      expect(samples.data).toHaveLength(2);
    });

    test("fails when adding duplicate kit/voice/slot", () => {
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      const result = addSample(dbDir, {
        filename: "other.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/other.wav",
        voice_number: 1,
      });

      expect(result.success).toBe(false);
    });

    test("allows same slot number in different voices", () => {
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      const result = addSample(dbDir, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/snare.wav",
        voice_number: 2,
      });

      expect(result.success).toBe(true);
    });

    test("stores optional WAV metadata", () => {
      const addResult = addSample(dbDir, {
        filename: "hq.wav",
        is_stereo: true,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/hq.wav",
        voice_number: 1,
        wav_bit_depth: 24,
        wav_bitrate: 2304000,
        wav_channels: 2,
        wav_sample_rate: 48000,
      });

      expect(addResult.success).toBe(true);

      const samples = getKitSamples(dbDir, testKitName);
      const sample = samples.data![0];
      expect(sample.wav_bit_depth).toBe(24);
      expect(sample.wav_bitrate).toBe(2304000);
      expect(sample.wav_channels).toBe(2);
      expect(sample.wav_sample_rate).toBe(48000);
      expect(sample.is_stereo).toBe(true);
    });
  });

  describe("getAllSamples", () => {
    test("returns empty array when no samples exist", () => {
      const result = getAllSamples(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    test("returns samples across all kits", () => {
      addKit(dbDir, { bank_letter: "B", name: "OtherKit" });

      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: "OtherKit",
        slot_number: 0,
        source_path: "/samples/snare.wav",
        voice_number: 1,
      });

      const result = getAllSamples(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getKitSamples", () => {
    test("returns only samples for the specified kit", () => {
      addKit(dbDir, { bank_letter: "B", name: "OtherKit" });

      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: "OtherKit",
        slot_number: 0,
        source_path: "/samples/snare.wav",
        voice_number: 1,
      });

      const result = getKitSamples(dbDir, testKitName);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].filename).toBe("kick.wav");
    });

    test("returns empty array for kit with no samples", () => {
      const result = getKitSamples(dbDir, testKitName);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("updateSampleMetadata", () => {
    test("updates WAV metadata fields", () => {
      const addResult = addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      const sampleId = addResult.data!.sampleId;

      const result = updateSampleMetadata(dbDir, sampleId, {
        wav_bit_depth: 16,
        wav_sample_rate: 44100,
      });
      expect(result.success).toBe(true);

      const samples = getKitSamples(dbDir, testKitName);
      expect(samples.data![0].wav_bit_depth).toBe(16);
      expect(samples.data![0].wav_sample_rate).toBe(44100);
    });

    test("updates filename and source_path", () => {
      const addResult = addSample(dbDir, {
        filename: "old.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/old/path.wav",
        voice_number: 1,
      });

      updateSampleMetadata(dbDir, addResult.data!.sampleId, {
        filename: "new.wav",
        source_path: "/new/path.wav",
      });

      const samples = getKitSamples(dbDir, testKitName);
      expect(samples.data![0].filename).toBe("new.wav");
      expect(samples.data![0].source_path).toBe("/new/path.wav");
    });

    test("fails when updating non-existent sample", () => {
      const result = updateSampleMetadata(dbDir, 99999, {
        wav_bit_depth: 16,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    test("succeeds with no-op when no recognized fields provided", () => {
      const addResult = addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      // Passing empty updates should succeed (nothing to update)
      const result = updateSampleMetadata(dbDir, addResult.data!.sampleId, {});
      expect(result.success).toBe(true);
    });
  });

  describe("deleteSamples", () => {
    test("deletes all samples for a kit", () => {
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 1,
        source_path: "/samples/snare.wav",
        voice_number: 1,
      });

      const result = deleteSamples(dbDir, testKitName);
      expect(result.success).toBe(true);
      expect(result.data!.deletedSamples).toHaveLength(2);

      const remaining = getKitSamples(dbDir, testKitName);
      expect(remaining.data).toHaveLength(0);
    });

    test("deletes samples filtered by voice number", () => {
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/snare.wav",
        voice_number: 2,
      });

      const result = deleteSamples(dbDir, testKitName, { voiceNumber: 1 });
      expect(result.success).toBe(true);
      expect(result.data!.deletedSamples).toHaveLength(1);
      expect(result.data!.deletedSamples[0].filename).toBe("kick.wav");

      const remaining = getKitSamples(dbDir, testKitName);
      expect(remaining.data).toHaveLength(1);
      expect(remaining.data![0].filename).toBe("snare.wav");
    });

    test("deletes a specific sample by voice and slot", () => {
      addSample(dbDir, {
        filename: "s0.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/s0.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "s1.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 1,
        source_path: "/samples/s1.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "s2.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 2,
        source_path: "/samples/s2.wav",
        voice_number: 1,
      });

      const result = deleteSamples(dbDir, testKitName, {
        slotNumber: 1,
        voiceNumber: 1,
      });
      expect(result.success).toBe(true);
      expect(result.data!.deletedSamples).toHaveLength(1);

      // After delete with reindexing, remaining samples should be contiguous
      const remaining = getKitSamples(dbDir, testKitName);
      const voice1 = remaining
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);
      expect(voice1).toHaveLength(2);
      expect(voice1[0].filename).toBe("s0.wav");
      expect(voice1[1].filename).toBe("s2.wav");
      expect(voice1.map((s) => s.slot_number)).toEqual([0, 1]);
    });
  });

  describe("deleteSamplesWithoutReindexing", () => {
    test("deletes samples but does not reindex remaining slots", () => {
      addSample(dbDir, {
        filename: "s0.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/s0.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "s1.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 1,
        source_path: "/samples/s1.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "s2.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 2,
        source_path: "/samples/s2.wav",
        voice_number: 1,
      });

      const result = deleteSamplesWithoutReindexing(dbDir, testKitName, {
        slotNumber: 1,
        voiceNumber: 1,
      });
      expect(result.success).toBe(true);
      expect(result.data!.deletedSamples).toHaveLength(1);

      // Without reindexing, remaining slots keep their original numbers (gap at 1)
      const remaining = getKitSamples(dbDir, testKitName);
      const voice1 = remaining
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);
      expect(voice1).toHaveLength(2);
      expect(voice1[0].slot_number).toBe(0);
      expect(voice1[1].slot_number).toBe(2); // Gap at slot 1 - no reindex
    });

    test("returns deleted samples info", () => {
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: testKitName,
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      const result = deleteSamplesWithoutReindexing(dbDir, testKitName, {
        voiceNumber: 1,
      });
      expect(result.data!.deletedSamples).toHaveLength(1);
      expect(result.data!.deletedSamples[0].filename).toBe("kick.wav");
    });
  });
});
