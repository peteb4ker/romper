import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncSampleProcessingService } from "../syncSampleProcessing.js";
// import { syncValidationService } from "../syncValidationService.js"; // Used in mocks

// Mock the validation service to return valid results
vi.mock("../syncValidationService.js", () => ({
  syncValidationService: {
    validateSyncSourceFile: vi.fn().mockReturnValue({ isValid: true }),
  },
}));

// Mock the file operations service
vi.mock("../syncFileOperations.js", () => ({
  syncFileOperationsService: {
    categorizeSyncFileOperation: vi.fn(),
  },
}));

describe("SyncSampleProcessingService - Stereo Support", () => {
  const mockResults = {
    filesToConvert: [],
    filesToCopy: [],
    hasFormatWarnings: false,
    validationErrors: [],
    warnings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockResults.filesToConvert = [];
    mockResults.filesToCopy = [];
    mockResults.warnings = [];
    mockResults.validationErrors = [];
  });

  describe("processSampleForSync - Stereo Handling", () => {
    const mockStereoSample: Sample = {
      filename: "stereo_kick.wav",
      id: 1,
      is_stereo: true,
      kit_name: "A0",
      slot_number: 0,
      source_path: "/path/to/stereo_kick.wav",
      voice_number: 1,
      wav_bit_depth: 16,
      wav_bitrate: 16,
      wav_channels: 2,
      wav_sample_rate: 44100,
    };

    const mockMonoSample: Sample = {
      filename: "mono_snare.wav",
      id: 2,
      is_stereo: false,
      kit_name: "A0",
      slot_number: 1,
      source_path: "/path/to/mono_snare.wav",
      voice_number: 2,
      wav_bit_depth: 16,
      wav_bitrate: 16,
      wav_channels: 1,
      wav_sample_rate: 44100,
    };

    it("should process stereo sample from voice 1 to generate L+R files", () => {
      const localStorePath = "/test/local";

      syncSampleProcessingService.processSampleForSync(
        mockStereoSample,
        localStorePath,
        mockResults,
      );

      // Should generate warning about stereo processing
      expect(mockResults.warnings).toContain(
        'Stereo sample "stereo_kick.wav" generates files for voice 1 (L) and voice 2 (R)',
      );
    });

    it("should process stereo sample from voice 3 to generate L+R files", () => {
      const stereoVoice3Sample = {
        ...mockStereoSample,
        voice_number: 3,
      };

      syncSampleProcessingService.processSampleForSync(
        stereoVoice3Sample,
        "/test/local",
        mockResults,
      );

      expect(mockResults.warnings).toContain(
        'Stereo sample "stereo_kick.wav" generates files for voice 3 (L) and voice 4 (R)',
      );
    });

    it("should NOT process stereo sample from voice 4 as stereo", () => {
      const stereoVoice4Sample = {
        ...mockStereoSample,
        voice_number: 4,
      };

      syncSampleProcessingService.processSampleForSync(
        stereoVoice4Sample,
        "/test/local",
        mockResults,
      );

      // Should not have stereo processing warning (processed as mono)
      const stereoWarnings = mockResults.warnings.filter(
        (w) =>
          w.includes("generates files for voice") &&
          w.includes("(L) and voice"),
      );
      expect(stereoWarnings).toHaveLength(0);
    });

    it("should process mono samples normally", () => {
      syncSampleProcessingService.processSampleForSync(
        mockMonoSample,
        "/test/local",
        mockResults,
      );

      // Should not have any stereo-related warnings
      const stereoWarnings = mockResults.warnings.filter(
        (w) =>
          w.includes("generates files for voice") &&
          w.includes("(L) and voice"),
      );
      expect(stereoWarnings).toHaveLength(0);
    });

    it("should skip samples without source_path", () => {
      const sampleWithoutPath = {
        ...mockStereoSample,
        source_path: null,
      };

      const initialWarningCount = mockResults.warnings.length;

      syncSampleProcessingService.processSampleForSync(
        sampleWithoutPath as unknown,
        "/test/local",
        mockResults,
      );

      // Should not process anything
      expect(mockResults.warnings).toHaveLength(initialWarningCount);
    });

    it("should handle edge cases correctly", () => {
      // Test voice 2 stereo (should link to voice 3)
      const voice2Stereo = {
        ...mockStereoSample,
        voice_number: 2,
      };

      syncSampleProcessingService.processSampleForSync(
        voice2Stereo,
        "/test/local",
        mockResults,
      );

      expect(mockResults.warnings).toContain(
        'Stereo sample "stereo_kick.wav" generates files for voice 2 (L) and voice 3 (R)',
      );
    });
  });
});
