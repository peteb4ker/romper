import type { NewKit } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreDb } from "../../../../tests/integration/support/storeDb.js";
import {
  createTempStore,
  removeTempStore,
} from "../../../../tests/integration/support/tempStore.js";
import {
  addKit,
  addSample,
  getKitSamples,
  updateVoiceStereoMode,
} from "../../db/romperDbCoreORM.js";
import { sampleCrudService } from "../crud/sampleCrudService.js";
import { sampleBatchOperationsService } from "../sampleBatchOperations.js";
import { SampleValidationService } from "../sampleValidation.js";
import { SampleValidator } from "../validation/sampleValidator.js";

// Test utilities
// Each test gets its own directory under the OS temp dir (see beforeEach),
// so nothing is written into the source tree.
let TEST_DB_DIR: string;
let TEST_DB_PATH: string;

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

describe("SampleValidation Integration Tests", () => {
  let sampleValidationService: SampleValidationService;
  let sampleValidator: SampleValidator;
  let testWavDir: string;

  beforeEach(() => {
    TEST_DB_DIR = createTempStore("romper-sample-val-");
    TEST_DB_PATH = path.join(TEST_DB_DIR, ".romperdb");
    createStoreDb(TEST_DB_PATH);

    sampleValidationService = new SampleValidationService();
    sampleValidator = new SampleValidator();

    testWavDir = path.join(TEST_DB_DIR, "test-wavs");
    fs.mkdirSync(testWavDir, { recursive: true });

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

  afterEach(() => {
    removeTempStore(TEST_DB_DIR);
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

  describe("[UC-19] SampleValidationService.validateSampleFile", () => {
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

  describe("[UC-21] SampleValidationService.validateSampleMovement", () => {
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

  describe("SampleValidator.validateSampleSources (database integration)", () => {
    it("should validate all sample sources in a kit with valid files", () => {
      const wavPath1 = path.join(testWavDir, "kick.wav");
      const wavPath2 = path.join(testWavDir, "snare.wav");
      createTestWavFile(wavPath1);
      createTestWavFile(wavPath2);

      addSample(TEST_DB_PATH, {
        filename: "kick.wav",
        kit_name: "A1",
        slot_number: 0,
        source_path: wavPath1,
        voice_number: 1,
      });
      addSample(TEST_DB_PATH, {
        filename: "snare.wav",
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
        kit_name: "A1",
        slot_number: 0,
        source_path: validPath,
        voice_number: 1,
      });
      addSample(TEST_DB_PATH, {
        filename: "missing.wav",
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

  describe("[UC-19] SampleValidator.validateSampleFile (file system integration)", () => {
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
      expect(result.error).toContain("Not a WAV file");
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
      expect(result.error).toContain("Not a WAV file");
    });

    it("should reject a truncated file smaller than WAV header", () => {
      const truncPath = path.join(testWavDir, "trunc.wav");
      fs.writeFileSync(truncPath, Buffer.alloc(20));

      const result = sampleValidator.validateSampleFile(truncPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Not a WAV file");
    });

    it("should reject a zero-byte file", () => {
      const emptyPath = path.join(testWavDir, "empty.wav");
      fs.writeFileSync(emptyPath, Buffer.alloc(0));

      const result = sampleValidator.validateSampleFile(emptyPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Not a WAV file");
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

  describe("validateVoiceNotLinkedPartner", () => {
    it("[UC-28] refuses voice 2 while voice 1 is linked for stereo", () => {
      updateVoiceStereoMode(TEST_DB_PATH, "A1", 1, true);

      const serviceResult =
        sampleValidationService.validateVoiceNotLinkedPartner(
          TEST_DB_PATH,
          "A1",
          2,
        );
      expect(serviceResult.isValid).toBe(false);
      expect(serviceResult.error).toBe(
        "Voice 2 is linked to voice 1 for stereo. Unlink them to put samples on voice 2.",
      );

      const validatorResult = sampleValidator.validateVoiceNotLinkedPartner(
        TEST_DB_PATH,
        "A1",
        2,
      );
      expect(validatorResult.isValid).toBe(false);
    });

    it("[UC-28] accepts voices 1 and 3 while voice 1 is linked", () => {
      updateVoiceStereoMode(TEST_DB_PATH, "A1", 1, true);

      for (const voice of [1, 3]) {
        const result = sampleValidationService.validateVoiceNotLinkedPartner(
          TEST_DB_PATH,
          "A1",
          voice,
        );
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it("[UC-28] accepts voice 2 when no voice is linked", () => {
      const result = sampleValidationService.validateVoiceNotLinkedPartner(
        TEST_DB_PATH,
        "A1",
        2,
      );
      expect(result.isValid).toBe(true);
    });

    it("[UC-28] addSampleToSlot refuses voice 2 while voice 1 is linked", () => {
      updateVoiceStereoMode(TEST_DB_PATH, "A1", 1, true);
      const wavPath = path.join(testWavDir, "right.wav");
      createTestWavFile(wavPath);

      const result = sampleCrudService.addSampleToSlot(
        { localStorePath: TEST_DB_DIR },
        "A1",
        2,
        0,
        wavPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Voice 2 is linked to voice 1");
      expect(getKitSamples(TEST_DB_PATH, "A1").data).toHaveLength(0);
    });

    it("[UC-28] moveSampleInKit refuses voice 2 while voice 1 is linked", () => {
      addSample(TEST_DB_PATH, {
        filename: "kick.wav",
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/kick.wav",
        voice_number: 1,
      });
      updateVoiceStereoMode(TEST_DB_PATH, "A1", 1, true);

      const result = sampleBatchOperationsService.moveSampleInKit(
        { localStorePath: TEST_DB_DIR },
        "A1",
        1,
        0,
        2,
        0,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Voice 2 is linked to voice 1");
      const samples = getKitSamples(TEST_DB_PATH, "A1").data!;
      expect(samples).toHaveLength(1);
      expect(samples[0].voice_number).toBe(1);
    });
  });
});
