import type { Sample } from "@romper/shared/db/schema";

import { beforeEach, describe, expect, it } from "vitest";

import { RampleNamingService } from "../rampleNamingService";

describe("RampleNamingService", () => {
  let service: RampleNamingService;

  beforeEach(() => {
    service = new RampleNamingService();
  });

  describe("generateSampleFilename", () => {
    it("should generate correct filename for voice 1, slot 1", () => {
      const result = service.generateSampleFilename(1, 0);
      expect(result).toBe("1sample1.wav");
    });

    it("should generate correct filename for voice 4, slot 12", () => {
      const result = service.generateSampleFilename(4, 11);
      expect(result).toBe("4sample12.wav");
    });

    it("should handle middle voice and slot numbers", () => {
      const result = service.generateSampleFilename(2, 5);
      expect(result).toBe("2sample6.wav");
    });

    it("should throw error for invalid voice number (0)", () => {
      expect(() => service.generateSampleFilename(0, 0)).toThrow(
        "Invalid voice number: 0. Must be 1-4 for Rample compatibility.",
      );
    });

    it("should throw error for invalid voice number (5)", () => {
      expect(() => service.generateSampleFilename(5, 0)).toThrow(
        "Invalid voice number: 5. Must be 1-4 for Rample compatibility.",
      );
    });

    it("should throw error for invalid slot number (-1)", () => {
      expect(() => service.generateSampleFilename(1, -1)).toThrow(
        "Invalid slot number: -1. Must be 0-11 for Rample compatibility.",
      );
    });

    it("should throw error for invalid slot number (12)", () => {
      expect(() => service.generateSampleFilename(1, 12)).toThrow(
        "Invalid slot number: 12. Must be 0-11 for Rample compatibility.",
      );
    });
  });

  describe("generateKitPath", () => {
    it("should generate correct kit path for A0", () => {
      const result = service.generateKitPath("/sdcard", "A0");
      expect(result).toBe("/sdcard/A0");
    });

    it("should generate correct kit path for Z99", () => {
      const result = service.generateKitPath("/mnt/sdcard", "Z99");
      expect(result).toBe("/mnt/sdcard/Z99");
    });

    it("should handle different SD card root paths", () => {
      const result = service.generateKitPath("/Volumes/RAMPLE", "B5");
      expect(result).toBe("/Volumes/RAMPLE/B5");
    });

    it("should throw error for invalid kit name (lowercase)", () => {
      expect(() => service.generateKitPath("/sdcard", "a0")).toThrow(
        "Invalid kit name: a0. Must follow format {BankLetter}{KitNumber} (e.g., A0, B1, Z99).",
      );
    });

    it("should throw error for invalid kit name (wrong format)", () => {
      expect(() => service.generateKitPath("/sdcard", "AA0")).toThrow(
        "Invalid kit name: AA0. Must follow format {BankLetter}{KitNumber} (e.g., A0, B1, Z99).",
      );
    });

    it("should throw error for invalid kit name (three digits)", () => {
      expect(() => service.generateKitPath("/sdcard", "A100")).toThrow(
        "Invalid kit name: A100. Must follow format {BankLetter}{KitNumber} (e.g., A0, B1, Z99).",
      );
    });
  });

  describe("generateSampleDestinationPath", () => {
    it("should generate complete destination path", () => {
      const result = service.generateSampleDestinationPath(
        "/sdcard",
        "A0",
        1,
        0,
      );
      expect(result).toBe("/sdcard/A0/1sample1.wav");
    });

    it("should handle complex path with multiple voice/slot combinations", () => {
      const result = service.generateSampleDestinationPath(
        "/mnt/sdcard",
        "Z99",
        4,
        11,
      );
      expect(result).toBe("/mnt/sdcard/Z99/4sample12.wav");
    });

    it("should handle Windows-style paths", () => {
      const result = service.generateSampleDestinationPath(
        "D:\\sdcard",
        "B10",
        2,
        3,
      );
      // Note: path.join normalizes separators based on platform
      expect(result).toContain("B10");
      expect(result).toContain("2sample4.wav");
    });
  });

  describe("transformSampleToPathAndFilename", () => {
    it("should return both path and filename for sample", () => {
      const sample: Sample = {
        filename: "original_kick.wav",
        id: 1,
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/local/samples/kick.wav",
        voice_number: 1,
        wav_bitrate: null,
        wav_sample_rate: null,
      };

      const result = service.transformSampleToPathAndFilename(
        sample,
        "/sdcard",
      );

      expect(result.destinationPath).toBe("/sdcard/A0/1sample1.wav");
      expect(result.filename).toBe("1sample1.wav");
    });

    it("should handle complex voice/slot combinations", () => {
      const sample: Sample = {
        filename: "complex_sample.wav",
        id: 2,
        is_stereo: true,
        kit_name: "Z99",
        slot_number: 11,
        source_path: "/path/to/original.wav",
        voice_number: 4,
        wav_bitrate: null,
        wav_sample_rate: null,
      };

      const result = service.transformSampleToPathAndFilename(
        sample,
        "/mnt/sd",
      );

      expect(result.destinationPath).toBe("/mnt/sd/Z99/4sample12.wav");
      expect(result.filename).toBe("4sample12.wav");
    });
  });

  describe("transformSampleToDestinationPath", () => {
    it("should transform sample object to destination path", () => {
      const sample: Sample = {
        filename: "original_kick.wav",
        id: 1,
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/local/samples/kick.wav",
        voice_number: 1,
        wav_bitrate: null,
        wav_sample_rate: null,
      };

      const result = service.transformSampleToDestinationPath(
        sample,
        "/sdcard",
      );
      expect(result).toBe("/sdcard/A0/1sample1.wav");
    });

    it("should work with different kit names and voice/slot combinations", () => {
      const sample: Sample = {
        filename: "complex_sample_name.wav",
        id: 2,
        is_stereo: true,
        kit_name: "M42",
        slot_number: 5,
        source_path: "/path/to/original.wav",
        voice_number: 3,
        wav_bitrate: null,
        wav_sample_rate: null,
      };

      const result = service.transformSampleToDestinationPath(sample, "/root");
      expect(result).toBe("/root/M42/3sample6.wav");
    });
  });

  describe("validateRampleCompliance", () => {
    it("should validate compliant path as valid", () => {
      const result = service.validateRampleCompliance("/sdcard/A0/1kick.wav");
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should validate multiple voice samples as valid", () => {
      const paths = [
        "/sdcard/B5/1sample1.wav",
        "/sdcard/B5/2sample1.wav",
        "/sdcard/B5/3sample1.wav",
        "/sdcard/B5/4sample1.wav",
      ];

      paths.forEach((path) => {
        const result = service.validateRampleCompliance(path);
        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });

    it("should identify invalid kit directory name", () => {
      const result = service.validateRampleCompliance(
        "/sdcard/InvalidKit/1sample.wav",
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(
        'Kit directory "InvalidKit" does not follow format {BankLetter}{KitNumber}',
      );
    });

    it("should identify invalid sample filename (no voice prefix)", () => {
      const result = service.validateRampleCompliance("/sdcard/A0/sample.wav");
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(
        'Sample filename "sample.wav" does not start with voice number (1-4)',
      );
    });

    it("should identify invalid sample filename (wrong voice number)", () => {
      const result = service.validateRampleCompliance("/sdcard/A0/5sample.wav");
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(
        'Sample filename "5sample.wav" does not start with voice number (1-4)',
      );
    });

    it("should identify non-WAV file extension", () => {
      const result = service.validateRampleCompliance("/sdcard/A0/1sample.mp3");
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(
        'Sample filename "1sample.mp3" is not a .wav file',
      );
    });

    it("should identify multiple issues at once", () => {
      const result = service.validateRampleCompliance(
        "/sdcard/invalid/0sample.mp3",
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(3);
      expect(result.issues).toContain(
        'Kit directory "invalid" does not follow format {BankLetter}{KitNumber}',
      );
      expect(result.issues).toContain(
        'Sample filename "0sample.mp3" does not start with voice number (1-4)',
      );
      expect(result.issues).toContain(
        'Sample filename "0sample.mp3" is not a .wav file',
      );
    });

    it("should handle case-insensitive WAV extension", () => {
      const resultLower = service.validateRampleCompliance(
        "/sdcard/A0/1sample.wav",
      );
      const resultUpper = service.validateRampleCompliance(
        "/sdcard/A0/1sample.WAV",
      );
      const resultMixed = service.validateRampleCompliance(
        "/sdcard/A0/1sample.Wav",
      );

      expect(resultLower.isValid).toBe(true);
      expect(resultUpper.isValid).toBe(true);
      expect(resultMixed.isValid).toBe(true);
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("should handle boundary kit names correctly", () => {
      // Test minimum and maximum valid kit names
      expect(() => service.generateKitPath("/sd", "A0")).not.toThrow();
      expect(() => service.generateKitPath("/sd", "Z99")).not.toThrow();
    });

    it("should handle boundary voice and slot numbers", () => {
      // Test minimum and maximum valid voice/slot combinations
      expect(() => service.generateSampleFilename(1, 0)).not.toThrow();
      expect(() => service.generateSampleFilename(4, 11)).not.toThrow();
    });

    it("should handle empty or undefined paths gracefully", () => {
      const result = service.validateRampleCompliance("");
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should validate single digit kit numbers", () => {
      const result = service.validateRampleCompliance("/sdcard/A1/1sample.wav");
      expect(result.isValid).toBe(true);
    });

    it("should validate double digit kit numbers", () => {
      const result = service.validateRampleCompliance(
        "/sdcard/A99/1sample.wav",
      );
      expect(result.isValid).toBe(true);
    });
  });
});
