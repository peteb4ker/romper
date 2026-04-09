import type { NewKit } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InMemorySettings } from "../../types/settings.js";

import { deleteDbFileWithRetry } from "../../db/fileOperations.js";
import {
  addKit,
  createRomperDbFile,
  getKit,
  getKitSamples,
} from "../../db/romperDbCoreORM.js";
import { SampleService } from "../sampleService.js";

// Test utilities
const TEST_DB_DIR = path.join(__dirname, "test-data-sample-svc");
const TEST_LOCAL_STORE_PATH = TEST_DB_DIR;
const TEST_DB_PATH = path.join(TEST_DB_DIR, ".romperdb");

async function cleanupSqliteFiles(dir: string) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await cleanupSqliteFiles(fullPath);
    } else if (entry.name.endsWith(".sqlite")) {
      try {
        await deleteDbFileWithRetry(fullPath);
      } catch (error) {
        console.warn(`Failed to delete SQLite file ${fullPath}:`, error);
      }
    }
  }
}

/**
 * Create a minimal valid WAV file for testing
 * WAV header: RIFF + size + WAVE + fmt chunk + data chunk
 */
function createTestWavFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Minimal WAV file: 44-byte header + 4 bytes of silence
  const sampleRate = 44100;
  const bitsPerSample = 16;
  const numChannels = 1;
  const dataSize = 4; // 4 bytes of audio data (minimal)
  const fmtChunkSize = 16;
  const headerSize = 44;
  const fileSize = headerSize + dataSize - 8;

  const buffer = Buffer.alloc(headerSize + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(fileSize, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;

  // fmt sub-chunk
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(fmtChunkSize, offset);
  offset += 4;
  buffer.writeUInt16LE(1, offset); // PCM format
  offset += 2;
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset); // byte rate
  offset += 4;
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), offset); // block align
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data sub-chunk
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);
  // Remaining bytes are zero (silence)

  fs.writeFileSync(filePath, buffer);
}

