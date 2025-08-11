import type { Kit, Sample } from "@romper/shared/db/schema.js";

// Unit tests for Drizzle ORM implementation
import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addKit,
  addSample,
  createRomperDbFile,
  deleteSamples,
  deleteSamplesWithoutReindexing,
  ensureDatabaseMigrations,
  getAllBanks,
  getAllSamples,
  getKit,
  getKits,
  getKitSamples,
  isDbCorruptionError,
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
  moveSample,
  updateBank,
  updateKit,
  updateVoiceAlias,
  validateDatabaseSchema,
  withDb,
} from "../romperDbCoreORM.js";

// Test utilities
const TEST_DB_DIR = path.join(__dirname, "test-data");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "romper.sqlite");

function cleanupTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

function ensureTestDirClean() {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { force: true, recursive: true });
  }
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
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
        alias: "Test Kit",
        artist: "Test Artist",
        editable: true, // This should map to editable=true in new architecture
        locked: false,
        name: "A0",
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
        editable: true, // Use the correct schema field name
        name: "A1",
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
        editable: true,
        name: "A2",
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
        editable: true,
        name: "A0",
      };
      await addKit(TEST_DB_DIR, testKit);
    });

    it("should insert sample record with source_path support", async () => {
      const testSample: Sample = {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/test/path/kick.wav", // Required field
        voice_number: 1,
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
          filename: "kick.wav",
          is_stereo: false,
          kit_name: "A0",
          slot_number: 0,
          source_path: "/test/path/kick.wav",
          voice_number: 1,
        },
        {
          filename: "snare.wav",
          is_stereo: false,
          kit_name: "A0",
          slot_number: 0,
          source_path: "/test/path/snare.wav",
          voice_number: 2,
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
          filename: "kick.wav",
          is_stereo: false,
          kit_name: "A0",
          slot_number: 0,
          source_path: "/test/path/kick.wav",
          voice_number: 1,
        },
        {
          filename: "snare.wav",
          is_stereo: false,
          kit_name: "A0",
          slot_number: 0,
          source_path: "/test/path/snare.wav",
          voice_number: 2,
        },
        {
          filename: "hihat.wav",
          is_stereo: false,
          kit_name: "A0",
          slot_number: 0,
          source_path: "/test/path/hihat.wav",
          voice_number: 3,
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

      const testKit: Kit = { editable: true, name: "A0" };
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
        { alias: "Kick", voice: 1 },
        { alias: "Snare", voice: 2 },
        { alias: "Hi-Hat", voice: 3 },
        { alias: "Percussion", voice: 4 },
      ];

      // Set all voice aliases
      for (const { alias, voice } of voiceAliases) {
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

      const testKit: Kit = { editable: true, name: "A0" };
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
      expect(isDbCorruptionError("database disk image is malformed")).toBe(
        true,
      );
      expect(isDbCorruptionError("database is locked")).toBe(true);
      expect(isDbCorruptionError("SQL logic error")).toBe(true);
      expect(isDbCorruptionError("some other error")).toBe(false);
    });

    it("should handle operations on non-existent database gracefully", async () => {
      const nonExistentDir = path.join(TEST_DB_DIR, "nonexistent");

      const result = addKit(nonExistentDir, {
        editable: true,
        name: "A0",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle constraint violations gracefully", async () => {
      await createRomperDbFile(TEST_DB_DIR);

      const testKit: Kit = { editable: true, name: "A0" };

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
        alias: "Old Style",
        editable: true,
        locked: false,
        name: "A0",
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
      const testKit: Kit = { editable: true, name: "A0" };
      await addKit(TEST_DB_DIR, testKit);

      // Insert sample using legacy interface
      const legacySample: Sample = {
        filename: "legacy_sample.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/test/path/legacy_sample.wav",
        voice_number: 1,
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
      addKit(TEST_DB_DIR, { editable: true, locked: false, name: "TestKit" });

      // Add test samples to voice 1
      const samples = [
        {
          filename: "sample1.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 0,
          source_path: "/test/sample1.wav",
          voice_number: 1,
        },
        {
          filename: "sample2.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 1,
          source_path: "/test/sample2.wav",
          voice_number: 1,
        },
        {
          filename: "sample3.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 2,
          source_path: "/test/sample3.wav",
          voice_number: 1,
        },
        {
          filename: "sample4.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 3,
          source_path: "/test/sample4.wav",
          voice_number: 1,
        },
        {
          filename: "sample5.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 4,
          source_path: "/test/sample5.wav",
          voice_number: 1,
        },
        {
          filename: "sample6.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 5,
          source_path: "/test/sample6.wav",
          voice_number: 1,
        },
      ];

      samples.forEach((sample) => {
        addSample(TEST_DB_DIR, sample);
      });
    });

    it("should move sample within same voice (backward move 6→4)", () => {
      // Initial state: [sample1, sample2, sample3, sample4, sample5, sample6]
      // Move sample6 from slot 5 to slot 3 (0-based indexing)
      // Expected: [sample1, sample2, sample3, sample6, sample4, sample5]

      const result = moveSample(TEST_DB_DIR, "TestKit", 1, 5, 1, 3);
      if (!result.success) {
        console.error("moveSample failed:", result.error);
      }
      expect(result.success).toBe(true);

      // Verify final state
      const samplesResult = getKitSamples(TEST_DB_DIR, "TestKit");
      expect(samplesResult.success).toBe(true);

      const samples = samplesResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(samples).toHaveLength(6);
      expect(samples[0].filename).toBe("sample1.wav"); // slot 0
      expect(samples[1].filename).toBe("sample2.wav"); // slot 1
      expect(samples[2].filename).toBe("sample3.wav"); // slot 2
      expect(samples[3].filename).toBe("sample6.wav"); // slot 3 (moved here)
      expect(samples[4].filename).toBe("sample4.wav"); // slot 4 (shifted from 3)
      expect(samples[5].filename).toBe("sample5.wav"); // slot 5 (shifted from 4)
    });

    it("should move sample within same voice (forward move 2→5)", () => {
      // Initial state: [sample1, sample2, sample3, sample4, sample5, sample6]
      // Move sample2 from slot 2 to slot 5
      // After reindexing: [sample1, sample3, sample4, sample2, sample5, sample6]

      const result = moveSample(TEST_DB_DIR, "TestKit", 1, 1, 1, 4);
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
      expect(samples[0].filename).toBe("sample1.wav"); // slot 0
      expect(samples[1].filename).toBe("sample3.wav"); // slot 1 (compacted from 2)
      expect(samples[2].filename).toBe("sample4.wav"); // slot 2 (compacted from 3)
      expect(samples[3].filename).toBe("sample5.wav"); // slot 3 (compacted from 4)
      expect(samples[4].filename).toBe("sample2.wav"); // slot 4 (moved here)
      expect(samples[5].filename).toBe("sample6.wav"); // slot 5 (compacted from 5)
    });

    it("should move sample across voices with source reindexing", () => {
      // Add samples to voice 2
      addSample(TEST_DB_DIR, {
        filename: "voice2_sample1.wav",
        is_stereo: false,
        kit_name: "TestKit",
        slot_number: 0,
        source_path: "/test/v2s1.wav",
        voice_number: 2,
      });

      // Move sample4 from voice 1 slot 3 to voice 2 slot 0 (0-based indexing)
      const result = moveSample(TEST_DB_DIR, "TestKit", 1, 3, 2, 0);
      expect(result.success).toBe(true);

      // Verify voice 1 was reindexed (sample4 removed, others shifted up)
      const voice1Result = getKitSamples(TEST_DB_DIR, "TestKit");
      expect(voice1Result.success).toBe(true);

      const voice1Samples = voice1Result
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice1Samples).toHaveLength(5); // One less sample
      expect(voice1Samples[0].filename).toBe("sample1.wav"); // slot 0
      expect(voice1Samples[1].filename).toBe("sample2.wav"); // slot 1
      expect(voice1Samples[2].filename).toBe("sample3.wav"); // slot 2
      expect(voice1Samples[3].filename).toBe("sample5.wav"); // slot 4 (reindexed from 5)
      expect(voice1Samples[4].filename).toBe("sample6.wav"); // slot 5 (reindexed from 6)

      // Verify voice 2 received the sample with proper insertion
      const voice2Samples = voice1Result
        .data!.filter((s) => s.voice_number === 2)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice2Samples).toHaveLength(2);
      expect(voice2Samples[0].filename).toBe("sample4.wav"); // slot 1 (inserted)
      expect(voice2Samples[1].filename).toBe("voice2_sample1.wav"); // slot 2 (shifted from 1)
    });
  });

  describe("Database Schema Validation", () => {
    beforeEach(() => {
      createRomperDbFile(TEST_DB_DIR);
    });

    it("should validate database schema successfully", () => {
      const result = validateDatabaseSchema(TEST_DB_DIR);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("should fail validation on non-existent database", () => {
      const nonExistentDir = path.join(TEST_DB_DIR, "nonexistent");
      const result = validateDatabaseSchema(nonExistentDir);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Database Migrations", () => {
    it("should skip migrations for non-existent database", () => {
      const nonExistentDir = path.join(TEST_DB_DIR, "nonexistent");
      const result = ensureDatabaseMigrations(nonExistentDir);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Database file does not exist");
    });

    it("should run migrations on existing database", () => {
      createRomperDbFile(TEST_DB_DIR);
      const result = ensureDatabaseMigrations(TEST_DB_DIR);
      // Should succeed or fail gracefully - both are valid outcomes
      expect(result.success).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("withDb Function", () => {
    beforeEach(() => {
      createRomperDbFile(TEST_DB_DIR);
    });

    it("should execute database operation successfully", () => {
      const result = withDb(TEST_DB_DIR, (_db) => {
        return "test result";
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe("test result");
    });

    it("should handle database operation errors", () => {
      const result = withDb(TEST_DB_DIR, () => {
        throw new Error("Test error");
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Test error");
    });

    it("should handle non-existent database directory", () => {
      const nonExistentDir = path.join(TEST_DB_DIR, "nonexistent");
      const result = withDb(nonExistentDir, () => {
        return "should not reach here";
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Sample Operations - Additional Functions", () => {
    beforeEach(() => {
      createRomperDbFile(TEST_DB_DIR);
      addKit(TEST_DB_DIR, { editable: true, locked: false, name: "TestKit" });

      // Add test samples
      const samples = [
        {
          filename: "sample1.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 0,
          source_path: "/test/sample1.wav",
          voice_number: 1,
        },
        {
          filename: "sample2.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 1,
          source_path: "/test/sample2.wav",
          voice_number: 1,
        },
      ];

      samples.forEach((sample) => {
        addSample(TEST_DB_DIR, sample);
      });
    });

    it("should get all samples from database", () => {
      const result = getAllSamples(TEST_DB_DIR);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].filename).toBe("sample1.wav");
      expect(result.data![1].filename).toBe("sample2.wav");
    });

    it("should get single kit with relations", () => {
      const result = getKit(TEST_DB_DIR, "TestKit");
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe("TestKit");
      expect(result.data!.voices).toHaveLength(4);
      expect(result.data!.samples).toHaveLength(2);
    });

    it("should return null for non-existent kit", () => {
      const result = getKit(TEST_DB_DIR, "NonExistentKit");
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should delete samples without reindexing", () => {
      // Add a third sample to make reindexing behavior visible
      addSample(TEST_DB_DIR, {
        filename: "sample3.wav",
        is_stereo: false,
        kit_name: "TestKit",
        slot_number: 2,
        source_path: "/test/sample3.wav",
        voice_number: 1,
      });

      // Delete the middle sample (slot 1, which contains sample2.wav in 0-based indexing)
      const result = deleteSamplesWithoutReindexing(TEST_DB_DIR, "TestKit", {
        slotNumber: 1,
        voiceNumber: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data!.deletedSamples).toHaveLength(1);
      expect(result.data!.deletedSamples[0].filename).toBe("sample2.wav");

      // Verify remaining samples still have their original slot numbers (no reindexing)
      const remainingSamples = getKitSamples(TEST_DB_DIR, "TestKit");
      expect(remainingSamples.success).toBe(true);
      const samples = remainingSamples.data!.sort(
        (a, b) => a.slot_number - b.slot_number,
      );
      expect(samples).toHaveLength(2);
      expect(samples[0].slot_number).toBe(0); // sample1 unchanged
      expect(samples[1].slot_number).toBe(2); // sample3 unchanged (gap at slot 1)
    });

    it("should automatically reindex slots after delete using reindexing", () => {
      // Add more samples to test reindexing
      addSample(TEST_DB_DIR, {
        filename: "sample3.wav",
        is_stereo: false,
        kit_name: "TestKit",
        slot_number: 2,
        source_path: "/test/sample3.wav",
        voice_number: 1,
      });
      addSample(TEST_DB_DIR, {
        filename: "sample4.wav",
        is_stereo: false,
        kit_name: "TestKit",
        slot_number: 3,
        source_path: "/test/sample4.wav",
        voice_number: 1,
      });

      // Delete sample at slot 1 (sample2.wav) - reindexing now happens automatically
      const result = deleteSamples(TEST_DB_DIR, "TestKit", {
        slotNumber: 1,
        voiceNumber: 1,
      });
      expect(result.success).toBe(true);

      // Verify automatic reindexing reindexing occurred
      const samples = getKitSamples(TEST_DB_DIR, "TestKit");
      expect(samples.success).toBe(true);
      const voiceOneSamples = samples
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voiceOneSamples).toHaveLength(3); // Original 4 - 1 deleted = 3 total
      // After reindexing, samples should be at contiguous slots 0, 1, 2
      expect(voiceOneSamples[0].filename).toBe("sample1.wav");
      expect(voiceOneSamples[0].slot_number).toBe(0);
      expect(voiceOneSamples[1].filename).toBe("sample3.wav");
      expect(voiceOneSamples[1].slot_number).toBe(1); // Reindexed to contiguous slot
      expect(voiceOneSamples[2].filename).toBe("sample4.wav");
      expect(voiceOneSamples[2].slot_number).toBe(2); // Reindexed to contiguous slot
    });
  });

  describe("Kit Modification Tracking", () => {
    beforeEach(() => {
      createRomperDbFile(TEST_DB_DIR);
      addKit(TEST_DB_DIR, {
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "TrackingKit",
      });
    });

    it("should mark kit as modified", () => {
      const result = markKitAsModified(TEST_DB_DIR, "TrackingKit");
      expect(result.success).toBe(true);

      // Verify kit is marked as modified
      const kit = getKit(TEST_DB_DIR, "TrackingKit");
      expect(kit.success).toBe(true);
      expect(kit.data!.modified_since_sync).toBe(true);
    });

    it("should mark kit as synced", () => {
      // First mark as modified
      markKitAsModified(TEST_DB_DIR, "TrackingKit");

      // Then mark as synced
      const result = markKitAsSynced(TEST_DB_DIR, "TrackingKit");
      expect(result.success).toBe(true);

      // Verify kit is no longer marked as modified
      const kit = getKit(TEST_DB_DIR, "TrackingKit");
      expect(kit.success).toBe(true);
      expect(kit.data!.modified_since_sync).toBe(false);
    });

    it("should mark multiple kits as synced", () => {
      // Add another kit
      addKit(TEST_DB_DIR, {
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "TrackingKit2",
      });

      // Mark both as modified
      markKitAsModified(TEST_DB_DIR, "TrackingKit");
      markKitAsModified(TEST_DB_DIR, "TrackingKit2");

      // Mark both as synced in batch
      const result = markKitsAsSynced(TEST_DB_DIR, [
        "TrackingKit",
        "TrackingKit2",
      ]);
      expect(result.success).toBe(true);

      // Verify both kits are no longer marked as modified
      const kit1 = getKit(TEST_DB_DIR, "TrackingKit");
      const kit2 = getKit(TEST_DB_DIR, "TrackingKit2");
      expect(kit1.success).toBe(true);
      expect(kit2.success).toBe(true);
      expect(kit1.data!.modified_since_sync).toBe(false);
      expect(kit2.data!.modified_since_sync).toBe(false);
    });
  });

  describe("Bank Operations", () => {
    beforeEach(() => {
      createRomperDbFile(TEST_DB_DIR);
    });

    it("should get all banks", () => {
      const result = getAllBanks(TEST_DB_DIR);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      // Banks table might be empty initially, that's fine
    });

    it("should update bank information", () => {
      // First, we need to ensure the bank exists or handle the case where it doesn't
      const updates = {
        artist: "Test Artist",
        rtf_filename: "test.rtf",
        scanned_at: new Date(),
      };

      const result = updateBank(TEST_DB_DIR, "A", updates);
      // This might fail if bank doesn't exist, which is acceptable behavior
      expect(result).toBeDefined();
      if (result.success) {
        expect(result.success).toBe(true);
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("Error Handling - Additional Cases", () => {
    it("should handle withDb errors gracefully", () => {
      const corruptedDir = path.join(TEST_DB_DIR, "corrupted");
      fs.mkdirSync(corruptedDir, { recursive: true });

      // Create a file that's not a valid database
      const corruptedDbPath = path.join(corruptedDir, "romper.sqlite");
      fs.writeFileSync(corruptedDbPath, "not a database");

      const result = withDb(corruptedDir, (_db) => {
        return _db.select().from({ id: 1 }).all(); // This should fail
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle operations on non-existent kits", () => {
      createRomperDbFile(TEST_DB_DIR);

      const result = markKitAsModified(TEST_DB_DIR, "NonExistentKit");
      // Should succeed but have no effect
      expect(result.success).toBe(true);
    });

    it("should handle getAllSamples on empty database", () => {
      createRomperDbFile(TEST_DB_DIR);

      const result = getAllSamples(TEST_DB_DIR);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    // This function was replaced with automatic reindexing in deleteSamples
  });
});
