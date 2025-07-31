// Unit tests for Drizzle ORM implementation
import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Kit, Sample } from "../../../../shared/db/schema.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
  deleteSamples,
  getAllSamples,
  getKit,
  getKits,
  getKitSamples,
  isDbCorruptionError,
  moveSample,
  updateKit,
  updateVoiceAlias,
} from "../romperDbCoreORM.js";

// Test utilities
const TEST_DB_DIR = path.join(__dirname, "test-data");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "romper.sqlite");

function ensureTestDirClean() {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
}

function cleanupTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

describe("Drizzle ORM Database Operations", () => {
  beforeEach(() => {
    ensureTestDirClean();
  });

  afterEach(() => {
    cleanupTestDb();
  });

  describe("Database Creation", () => {
    it("should create database file successfully", async () => {
      const result = createRomperDbFile(TEST_DB_DIR);

      if (!result.success) {
        console.error("Database creation failed:", result.error);
      }
      expect(result.success).toBe(true);
      expect(result.dbPath).toBe(TEST_DB_PATH);
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it("should handle database creation with existing directory", async () => {
      // Create database once
      const result1 = createRomperDbFile(TEST_DB_DIR);
      expect(result1.success).toBe(true);

      // Should succeed again (overwrite/reuse)
      const result2 = createRomperDbFile(TEST_DB_DIR);
      expect(result2.success).toBe(true);
      expect(result2.dbPath).toBe(TEST_DB_PATH);
    });
  });

  describe("Kit Operations with ORM", () => {
    beforeEach(async () => {
      createRomperDbFile(TEST_DB_DIR);
    });

    it("should insert kit record with editable mode mapping", async () => {
      const testKit: Kit = {
        name: "A0",
        alias: "Test Kit",
        artist: "Test Artist",
        editable: true, // This should map to editable=true in new architecture
        locked: false,
        // step_pattern can be omitted or set to null - JSON mode handles this automatically
      };

      const result = addKit(TEST_DB_DIR, testKit);
      if (!result.success) {
        console.error("Kit insert failed:", result.error);
      }
      expect(result.success).toBe(true);
    });

    it("should create 4 voice records when inserting kit", async () => {
      const testKit: Kit = {
        name: "A1",
        editable: true, // Use the correct schema field name
      };

      const insertResult = addKit(TEST_DB_DIR, testKit);
      expect(insertResult.success).toBe(true);

      // Fetch kit to verify voices were created
      const kitsResult = getKits(TEST_DB_DIR);
      expect(kitsResult.success).toBe(true);

      const kit = kitsResult.data?.find((k) => k.name === "A1");
      expect(kit).toBeDefined();
      expect(kit?.voices).toHaveLength(4); // Should have 4 voice records
      // Note: voice_alias will be null initially since no aliases are set
    });

    it("should handle kit with step pattern correctly", async () => {
      const stepPattern = [
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      ];

      const testKit: Kit = {
        name: "A2",
        editable: true,
        step_pattern: stepPattern,
      };

      const insertResult = addKit(TEST_DB_DIR, testKit);
      expect(insertResult.success).toBe(true);

      const kitsResult = getKits(TEST_DB_DIR);
      expect(kitsResult.success).toBe(true);

      const kit = kitsResult.data?.find((k) => k.name === "A2");
      expect(kit).toBeDefined();
      expect(kit?.step_pattern).toEqual(stepPattern);
    });
  });

  describe("Sample Operations with Reference Architecture", () => {
    beforeEach(async () => {
      await createRomperDbFile(TEST_DB_DIR);

      // Insert a test kit first
      const testKit: Kit = {
        name: "A0",
        editable: true,
      };
      await addKit(TEST_DB_DIR, testKit);
    });

    it("should insert sample record with source_path support", async () => {
      const testSample: Sample = {
        kit_name: "A0",
        filename: "kick.wav",
        voice_number: 1,
        slot_number: 1,
        source_path: "/test/path/kick.wav", // Required field
        is_stereo: false,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      };

      const result = addSample(TEST_DB_DIR, testSample);
      expect(result.success).toBe(true);
      expect(result.data?.sampleId).toBeTypeOf("number");
    });

    it("should fetch samples for kit using ORM", async () => {
      const testSamples: Sample[] = [
        {
          kit_name: "A0",
          filename: "kick.wav",
          voice_number: 1,
          slot_number: 1,
          source_path: "/test/path/kick.wav",
          is_stereo: false,
        },
        {
          kit_name: "A0",
          filename: "snare.wav",
          voice_number: 2,
          slot_number: 1,
          source_path: "/test/path/snare.wav",
          is_stereo: false,
        },
      ];

      // Insert test samples
      for (const sample of testSamples) {
        const result = addSample(TEST_DB_DIR, sample);
        expect(result.success).toBe(true);
      }

      // Fetch samples
      const fetchResult = getKitSamples(TEST_DB_DIR, "A0");
      expect(fetchResult.success).toBe(true);
      expect(fetchResult.data).toHaveLength(2);

      const fetchedSamples = fetchResult.data!;
      expect(fetchedSamples[0].filename).toBe("kick.wav");
      expect(fetchedSamples[1].filename).toBe("snare.wav");
    });

    it("should delete all samples for kit using ORM", async () => {
      // Insert test samples
      const testSamples: Sample[] = [
        {
          kit_name: "A0",
          filename: "kick.wav",
          voice_number: 1,
          slot_number: 1,
          source_path: "/test/path/kick.wav",
          is_stereo: false,
        },
        {
          kit_name: "A0",
          filename: "snare.wav",
          voice_number: 2,
          slot_number: 1,
          source_path: "/test/path/snare.wav",
          is_stereo: false,
        },
        {
          kit_name: "A0",
          filename: "hihat.wav",
          voice_number: 3,
          slot_number: 1,
          source_path: "/test/path/hihat.wav",
          is_stereo: false,
        },
      ];

      for (const sample of testSamples) {
        await addSample(TEST_DB_DIR, sample);
      }

      // Verify samples exist
      const beforeDelete = await getKitSamples(TEST_DB_DIR, "A0");
      expect(beforeDelete.data).toHaveLength(3);

      // Delete all samples
      const deleteResult = deleteSamples(TEST_DB_DIR, "A0");
      expect(deleteResult.success).toBe(true);

      // Verify samples are gone
      const afterDelete = await getKitSamples(TEST_DB_DIR, "A0");
      expect(afterDelete.data).toHaveLength(0);
    });
  });

  describe("Voice Operations with ORM", () => {
    beforeEach(async () => {
      await createRomperDbFile(TEST_DB_DIR);

      const testKit: Kit = { name: "A0", editable: true };
      await addKit(TEST_DB_DIR, testKit);
    });

    it("should update voice alias using ORM", async () => {
      const result = updateVoiceAlias(TEST_DB_DIR, "A0", 1, "Kick");
      expect(result.success).toBe(true);

      // Verify the alias was set
      const kitsResult = getKits(TEST_DB_DIR);
      expect(kitsResult.success).toBe(true);

      const kit = kitsResult.data?.find((k) => k.name === "A0");
      expect(kit).toBeDefined();
      const kickVoice = kit?.voices.find((v) => v.voice_number === 1);
      expect(kickVoice?.voice_alias).toBe("Kick");
    });

    it("should handle multiple voice aliases", async () => {
      const voiceAliases = [
        { voice: 1, alias: "Kick" },
        { voice: 2, alias: "Snare" },
        { voice: 3, alias: "Hi-Hat" },
        { voice: 4, alias: "Percussion" },
      ];

      // Set all voice aliases
      for (const { voice, alias } of voiceAliases) {
        const result = updateVoiceAlias(TEST_DB_DIR, "A0", voice, alias);
        expect(result.success).toBe(true);
      }

      // Verify all aliases were set
      const kitsResult = getKits(TEST_DB_DIR);
      expect(kitsResult.success).toBe(true);

      const kit = kitsResult.data?.find((k) => k.name === "A0");
      expect(kit).toBeDefined();
      const kickVoice = kit?.voices.find((v) => v.voice_number === 1);
      const snareVoice = kit?.voices.find((v) => v.voice_number === 2);
      const hiHatVoice = kit?.voices.find((v) => v.voice_number === 3);
      const percVoice = kit?.voices.find((v) => v.voice_number === 4);
      expect(kickVoice?.voice_alias).toBe("Kick");
      expect(snareVoice?.voice_alias).toBe("Snare");
      expect(hiHatVoice?.voice_alias).toBe("Hi-Hat");
      expect(percVoice?.voice_alias).toBe("Percussion");
    });
  });

  describe("Step Pattern Operations with ORM", () => {
    beforeEach(async () => {
      await createRomperDbFile(TEST_DB_DIR);

      const testKit: Kit = { name: "A0", editable: true };
      await addKit(TEST_DB_DIR, testKit);
    });

    it("should update step pattern using ORM", async () => {
      const newPattern = [
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      ];

      const result = updateKit(TEST_DB_DIR, "A0", { step_pattern: newPattern });
      expect(result.success).toBe(true);

      // Verify pattern was updated
      const kitsResult = getKits(TEST_DB_DIR);
      expect(kitsResult.success).toBe(true);

      const kit = kitsResult.data?.find((k) => k.name === "A0");
      expect(kit).toBeDefined();
      expect(kit?.step_pattern).toEqual(newPattern);
    });

    it("should clear step pattern when undefined", async () => {
      // First set a pattern
      const initialPattern = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ];
      await updateKit(TEST_DB_DIR, "A0", { step_pattern: initialPattern });

      // Then clear it
      const clearResult = updateKit(TEST_DB_DIR, "A0", { step_pattern: null });
      expect(clearResult.success).toBe(true);

      // Verify pattern is cleared (null in DB, which is correct)
      const kitsResult = getKits(TEST_DB_DIR);
      expect(kitsResult.success).toBe(true);

      const kit = kitsResult.data?.find((k) => k.name === "A0");
      expect(kit).toBeDefined();
      expect(kit?.step_pattern).toBeNull(); // Database stores NULL, not undefined
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should detect database corruption errors", () => {
      expect(isDbCorruptionError("file is not a database")).toBe(true);
      expect(isDbCorruptionError("file is encrypted")).toBe(true);
      expect(isDbCorruptionError("malformed database")).toBe(true);
      expect(isDbCorruptionError("some other error")).toBe(false);
    });

    it("should handle operations on non-existent database gracefully", async () => {
      const nonExistentDir = path.join(TEST_DB_DIR, "nonexistent");

      const result = addKit(nonExistentDir, {
        name: "A0",
        editable: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle constraint violations gracefully", async () => {
      await createRomperDbFile(TEST_DB_DIR);

      const testKit: Kit = { name: "A0", editable: true };

      // Insert kit once
      const result1 = await addKit(TEST_DB_DIR, testKit);
      expect(result1.success).toBe(true);

      // Try to insert same kit again (should fail due to primary key constraint)
      const result2 = await addKit(TEST_DB_DIR, testKit);
      expect(result2.success).toBe(false);
      expect(result2.error).toBeDefined();
    });
  });

  describe("Backward Compatibility", () => {
    beforeEach(async () => {
      await createRomperDbFile(TEST_DB_DIR);
    });

    it("should maintain compatibility with existing Kit interface", async () => {
      // Test the simplified Kit interface using editable directly
      const kitRecord: Kit = {
        name: "A0",
        alias: "Old Style",
        editable: true,
        locked: false,
      };

      const result = addKit(TEST_DB_DIR, kitRecord);
      expect(result.success).toBe(true);

      const kitsResult = getKits(TEST_DB_DIR);
      expect(kitsResult.success).toBe(true);

      const kit = kitsResult.data?.find((k) => k.name === "A0");
      expect(kit).toBeDefined();
      expect(kit?.editable).toBe(true); // Using editable directly now
      expect(kit?.alias).toBe("Old Style");
    });

    it("should support legacy sample record format", async () => {
      // Insert a kit first
      const testKit: Kit = { name: "A0", editable: true };
      await addKit(TEST_DB_DIR, testKit);

      // Insert sample using legacy interface
      const legacySample: Sample = {
        kit_name: "A0",
        filename: "legacy_sample.wav",
        voice_number: 1,
        slot_number: 1,
        source_path: "/test/path/legacy_sample.wav",
        is_stereo: false,
      };

      const result = addSample(TEST_DB_DIR, legacySample);
      expect(result.success).toBe(true);

      // Verify sample was inserted correctly
      const samplesResult = getKitSamples(TEST_DB_DIR, "A0");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(1);
      expect(samplesResult.data![0].filename).toBe("legacy_sample.wav");
    });
  });

  describe("Sample Move Operations", () => {
    beforeEach(() => {
      // Create database and kit
      createRomperDbFile(TEST_DB_DIR);
      addKit(TEST_DB_DIR, { name: "TestKit", editable: true, locked: false });

      // Add test samples to voice 1
      const samples = [
        {
          kit_name: "TestKit",
          filename: "sample1.wav",
          voice_number: 1,
          slot_number: 1,
          source_path: "/test/sample1.wav",
          is_stereo: false,
        },
        {
          kit_name: "TestKit",
          filename: "sample2.wav",
          voice_number: 1,
          slot_number: 2,
          source_path: "/test/sample2.wav",
          is_stereo: false,
        },
        {
          kit_name: "TestKit",
          filename: "sample3.wav",
          voice_number: 1,
          slot_number: 3,
          source_path: "/test/sample3.wav",
          is_stereo: false,
        },
        {
          kit_name: "TestKit",
          filename: "sample4.wav",
          voice_number: 1,
          slot_number: 4,
          source_path: "/test/sample4.wav",
          is_stereo: false,
        },
        {
          kit_name: "TestKit",
          filename: "sample5.wav",
          voice_number: 1,
          slot_number: 5,
          source_path: "/test/sample5.wav",
          is_stereo: false,
        },
        {
          kit_name: "TestKit",
          filename: "sample6.wav",
          voice_number: 1,
          slot_number: 6,
          source_path: "/test/sample6.wav",
          is_stereo: false,
        },
      ];

      samples.forEach((sample) => {
        addSample(TEST_DB_DIR, sample);
      });
    });

    it("should move sample within same voice (backward move 6→4)", () => {
      // Initial state: [sample1, sample2, sample3, sample4, sample5, sample6]
      // Move sample6 from slot 6 to slot 4
      // Expected: [sample1, sample2, sample3, sample6, sample4, sample5]

      const result = moveSample(TEST_DB_DIR, "TestKit", 1, 6, 1, 4, "insert");
      expect(result.success).toBe(true);

      // Verify final state
      const samplesResult = getKitSamples(TEST_DB_DIR, "TestKit");
      expect(samplesResult.success).toBe(true);

      const samples = samplesResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(samples).toHaveLength(6);
      expect(samples[0].filename).toBe("sample1.wav"); // slot 1
      expect(samples[1].filename).toBe("sample2.wav"); // slot 2
      expect(samples[2].filename).toBe("sample3.wav"); // slot 3
      expect(samples[3].filename).toBe("sample6.wav"); // slot 4 (moved here)
      expect(samples[4].filename).toBe("sample4.wav"); // slot 5 (shifted from 4)
      expect(samples[5].filename).toBe("sample5.wav"); // slot 6 (shifted from 5)
    });

    it("should move sample within same voice (forward move 2→5)", () => {
      // Initial state: [sample1, sample2, sample3, sample4, sample5, sample6]
      // Move sample2 from slot 2 to slot 5
      // After compaction: [sample1, sample3, sample4, sample2, sample5, sample6]

      const result = moveSample(TEST_DB_DIR, "TestKit", 1, 2, 1, 5, "insert");
      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error(`Forward move failed: ${result.error}`);
      }

      // Verify final state
      const samplesResult = getKitSamples(TEST_DB_DIR, "TestKit");
      expect(samplesResult.success).toBe(true);

      const samples = samplesResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(samples).toHaveLength(6);
      expect(samples[0].filename).toBe("sample1.wav"); // slot 1
      expect(samples[1].filename).toBe("sample3.wav"); // slot 2 (compacted from 3)
      expect(samples[2].filename).toBe("sample4.wav"); // slot 3 (compacted from 4)
      expect(samples[3].filename).toBe("sample2.wav"); // slot 4 (moved here after compaction)
      expect(samples[4].filename).toBe("sample5.wav"); // slot 5 (compacted from 6)
      expect(samples[5].filename).toBe("sample6.wav"); // slot 6 (compacted from 7)
    });

    it("should move sample across voices with source compaction", () => {
      // Add samples to voice 2
      addSample(TEST_DB_DIR, {
        kit_name: "TestKit",
        filename: "voice2_sample1.wav",
        voice_number: 2,
        slot_number: 1,
        source_path: "/test/v2s1.wav",
        is_stereo: false,
      });

      // Move sample4 from voice 1 slot 4 to voice 2 slot 1 (insert mode)
      const result = moveSample(TEST_DB_DIR, "TestKit", 1, 4, 2, 1, "insert");
      expect(result.success).toBe(true);

      // Verify voice 1 was compacted (sample4 removed, others shifted up)
      const voice1Result = getKitSamples(TEST_DB_DIR, "TestKit");
      expect(voice1Result.success).toBe(true);

      const voice1Samples = voice1Result
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice1Samples).toHaveLength(5); // One less sample
      expect(voice1Samples[0].filename).toBe("sample1.wav"); // slot 1
      expect(voice1Samples[1].filename).toBe("sample2.wav"); // slot 2
      expect(voice1Samples[2].filename).toBe("sample3.wav"); // slot 3
      expect(voice1Samples[3].filename).toBe("sample5.wav"); // slot 4 (compacted from 5)
      expect(voice1Samples[4].filename).toBe("sample6.wav"); // slot 5 (compacted from 6)

      // Verify voice 2 received the sample with proper insertion
      const voice2Samples = voice1Result
        .data!.filter((s) => s.voice_number === 2)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice2Samples).toHaveLength(2);
      expect(voice2Samples[0].filename).toBe("sample4.wav"); // slot 1 (inserted)
      expect(voice2Samples[1].filename).toBe("voice2_sample1.wav"); // slot 2 (shifted from 1)
    });
  });
});
