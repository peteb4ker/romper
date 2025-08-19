import type { Sample } from "@romper/shared/db/schema.js";

import * as fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as romperDbCoreORM from "../../../db/romperDbCoreORM.js";
import { SampleValidator } from "../sampleValidator";

vi.mock("fs");
vi.mock("../../../db/romperDbCoreORM.js");

const mockFs = vi.mocked(fs);
const mockORM = vi.mocked(romperDbCoreORM);

describe("SampleValidator", () => {
  let validator: SampleValidator;

  beforeEach(() => {
    validator = new SampleValidator();
    vi.clearAllMocks();
  });

  describe("validateVoiceAndSlot", () => {
    it("should accept valid voice and slot numbers", () => {
      const result = validator.validateVoiceAndSlot(1, 0);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept voice 4 and slot 11", () => {
      const result = validator.validateVoiceAndSlot(4, 11);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject voice number too low", () => {
      const result = validator.validateVoiceAndSlot(0, 5);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
    });

    it("should reject voice number too high", () => {
      const result = validator.validateVoiceAndSlot(5, 5);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
    });

    it("should reject slot number too low", () => {
      const result = validator.validateVoiceAndSlot(2, -1);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)"
      );
    });

    it("should reject slot number too high", () => {
      const result = validator.validateVoiceAndSlot(2, 12);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)"
      );
    });
  });

  describe("validateSampleFile", () => {
    it("should reject non-existent files", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Sample file not found");
    });

    it("should reject non-WAV files", () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = validator.validateSampleFile("/path/to/file.mp3");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Only WAV files are supported");
    });

    it("should reject files too small for WAV header", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 20 } as any);

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("File too small to be a valid WAV file");
    });

    it("should reject files with invalid RIFF signature", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 100 } as any);

      const buffer = Buffer.from("FAIL....WAVE", "ascii");
      mockFs.openSync.mockReturnValue(1 as any);
      mockFs.readSync.mockImplementation((_fd, buf) => {
        buffer.copy(buf as Buffer);
        return 12;
      });
      mockFs.closeSync.mockReturnValue(undefined as any);

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid WAV file: missing RIFF signature");
    });

    it("should reject files with invalid WAVE format", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 100 } as any);

      const buffer = Buffer.from("RIFF....FAIL", "ascii");
      mockFs.openSync.mockReturnValue(1 as any);
      mockFs.readSync.mockImplementation((_fd, buf) => {
        buffer.copy(buf as Buffer);
        return 12;
      });
      mockFs.closeSync.mockReturnValue(undefined as any);

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Invalid WAV file: missing WAVE format identifier"
      );
    });

    it("should accept valid WAV files", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 100 } as any);

      const buffer = Buffer.from("RIFF....WAVE", "ascii");
      mockFs.openSync.mockReturnValue(1 as any);
      mockFs.readSync.mockImplementation((_fd, buf) => {
        buffer.copy(buf as Buffer);
        return 12;
      });
      mockFs.closeSync.mockReturnValue(undefined as any);

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle file read errors", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Failed to validate file");
    });
  });

  describe("validateSampleSources", () => {
    it("should return validation results for all samples", () => {
      const samples: Sample[] = [
        {
          created_at: "2023-01-01",
          filename: "valid.wav",
          id: 1,
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 0,
          source_path: "/path/to/valid.wav",
          voice_number: 1,
        },
        {
          created_at: "2023-01-01",
          filename: "invalid.wav",
          id: 2,
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 1,
          source_path: "/path/to/invalid.wav",
          voice_number: 1,
        },
      ];

      mockORM.getKitSamples.mockReturnValue({
        data: samples,
        success: true,
      });

      // Mock validation - first file valid (all file operations), second invalid
      mockFs.existsSync.mockImplementation((path) => {
        return path === "/path/to/valid.wav";
      });

      // Mock for valid file
      mockFs.statSync.mockReturnValue({ size: 100 } as any);
      const buffer = Buffer.from("RIFF....WAVE", "ascii");
      mockFs.openSync.mockReturnValue(1 as any);
      mockFs.readSync.mockImplementation((_fd, buf) => {
        buffer.copy(buf as Buffer);
        return 12;
      });
      mockFs.closeSync.mockReturnValue(undefined as any);

      const result = validator.validateSampleSources("/db/path", "TestKit");

      expect(result.success).toBe(true);
      expect(result.data?.totalSamples).toBe(2);
      expect(result.data?.validSamples).toBe(1);
      expect(result.data?.invalidSamples).toHaveLength(1);
      expect(result.data?.invalidSamples[0]).toEqual({
        error: "Sample file not found",
        filename: "invalid.wav",
        source_path: "/path/to/invalid.wav",
      });
    });

    it("should handle database errors", () => {
      mockORM.getKitSamples.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = validator.validateSampleSources("/db/path", "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should handle exceptions during validation", () => {
      mockORM.getKitSamples.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = validator.validateSampleSources("/db/path", "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to validate sample sources");
    });
  });

  describe("validateStereoSampleMove", () => {
    const createSample = (
      voiceNumber: number,
      slotNumber: number,
      isStereo = false
    ): Sample => ({
      created_at: "2023-01-01",
      filename: `sample_${voiceNumber}_${slotNumber}.wav`,
      id: voiceNumber * 100 + slotNumber,
      is_stereo: isStereo,
      kit_name: "TestKit",
      slot_number: slotNumber,
      source_path: `/path/to/sample_${voiceNumber}_${slotNumber}.wav`,
      voice_number: voiceNumber,
    });

    it("should allow mono sample moves", () => {
      const monoSample = createSample(1, 0, false);
      const existingSamples: Sample[] = [];

      const result = validator.validateStereoSampleMove(
        monoSample,
        2,
        1,
        "insert",
        existingSamples
      );

      expect(result.success).toBe(true);
    });

    it("should reject stereo sample moves to voice 4", () => {
      const stereoSample = createSample(1, 0, true);
      const existingSamples: Sample[] = [];

      const result = validator.validateStereoSampleMove(
        stereoSample,
        4,
        1,
        "insert",
        existingSamples
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Cannot move stereo sample to voice 4 (no adjacent voice available)"
      );
    });

    it("should reject stereo sample moves with conflicts", () => {
      const stereoSample = createSample(1, 0, true);
      const conflictingSample = createSample(3, 1, false); // Voice 3, slot 1
      const existingSamples: Sample[] = [conflictingSample];

      const result = validator.validateStereoSampleMove(
        stereoSample,
        2, // Moving to voice 2, would need voice 3 slot 1 free
        1,
        "insert",
        existingSamples
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Stereo sample move would conflict with sample in voice 3, slot 2"
      );
    });

    it("should allow stereo sample moves without conflicts", () => {
      const stereoSample = createSample(1, 0, true);
      const existingSamples: Sample[] = [createSample(3, 0, false)]; // Different slot

      const result = validator.validateStereoSampleMove(
        stereoSample,
        2,
        1,
        "insert",
        existingSamples
      );

      expect(result.success).toBe(true);
    });
  });

  describe("checkStereoConflicts", () => {
    const createSample = (
      voiceNumber: number,
      slotNumber: number,
      isStereo = false
    ): Sample => ({
      created_at: "2023-01-01",
      filename: `sample_${voiceNumber}_${slotNumber}.wav`,
      id: voiceNumber * 100 + slotNumber,
      is_stereo: isStereo,
      kit_name: "TestKit",
      slot_number: slotNumber,
      source_path: `/path/to/sample_${voiceNumber}_${slotNumber}.wav`,
      voice_number: voiceNumber,
    });

    it("should not conflict for mono samples", () => {
      const monoSample = createSample(1, 0, false);
      const destSamples: Sample[] = [];

      const result = validator.checkStereoConflicts(
        monoSample,
        2,
        1,
        destSamples,
        "insert",
        "DestKit"
      );

      expect(result.hasConflict).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("should conflict when moving stereo sample to voice 4", () => {
      const stereoSample = createSample(1, 0, true);
      const destSamples: Sample[] = [];

      const result = validator.checkStereoConflicts(
        stereoSample,
        4,
        1,
        destSamples,
        "insert",
        "DestKit"
      );

      expect(result.hasConflict).toBe(true);
      expect(result.error).toBe(
        "Cannot move stereo sample to voice 4 (no adjacent voice available)"
      );
    });

    it("should conflict when destination adjacent voice has sample", () => {
      const stereoSample = createSample(1, 0, true);
      const conflictingSample = createSample(3, 1, false);
      const destSamples: Sample[] = [conflictingSample];

      const result = validator.checkStereoConflicts(
        stereoSample,
        2, // Adjacent voice 3 has conflict
        1,
        destSamples,
        "insert",
        "DestKit"
      );

      expect(result.hasConflict).toBe(true);
      expect(result.error).toContain(
        "Cannot move stereo sample to voice 2 slot 2 in kit DestKit"
      );
    });

    it("should not conflict when adjacent voice is free", () => {
      const stereoSample = createSample(1, 0, true);
      const destSamples: Sample[] = [createSample(3, 0, false)]; // Different slot

      const result = validator.checkStereoConflicts(
        stereoSample,
        2,
        1,
        destSamples,
        "insert",
        "DestKit"
      );

      expect(result.hasConflict).toBe(false);
      expect(result.error).toBeUndefined();
    });
  });
});