describe("SampleService Integration Tests", () => {
  let sampleService: SampleService;
  let mockInMemorySettings: InMemorySettings;
  let testWavDir: string;

  beforeEach(async () => {
    // Ensure test directory exists
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    // Clean up any existing test databases
    await cleanupSqliteFiles(TEST_DB_DIR);

    // Create fresh database
    createRomperDbFile(TEST_DB_PATH);

    sampleService = new SampleService();
    mockInMemorySettings = {
      localStorePath: TEST_LOCAL_STORE_PATH,
    };

    // Create test WAV directory
    testWavDir = path.join(TEST_DB_DIR, "test-wavs");
    if (!fs.existsSync(testWavDir)) {
      fs.mkdirSync(testWavDir, { recursive: true });
    }

    // Create a test kit
    const kitRecord: NewKit = {
      alias: "Test Kit",
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: "1010101010101010",
    };
    addKit(TEST_DB_PATH, kitRecord);
  });

  afterEach(async () => {
    await cleanupSqliteFiles(TEST_DB_DIR);
    // Clean up test WAV files
    if (fs.existsSync(testWavDir)) {
      fs.rmSync(testWavDir, { force: true, recursive: true });
    }
  });

  describe("addSampleToSlot", () => {
    it("should add a sample to an empty slot", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
        wavPath,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.sampleId).toBeGreaterThan(0);

      // Verify the sample was stored correctly in the database
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(1);
      expect(samplesResult.data![0].filename).toBe("kick.wav");
      expect(samplesResult.data![0].voice_number).toBe(1);
      expect(samplesResult.data![0].slot_number).toBe(0);
      expect(samplesResult.data![0].source_path).toBe(wavPath);
    });

    it("should add samples to multiple voice slots", () => {
      const wavPath1 = path.join(testWavDir, "kick.wav");
      const wavPath2 = path.join(testWavDir, "snare.wav");
      const wavPath3 = path.join(testWavDir, "hat.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);
      createTestWavFile(wavPath3);

      const result1 = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
        wavPath1,
      );
      const result2 = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        1,
        1,
        wavPath2,
      );
      const result3 = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        2,
        0,
        wavPath3,
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(3);
    });

    it("should mark kit as modified after adding a sample", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      // Verify kit starts as not modified
      const kitBefore = getKit(TEST_DB_PATH, "A1");
      expect(kitBefore.data!.modified_since_sync).toBe(false);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      // Verify kit is now marked as modified
      const kitAfter = getKit(TEST_DB_PATH, "A1");
      expect(kitAfter.data!.modified_since_sync).toBe(true);
    });

    it("should reject invalid voice number", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        5, // Invalid: max is 4
        0,
        wavPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Voice number must be between 1 and 4");
    });

    it("should reject invalid slot number", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        1,
        12, // Invalid: max is 11 (0-indexed)
        wavPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Slot index must be between 0 and 11");
    });

    it("should reject non-WAV file", () => {
      const mp3Path = path.join(testWavDir, "test.mp3");
      fs.writeFileSync(mp3Path, "fake mp3 data");

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
        mp3Path,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Only WAV files are supported");
    });

    it("should reject non-existent file", () => {
      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
        "/nonexistent/path/to/file.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Sample file not found");
    });

    it("should fail when no local store path is configured", () => {
      const emptySettings: InMemorySettings = {
        localStorePath: null,
      };

      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      const result = sampleService.addSampleToSlot(
        emptySettings,
        "A1",
        1,
        0,
        wavPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });
  });

  describe("replaceSampleInSlot", () => {
    it("should replace an existing sample in a slot", () => {
      const wavPath1 = path.join(testWavDir, "kick.wav");
      const wavPath2 = path.join(testWavDir, "snare.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);

      // Add initial sample
      const addResult = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
        wavPath1,
      );
      expect(addResult.success).toBe(true);

      // Replace with different sample
      const replaceResult = sampleService.replaceSampleInSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
        wavPath2,
      );
      expect(replaceResult.success).toBe(true);

      // Verify the replacement
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(1);
      expect(samplesResult.data![0].filename).toBe("snare.wav");
      expect(samplesResult.data![0].source_path).toBe(wavPath2);
    });

    it("should not affect other samples when replacing", () => {
      const wavPath1 = path.join(testWavDir, "kick.wav");
      const wavPath2 = path.join(testWavDir, "snare.wav");
      const wavPath3 = path.join(testWavDir, "hat.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);
      createTestWavFile(wavPath3);

      // Add two samples
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath1);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 1, wavPath2);

      // Replace slot 0 only
      sampleService.replaceSampleInSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
        wavPath3,
      );

      // Verify slot 0 was replaced, slot 1 unchanged
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.data).toHaveLength(2);

      const voice1 = samplesResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice1[0].filename).toBe("hat.wav");
      expect(voice1[1].filename).toBe("snare.wav");
    });
  });

  describe("deleteSampleFromSlot", () => {
    it("should delete a sample and reindex remaining slots", () => {
      const wavPath1 = path.join(testWavDir, "s0.wav");
      const wavPath2 = path.join(testWavDir, "s1.wav");
      const wavPath3 = path.join(testWavDir, "s2.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);
      createTestWavFile(wavPath3);

      // Add three samples to voice 1
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath1);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 1, wavPath2);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 2, wavPath3);

      // Delete middle sample (slot 1)
      const deleteResult = sampleService.deleteSampleFromSlot(
        mockInMemorySettings,
        "A1",
        1,
        1,
      );

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.data!.deletedSamples).toHaveLength(1);

      // After reindexing, remaining samples should be contiguous at slots 0 and 1
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      const voice1 = samplesResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice1).toHaveLength(2);
      expect(voice1[0].filename).toBe("s0.wav");
      expect(voice1[1].filename).toBe("s2.wav");
      expect(voice1.map((s) => s.slot_number)).toEqual([0, 1]);
    });

    it("should fail when deleting from an empty slot", () => {
      const result = sampleService.deleteSampleFromSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No sample found");
    });

    it("should mark kit as modified after deletion", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      // Reset modified flag by re-reading
      const kitBefore = getKit(TEST_DB_PATH, "A1");
      expect(kitBefore.data!.modified_since_sync).toBe(true);

      const deleteResult = sampleService.deleteSampleFromSlot(
        mockInMemorySettings,
        "A1",
        1,
        0,
      );

      expect(deleteResult.success).toBe(true);

      // Kit should still be marked as modified
      const kitAfter = getKit(TEST_DB_PATH, "A1");
      expect(kitAfter.data!.modified_since_sync).toBe(true);
    });

    it("should not affect samples in other voices when deleting", () => {
      const wavPath1 = path.join(testWavDir, "v1.wav");
      const wavPath2 = path.join(testWavDir, "v2.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath1);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 2, 0, wavPath2);

      // Delete from voice 1
      sampleService.deleteSampleFromSlot(mockInMemorySettings, "A1", 1, 0);

      // Voice 2 should be unaffected
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.data).toHaveLength(1);
      expect(samplesResult.data![0].voice_number).toBe(2);
      expect(samplesResult.data![0].filename).toBe("v2.wav");
    });
  });

  describe("deleteSampleFromSlotWithoutReindexing", () => {
    it("should delete a sample without reindexing remaining slots", () => {
      const wavPath1 = path.join(testWavDir, "s0.wav");
      const wavPath2 = path.join(testWavDir, "s1.wav");
      const wavPath3 = path.join(testWavDir, "s2.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);
      createTestWavFile(wavPath3);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath1);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 1, wavPath2);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 2, wavPath3);

      // Delete middle sample without reindexing
      const deleteResult = sampleService.deleteSampleFromSlotWithoutReindexing(
        mockInMemorySettings,
        "A1",
        1,
        1,
      );

      expect(deleteResult.success).toBe(true);

      // Remaining samples should have a gap at slot 1
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      const voice1 = samplesResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice1).toHaveLength(2);
      expect(voice1[0].slot_number).toBe(0);
      expect(voice1[1].slot_number).toBe(2); // Gap at slot 1
    });
  });

  describe("moveSampleInKit", () => {
    it("should move a sample from one voice to another within the same kit", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      // Add sample to voice 1, slot 0
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      // Move to voice 2, slot 0
      const moveResult = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "A1",
        1,
        0,
        2,
        0,
        "insert",
      );

      expect(moveResult.success).toBe(true);
      expect(moveResult.data).toBeTruthy();
      expect(moveResult.data!.movedSample).toBeTruthy();

      // Verify sample is now in voice 2
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.data).toHaveLength(1);
      expect(samplesResult.data![0].voice_number).toBe(2);
      expect(samplesResult.data![0].slot_number).toBe(0);
      expect(samplesResult.data![0].filename).toBe("kick.wav");
    });

    it("should move a sample within the same voice to a different slot", () => {
      const wavPath1 = path.join(testWavDir, "s0.wav");
      const wavPath2 = path.join(testWavDir, "s1.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath1);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 1, wavPath2);

      // Move slot 0 to slot 1 (should shift slot 1 down)
      const moveResult = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "A1",
        1,
        0,
        1,
        1,
        "insert",
      );

      expect(moveResult.success).toBe(true);

      // Verify the reordering
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      const voice1 = samplesResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice1).toHaveLength(2);
    });

    it("should fail when source slot is empty", () => {
      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "A1",
        1,
        0,
        2,
        0,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No sample found");
    });

    it("should fail when moving to the same position", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "A1",
        1,
        0,
        1,
        0,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot move sample to the same position");
    });

    it("should mark kit as modified after move", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      sampleService.moveSampleInKit(
        mockInMemorySettings,
        "A1",
        1,
        0,
        2,
        0,
        "insert",
      );

      const kit = getKit(TEST_DB_PATH, "A1");
      expect(kit.data!.modified_since_sync).toBe(true);
    });
  });

  describe("moveSampleBetweenKits", () => {
    beforeEach(() => {
      // Create a second kit for cross-kit moves
      const kit2: NewKit = {
        alias: "Test Kit B",
        bank_letter: "B",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "B1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kit2);
    });

    it("should move a sample from one kit to another", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      // Add sample to kit A1
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      // Move to kit B1
      const moveResult = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        {
          fromKit: "A1",
          fromSlot: 0,
          fromVoice: 1,
          mode: "insert",
          toKit: "B1",
          toSlot: 0,
          toVoice: 1,
        },
      );

      expect(moveResult.success).toBe(true);
      expect(moveResult.data!.movedSample).toBeTruthy();

      // Source kit should be empty
      const sourceResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(sourceResult.data).toHaveLength(0);

      // Destination kit should have the sample
      const destResult = getKitSamples(TEST_DB_PATH, "B1");
      expect(destResult.data).toHaveLength(1);
      expect(destResult.data![0].filename).toBe("kick.wav");
      expect(destResult.data![0].kit_name).toBe("B1");
    });

    it("should reindex source kit after cross-kit move", () => {
      const wavPath1 = path.join(testWavDir, "s0.wav");
      const wavPath2 = path.join(testWavDir, "s1.wav");
      const wavPath3 = path.join(testWavDir, "s2.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);
      createTestWavFile(wavPath3);

      // Add three samples to source kit
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath1);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 1, wavPath2);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 2, wavPath3);

      // Move middle sample to kit B1
      sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "A1",
        fromSlot: 1,
        fromVoice: 1,
        mode: "insert",
        toKit: "B1",
        toSlot: 0,
        toVoice: 1,
      });

      // Source kit should have reindexed slots (no gap)
      const sourceResult = getKitSamples(TEST_DB_PATH, "A1");
      const voice1 = sourceResult
        .data!.filter((s) => s.voice_number === 1)
        .sort((a, b) => a.slot_number - b.slot_number);

      expect(voice1).toHaveLength(2);
      expect(voice1[0].filename).toBe("s0.wav");
      expect(voice1[1].filename).toBe("s2.wav");
      expect(voice1.map((s) => s.slot_number)).toEqual([0, 1]);
    });

    it("should fail when source sample does not exist", () => {
      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "A1",
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toKit: "B1",
        toSlot: 0,
        toVoice: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No sample found");
    });

    it("should fail with invalid voice/slot parameters", () => {
      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "A1",
        fromSlot: 0,
        fromVoice: 5, // Invalid voice
        mode: "insert",
        toKit: "B1",
        toSlot: 0,
        toVoice: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Voice number must be between 1 and 4");
    });
  });

  describe("validateVoiceAndSlot", () => {
    it("should accept valid voice and slot combinations", () => {
      expect(sampleService.validateVoiceAndSlot(1, 0).isValid).toBe(true);
      expect(sampleService.validateVoiceAndSlot(4, 11).isValid).toBe(true);
      expect(sampleService.validateVoiceAndSlot(2, 5).isValid).toBe(true);
    });

    it("should reject voice number below 1", () => {
      const result = sampleService.validateVoiceAndSlot(0, 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Voice number must be between 1 and 4");
    });

    it("should reject voice number above 4", () => {
      const result = sampleService.validateVoiceAndSlot(5, 0);
      expect(result.isValid).toBe(false);
    });

    it("should reject negative slot number", () => {
      const result = sampleService.validateVoiceAndSlot(1, -1);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Slot index must be between 0 and 11");
    });

    it("should reject slot number >= 12", () => {
      const result = sampleService.validateVoiceAndSlot(1, 12);
      expect(result.isValid).toBe(false);
    });
  });

  describe("validateSampleFile", () => {
    it("should accept a valid WAV file", () => {
      const wavPath = path.join(testWavDir, "valid.wav");
      createTestWavFile(wavPath);

      const result = sampleService.validateSampleFile(wavPath);
      expect(result.isValid).toBe(true);
    });

    it("should reject a file that does not exist", () => {
      const result = sampleService.validateSampleFile("/nonexistent/file.wav");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Sample file not found");
    });

    it("should reject a non-WAV file extension", () => {
      const mp3Path = path.join(testWavDir, "test.mp3");
      fs.writeFileSync(mp3Path, "fake data");

      const result = sampleService.validateSampleFile(mp3Path);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Only WAV files are supported");
    });

    it("should reject a file too small to be a valid WAV", () => {
      const tinyPath = path.join(testWavDir, "tiny.wav");
      fs.writeFileSync(tinyPath, Buffer.alloc(10)); // Less than 44 bytes

      const result = sampleService.validateSampleFile(tinyPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("File too small to be a valid WAV file");
    });

    it("should reject a file with wrong RIFF signature", () => {
      const fakePath = path.join(testWavDir, "fake.wav");
      const buffer = Buffer.alloc(48);
      buffer.write("NOPE", 0); // Wrong RIFF signature
      fs.writeFileSync(fakePath, buffer);

      const result = sampleService.validateSampleFile(fakePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("missing RIFF signature");
    });

    it("should reject a file with RIFF but missing WAVE format", () => {
      const fakePath = path.join(testWavDir, "notwave.wav");
      const buffer = Buffer.alloc(48);
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(40, 4);
      buffer.write("AVI ", 8); // Not WAVE
      fs.writeFileSync(fakePath, buffer);

      const result = sampleService.validateSampleFile(fakePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("missing WAVE format identifier");
    });
  });

  describe("validateSampleSources", () => {
    it("should validate all sample sources in a kit", () => {
      const wavPath1 = path.join(testWavDir, "kick.wav");
      const wavPath2 = path.join(testWavDir, "snare.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath1);
      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 1, wavPath2);

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "A1",
      );

      expect(result.success).toBe(true);
      expect(result.data!.totalSamples).toBe(2);
      expect(result.data!.validSamples).toBe(2);
      expect(result.data!.invalidSamples).toHaveLength(0);
    });

    it("should detect samples with missing source files", () => {
      // Directly add sample records with paths that will be deleted
      const wavPath = path.join(testWavDir, "temporary.wav");
      createTestWavFile(wavPath);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      // Delete the source file after adding the sample record
      fs.unlinkSync(wavPath);

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "A1",
      );

      expect(result.success).toBe(true);
      expect(result.data!.totalSamples).toBe(1);
      expect(result.data!.validSamples).toBe(0);
      expect(result.data!.invalidSamples).toHaveLength(1);
      expect(result.data!.invalidSamples[0].error).toContain(
        "Sample file not found",
      );
    });

    it("should return valid result for kit with no samples", () => {
      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "A1",
      );

      expect(result.success).toBe(true);
      expect(result.data!.totalSamples).toBe(0);
      expect(result.data!.validSamples).toBe(0);
      expect(result.data!.invalidSamples).toHaveLength(0);
    });

    it("should fail when no local store path is configured", () => {
      const emptySettings: InMemorySettings = {
        localStorePath: null,
      };

      const result = sampleService.validateSampleSources(emptySettings, "A1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });
  });

  describe("findNextAvailableSlot", () => {
    it("should return 0 for an empty voice", () => {
      const result = sampleService.findNextAvailableSlot(1, []);
      expect(result).toBe(0);
    });

    it("should return the next slot after contiguous samples", () => {
      const samples = [
        {
          filename: "s0.wav",
          id: 1,
          is_stereo: false,
          kit_name: "A1",
          slot_number: 0,
          source_path: "/path/s0.wav",
          voice_number: 1,
          wav_bit_depth: null,
          wav_bitrate: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
        {
          filename: "s1.wav",
          id: 2,
          is_stereo: false,
          kit_name: "A1",
          slot_number: 1,
          source_path: "/path/s1.wav",
          voice_number: 1,
          wav_bit_depth: null,
          wav_bitrate: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
      ];

      const result = sampleService.findNextAvailableSlot(1, samples);
      expect(result).toBe(2);
    });

    it("should ignore samples from other voices", () => {
      const samples = [
        {
          filename: "s0.wav",
          id: 1,
          is_stereo: false,
          kit_name: "A1",
          slot_number: 0,
          source_path: "/path/s0.wav",
          voice_number: 2, // Different voice
          wav_bit_depth: null,
          wav_bitrate: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
      ];

      const result = sampleService.findNextAvailableSlot(1, samples);
      expect(result).toBe(0); // Voice 1 is empty
    });
  });

  describe("validateSlotBoundary", () => {
    it("should allow moving to the next available slot", () => {
      const samples = [
        {
          filename: "s0.wav",
          id: 1,
          is_stereo: false,
          kit_name: "A1",
          slot_number: 0,
          source_path: "/path/s0.wav",
          voice_number: 1,
          wav_bit_depth: null,
          wav_bitrate: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
      ];

      const result = sampleService.validateSlotBoundary(1, 1, samples);
      expect(result.success).toBe(true);
    });

    it("should reject moving beyond the next available slot", () => {
      const samples = [
        {
          filename: "s0.wav",
          id: 1,
          is_stereo: false,
          kit_name: "A1",
          slot_number: 0,
          source_path: "/path/s0.wav",
          voice_number: 1,
          wav_bit_depth: null,
          wav_bitrate: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
      ];

      const result = sampleService.validateSlotBoundary(1, 5, samples);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot move to slot");
    });

    it("should allow slot 0 for an empty voice", () => {
      const result = sampleService.validateSlotBoundary(1, 0, []);
      expect(result.success).toBe(true);
    });
  });

  describe("getSampleAudioBuffer", () => {
    it("should return audio buffer for an existing sample", () => {
      const wavPath = path.join(testWavDir, "kick.wav");
      createTestWavFile(wavPath);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      const result = sampleService.getSampleAudioBuffer(
        mockInMemorySettings,
        "A1",
        1,
        0,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(result.data!.byteLength).toBeGreaterThan(0);
    });

    it("should return null for an empty slot", () => {
      const result = sampleService.getSampleAudioBuffer(
        mockInMemorySettings,
        "A1",
        1,
        0,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should fail when source file is missing", () => {
      const wavPath = path.join(testWavDir, "temporary.wav");
      createTestWavFile(wavPath);

      sampleService.addSampleToSlot(mockInMemorySettings, "A1", 1, 0, wavPath);

      // Delete the source file
      fs.unlinkSync(wavPath);

      const result = sampleService.getSampleAudioBuffer(
        mockInMemorySettings,
        "A1",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to read sample audio");
    });

    it("should fail when no local store path is configured", () => {
      const emptySettings: InMemorySettings = {
        localStorePath: null,
      };

      const result = sampleService.getSampleAudioBuffer(
        emptySettings,
        "A1",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });
  });
});
