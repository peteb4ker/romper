import type { NewKit, NewSample, Sample } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteDbFileWithRetry } from "../../db/fileOperations.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
} from "../../db/romperDbCoreORM.js";
import { SampleValidationService } from "../sampleValidation.js";
import { SampleValidator } from "../validation/sampleValidator.js";

// Test utilities
const TEST_DB_DIR = path.join(__dirname, "test-data-sample-val");
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
 */
function createTestWavFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sampleRate = 44100;
  const bitsPerSample = 16;
  const numChannels = 1;
  const dataSize = 4;
  const headerSize = 44;
  const fileSize = headerSize + dataSize - 8;

  const buffer = Buffer.alloc(headerSize + dataSize);
  let offset = 0;

  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(fileSize, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4;
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset);
  offset += 4;
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);

  fs.writeFileSync(filePath, buffer);
}

/**
 * Helper to create a Sample object for in-memory validation tests
 */
function makeSample(overrides: Partial<Sample> = {}): Sample {
  return {
    filename: "test.wav",
    id: 1,
    is_stereo: false,
    kit_name: "A1",
    slot_number: 0,
    source_path: "/path/to/test.wav",
    voice_number: 1,
    wav_bit_depth: null,
    wav_bitrate: null,
    wav_channels: null,
    wav_sample_rate: null,
    ...overrides,
  };
}

describe("SampleValidation Integration Tests", () => {
  let sampleValidationService: SampleValidationService;
  let sampleValidator: SampleValidator;
  let testWavDir: string;

  beforeEach(async () => {
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    await cleanupSqliteFiles(TEST_DB_DIR);
    createRomperDbFile(TEST_DB_PATH);

    sampleValidationService = new SampleValidationService();
    sampleValidator = new SampleValidator();

    testWavDir = path.join(TEST_DB_DIR, "test-wavs");
    if (!fs.existsSync(testWavDir)) {
      fs.mkdirSync(testWavDir, { recursive: true });
    }

    // Create test kit with samples
    const kitRecord: NewKit = {
      alias: "Test Kit",
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: null,
    };
    addKit(TEST_DB_PATH, kitRecord);
  });

  afterEach(async () => {
    await cleanupSqliteFiles(TEST_DB_DIR);
    if (fs.existsSync(testWavDir)) {
      fs.rmSync(testWavDir, { force: true, recursive: true });
    }
  });

  describe("SampleValidationService.validateVoiceAndSlot", () => {
    it("should accept all valid voice numbers (1-4)", () => {
      for (let voice = 1; voice <= 4; voice++) {
        const result = sampleValidationService.validateVoiceAndSlot(voice, 0);
        expect(result.isValid).toBe(true);
      }
    });

    it("should accept all valid slot numbers (0-11)", () => {
      for (let slot = 0; slot < 12; slot++) {
        const result = sampleValidationService.validateVoiceAndSlot(1, slot);
        expect(result.isValid).toBe(true);
      }
    });

    it("should reject voice number 0", () => {
      const result = sampleValidationService.validateVoiceAndSlot(0, 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Voice number must be between 1 and 4");
    });

    it("should reject voice number 5", () => {
      const result = sampleValidationService.validateVoiceAndSlot(5, 0);
      expect(result.isValid).toBe(false);
    });

    it("should reject negative slot number", () => {
      const result = sampleValidationService.validateVoiceAndSlot(1, -1);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Slot index must be between 0 and 11");
    });

    it("should reject slot number 12", () => {
      const result = sampleValidationService.validateVoiceAndSlot(1, 12);
      expect(result.isValid).toBe(false);
    });
  });

  describe("SampleValidationService.validateSampleFile", () => {
    it("should accept a valid WAV file", () => {
      const wavPath = path.join(testWavDir, "valid.wav");
      createTestWavFile(wavPath);

      const result = sampleValidationService.validateSampleFile(wavPath);
      expect(result.isValid).toBe(true);
    });

    it("should reject a non-existent file", () => {
      const result = sampleValidationService.validateSampleFile(
        "/nonexistent/file.wav",
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Sample file not found");
    });

    it("should reject a non-WAV extension", () => {
      const aiffPath = path.join(testWavDir, "sample.aiff");
      fs.writeFileSync(aiffPath, "fake data");

      const result = sampleValidationService.validateSampleFile(aiffPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Only WAV files are supported");
    });
  });

  describe("SampleValidationService.validateSampleMovement", () => {
    it("should accept valid movement parameters", () => {
      const result = sampleValidationService.validateSampleMovement(1, 0, 2, 0);
      expect(result.success).toBe(true);
    });

    it("should reject movement to the same position", () => {
      const result = sampleValidationService.validateSampleMovement(1, 0, 1, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot move sample to the same position");
    });

    it("should reject invalid source voice", () => {
      const result = sampleValidationService.validateSampleMovement(0, 0, 2, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Source");
    });

    it("should reject invalid destination voice", () => {
      const result = sampleValidationService.validateSampleMovement(1, 0, 5, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Destination");
    });

    it("should reject invalid source slot", () => {
      const result = sampleValidationService.validateSampleMovement(
        1,
        -1,
        2,
        0,
      );
      expect(result.success).toBe(false);
    });

    it("should reject invalid destination slot", () => {
      const result = sampleValidationService.validateSampleMovement(
        1,
        0,
        2,
        12,
      );
      expect(result.success).toBe(false);
    });

    it("should allow movement within the same voice to a different slot", () => {
      const result = sampleValidationService.validateSampleMovement(1, 0, 1, 3);
      expect(result.success).toBe(true);
    });
  });

  describe("SampleValidationService.checkSampleExists", () => {
    it("should return exists=false for an empty slot", () => {
      const result = sampleValidationService.checkSampleExists(
        TEST_DB_PATH,
        "A1",
        1,
        0,
      );
      expect(result.exists).toBe(false);
      expect(result.sample).toBeUndefined();
    });

    it("should return exists=true with sample data for an occupied slot", () => {
      const sample: NewSample = {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/kick.wav",
        voice_number: 1,
      };
      addSample(TEST_DB_PATH, sample);

      const result = sampleValidationService.checkSampleExists(
        TEST_DB_PATH,
        "A1",
        1,
        0,
      );
      expect(result.exists).toBe(true);
      expect(result.sample).toBeTruthy();
      expect(result.sample!.filename).toBe("kick.wav");
    });

    it("should not find a sample in a different voice", () => {
      const sample: NewSample = {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/kick.wav",
        voice_number: 1,
      };
      addSample(TEST_DB_PATH, sample);

      const result = sampleValidationService.checkSampleExists(
        TEST_DB_PATH,
        "A1",
        2,
        0,
      );
      expect(result.exists).toBe(false);
    });

    it("should not find a sample in a different slot", () => {
      const sample: NewSample = {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/kick.wav",
        voice_number: 1,
      };
      addSample(TEST_DB_PATH, sample);

      const result = sampleValidationService.checkSampleExists(
        TEST_DB_PATH,
        "A1",
        1,
        1,
      );
      expect(result.exists).toBe(false);
    });
  });

  describe("SampleValidationService.validateAndGetSampleToMove", () => {
    it("should return the sample when it exists", () => {
      const sample: NewSample = {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/kick.wav",
        voice_number: 1,
      };
      addSample(TEST_DB_PATH, sample);

      const result = sampleValidationService.validateAndGetSampleToMove(
        TEST_DB_PATH,
        "A1",
        1,
        0,
      );
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.filename).toBe("kick.wav");
    });

    it("should fail when no sample exists at the position", () => {
      const result = sampleValidationService.validateAndGetSampleToMove(
        TEST_DB_PATH,
        "A1",
        1,
        0,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("No sample found");
    });
  });

  describe("SampleValidationService.getDestinationSamplesAndReplacements", () => {
    it("should return destination samples for a kit", () => {
      const sample: NewSample = {
        filename: "dest_kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/dest_kick.wav",
        voice_number: 1,
      };
      addSample(TEST_DB_PATH, sample);

      const result =
        sampleValidationService.getDestinationSamplesAndReplacements(
          TEST_DB_PATH,
          "A1",
          1,
          0,
          "insert",
        );

      expect(result.destSamples).toHaveLength(1);
      expect(result.destSamples[0].filename).toBe("dest_kick.wav");
      // In insert mode, no sample should be replaced
      expect(result.replacedSample).toBeUndefined();
    });

    it("should return empty array for a kit with no samples", () => {
      const result =
        sampleValidationService.getDestinationSamplesAndReplacements(
          TEST_DB_PATH,
          "A1",
          1,
          0,
          "insert",
        );

      expect(result.destSamples).toHaveLength(0);
    });
  });

  describe("SampleValidationService.validateStereoSampleMove", () => {
    it("should allow moving a mono sample anywhere", () => {
      const monoSample = makeSample({ is_stereo: false });

      const result = sampleValidationService.validateStereoSampleMove(
        monoSample,
        4,
        0,
        "insert",
        [],
      );
      expect(result.success).toBe(true);
    });

    it("should reject moving a stereo sample to voice 4", () => {
      const stereoSample = makeSample({ is_stereo: true });

      const result = sampleValidationService.validateStereoSampleMove(
        stereoSample,
        4,
        0,
        "insert",
        [],
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("voice 4");
    });

    it("should reject stereo sample move when adjacent voice has a sample at the same slot", () => {
      const stereoSample = makeSample({ is_stereo: true, voice_number: 1 });
      const existingSamples = [
        makeSample({ id: 5, slot_number: 0, voice_number: 2 }),
      ];

      const result = sampleValidationService.validateStereoSampleMove(
        stereoSample,
        1,
        0,
        "insert",
        existingSamples,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("conflict");
    });

    it("should allow stereo sample move when adjacent voice slot is empty", () => {
      const stereoSample = makeSample({ is_stereo: true, voice_number: 1 });

      const result = sampleValidationService.validateStereoSampleMove(
        stereoSample,
        1,
        0,
        "insert",
        [],
      );
      expect(result.success).toBe(true);
    });
  });

  describe("SampleValidator.checkStereoConflicts", () => {
    it("should detect conflict when moving stereo sample to voice 4", () => {
      const stereoSample = makeSample({ is_stereo: true });

      const result = sampleValidator.checkStereoConflicts(
        stereoSample,
        4,
        0,
        [],
        "insert",
        "B1",
      );
      expect(result.hasConflict).toBe(true);
      expect(result.error).toContain("voice 4");
    });

    it("should detect conflict when destination adjacent voice has a sample", () => {
      const stereoSample = makeSample({ is_stereo: true });
      const destSamples = [
        makeSample({ id: 5, slot_number: 0, voice_number: 2 }),
      ];

      const result = sampleValidator.checkStereoConflicts(
        stereoSample,
        1,
        0,
        destSamples,
        "insert",
        "B1",
      );
      expect(result.hasConflict).toBe(true);
    });

    it("should have no conflict for mono sample", () => {
      const monoSample = makeSample({ is_stereo: false });

      const result = sampleValidator.checkStereoConflicts(
        monoSample,
        1,
        0,
        [],
        "insert",
        "B1",
      );
      expect(result.hasConflict).toBe(false);
    });

    it("should have no conflict when adjacent voice slot is empty", () => {
      const stereoSample = makeSample({ is_stereo: true });
      const destSamples = [
        makeSample({ id: 5, slot_number: 1, voice_number: 2 }), // Different slot
      ];

      const result = sampleValidator.checkStereoConflicts(
        stereoSample,
        1,
        0,
        destSamples,
        "insert",
        "B1",
      );
      expect(result.hasConflict).toBe(false);
    });
  });

  describe("SampleValidator.validateSampleSources (database integration)", () => {
    it("should validate all sample sources in a kit with valid files", () => {
      const wavPath1 = path.join(testWavDir, "kick.wav");
      const wavPath2 = path.join(testWavDir, "snare.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);

      addSample(TEST_DB_PATH, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: wavPath1,
        voice_number: 1,
      });
      addSample(TEST_DB_PATH, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 1,
        source_path: wavPath2,
        voice_number: 1,
      });

      const result = sampleValidator.validateSampleSources(TEST_DB_PATH, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.totalSamples).toBe(2);
      expect(result.data!.validSamples).toBe(2);
      expect(result.data!.invalidSamples).toHaveLength(0);
    });

    it("should report invalid samples when source files are missing", () => {
      addSample(TEST_DB_PATH, {
        filename: "missing.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/nonexistent/path/missing.wav",
        voice_number: 1,
      });

      const result = sampleValidator.validateSampleSources(TEST_DB_PATH, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.totalSamples).toBe(1);
      expect(result.data!.validSamples).toBe(0);
      expect(result.data!.invalidSamples).toHaveLength(1);
      expect(result.data!.invalidSamples[0].filename).toBe("missing.wav");
      expect(result.data!.invalidSamples[0].error).toContain(
        "Sample file not found",
      );
    });

    it("should handle a mix of valid and invalid sample sources", () => {
      const validPath = path.join(testWavDir, "valid.wav");
      createTestWavFile(validPath);

      addSample(TEST_DB_PATH, {
        filename: "valid.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: validPath,
        voice_number: 1,
      });
      addSample(TEST_DB_PATH, {
        filename: "missing.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 1,
        source_path: "/nonexistent/missing.wav",
        voice_number: 1,
      });

      const result = sampleValidator.validateSampleSources(TEST_DB_PATH, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.totalSamples).toBe(2);
      expect(result.data!.validSamples).toBe(1);
      expect(result.data!.invalidSamples).toHaveLength(1);
    });

    it("should return zero counts for a kit with no samples", () => {
      const result = sampleValidator.validateSampleSources(TEST_DB_PATH, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.totalSamples).toBe(0);
      expect(result.data!.validSamples).toBe(0);
      expect(result.data!.invalidSamples).toHaveLength(0);
    });
  });

  describe("SampleValidator.validateSampleFile (file system integration)", () => {
    it("should accept a well-formed WAV file", () => {
      const wavPath = path.join(testWavDir, "good.wav");
      createTestWavFile(wavPath);

      const result = sampleValidator.validateSampleFile(wavPath);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject a file with invalid RIFF header but .wav extension", () => {
      const badPath = path.join(testWavDir, "bad.wav");
      const buffer = Buffer.alloc(48);
      buffer.write("XXXX", 0); // Not RIFF
      buffer.writeUInt32LE(40, 4);
      buffer.write("WAVE", 8);
      fs.writeFileSync(badPath, buffer);

      const result = sampleValidator.validateSampleFile(badPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("missing RIFF signature");
    });

    it("should reject a RIFF file that is not WAVE format", () => {
      const aviPath = path.join(testWavDir, "avi.wav");
      const buffer = Buffer.alloc(48);
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(40, 4);
      buffer.write("AVI ", 8); // AVI, not WAVE
      fs.writeFileSync(aviPath, buffer);

      const result = sampleValidator.validateSampleFile(aviPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("missing WAVE format identifier");
    });

    it("should reject a truncated file smaller than WAV header", () => {
      const truncPath = path.join(testWavDir, "trunc.wav");
      fs.writeFileSync(truncPath, Buffer.alloc(20));

      const result = sampleValidator.validateSampleFile(truncPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("File too small");
    });

    it("should reject a zero-byte file", () => {
      const emptyPath = path.join(testWavDir, "empty.wav");
      fs.writeFileSync(emptyPath, Buffer.alloc(0));

      const result = sampleValidator.validateSampleFile(emptyPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("File too small");
    });

    it("should reject a .txt file", () => {
      const txtPath = path.join(testWavDir, "readme.txt");
      fs.writeFileSync(txtPath, "hello world");

      const result = sampleValidator.validateSampleFile(txtPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Only WAV files are supported");
    });
  });

  describe("SampleValidator.validateVoiceAndSlot", () => {
    it("should accept boundary values", () => {
      expect(sampleValidator.validateVoiceAndSlot(1, 0).isValid).toBe(true);
      expect(sampleValidator.validateVoiceAndSlot(4, 11).isValid).toBe(true);
    });

    it("should reject out-of-range values", () => {
      expect(sampleValidator.validateVoiceAndSlot(0, 0).isValid).toBe(false);
      expect(sampleValidator.validateVoiceAndSlot(5, 0).isValid).toBe(false);
      expect(sampleValidator.validateVoiceAndSlot(1, -1).isValid).toBe(false);
      expect(sampleValidator.validateVoiceAndSlot(1, 12).isValid).toBe(false);
    });
  });

  describe("SampleValidator.validateStereoSampleMove", () => {
    it("should pass for mono samples to any valid position", () => {
      const monoSample = makeSample({ is_stereo: false });

      const result = sampleValidator.validateStereoSampleMove(
        monoSample,
        4,
        0,
        "insert",
        [],
      );
      expect(result.success).toBe(true);
    });

    it("should fail for stereo sample to voice 4", () => {
      const stereoSample = makeSample({ is_stereo: true });

      const result = sampleValidator.validateStereoSampleMove(
        stereoSample,
        4,
        0,
        "insert",
        [],
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("voice 4");
    });

    it("should fail when adjacent voice has conflicting sample", () => {
      const stereoSample = makeSample({ is_stereo: true });
      const existingSamples = [
        makeSample({ id: 10, slot_number: 0, voice_number: 3 }),
      ];

      const result = sampleValidator.validateStereoSampleMove(
        stereoSample,
        2,
        0,
        "insert",
        existingSamples,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("conflict");
    });

    it("should pass when no adjacent voice conflict exists", () => {
      const stereoSample = makeSample({ is_stereo: true });
      const existingSamples = [
        makeSample({ id: 10, slot_number: 5, voice_number: 3 }), // Different slot
      ];

      const result = sampleValidator.validateStereoSampleMove(
        stereoSample,
        2,
        0,
        "insert",
        existingSamples,
      );
      expect(result.success).toBe(true);
    });
  });
});
