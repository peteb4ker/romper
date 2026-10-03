import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../syncValidationService.js", () => ({
  syncValidationService: {
    validateSyncSourceFile: vi.fn().mockResolvedValue({
      fileSize: 1024,
      isValid: true,
    }),
  },
}));

vi.mock("../syncFileOperations.js", () => ({
  syncFileOperationsService: {
    categorizeSyncFileOperation: vi.fn(),
  },
}));

import { syncFileOperationsService } from "../syncFileOperations.js";
import { syncSampleProcessingService } from "../syncSampleProcessing.js";
import { syncValidationService } from "../syncValidationService.js";

const mockValidateSyncSourceFile = vi.mocked(
  syncValidationService.validateSyncSourceFile,
);
const mockCategorizeSyncFileOperation = vi.mocked(
  syncFileOperationsService.categorizeSyncFileOperation,
);

describe("SyncSampleProcessingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDestinationPath", () => {
    const sample = {
      filename: "kick.wav",
      slot_number: 0,
      voice_number: 1,
    } as unknown;

    it("writes the sample flat in its kit folder on the SD card", () => {
      const result = syncSampleProcessingService.getDestinationPath(
        "/local/store",
        "A0",
        sample,
        "/sdcard",
      );

      expect(result).toBe(path.join("/sdcard", "A0", "1-01 kick.wav"));
    });

    it("falls back to sync_output without an SD card path", () => {
      const result = syncSampleProcessingService.getDestinationPath(
        "/local/store",
        "A0",
        sample,
      );

      expect(result).toBe(
        path.join("/local/store", "sync_output", "A0", "1-01 kick.wav"),
      );
    });

    it("names the file after the sample's voice and slot", () => {
      const result = syncSampleProcessingService.getDestinationPath(
        "/local/store",
        "A0",
        { ...(sample as object), slot_number: 2, voice_number: 3 } as never,
        "/sdcard",
      );

      expect(result).toBe(path.join("/sdcard", "A0", "3-03 kick.wav"));
    });
  });

  describe("kitsWithoutVoiceOne", () => {
    it("lists kits that have samples but none on voice 1", () => {
      const samples = [
        { kit_name: "A1", voice_number: 2 },
        { kit_name: "A0", voice_number: 1 },
        { kit_name: "A0", voice_number: 3 },
        { kit_name: "B2", voice_number: 4 },
      ] as never;

      expect(syncSampleProcessingService.kitsWithoutVoiceOne(samples)).toEqual([
        "A1",
        "B2",
      ]);
    });

    it("returns nothing when every kit has a voice 1 sample", () => {
      expect(
        syncSampleProcessingService.kitsWithoutVoiceOne([
          { kit_name: "A0", voice_number: 1 },
        ] as never),
      ).toEqual([]);
    });
  });

  describe("processSampleForSync", () => {
    const monoSample = {
      filename: "kick.wav",
      kit_name: "TestKit",
      slot_number: 0,
      source_path: "/source/kick.wav",
      voice_number: 1,
    } as unknown;

    const stereoSample = {
      filename: "stereo_kick.wav",
      kit_name: "TestKit",
      slot_number: 0,
      source_path: "/source/stereo_kick.wav",
      voice_number: 1,
    } as unknown;

    const results = {
      filesToConvert: [],
      filesToCopy: [],
      hasFormatWarnings: false,
      validationErrors: [],
      warnings: [],
    } as unknown;

    beforeEach(() => {
      vi.clearAllMocks();
      mockValidateSyncSourceFile.mockResolvedValue({
        fileSize: 1024,
        isValid: true,
      });
      // Reset arrays
      results.warnings = [];
      results.validationErrors = [];
      results.filesToCopy = [];
      results.filesToConvert = [];
    });

    it("reports a sample without a source path instead of skipping it silently", async () => {
      const sampleNoSource = { ...monoSample, source_path: undefined };

      await syncSampleProcessingService.processSampleForSync(
        sampleNoSource,
        "/local/store",
        results,
      );

      expect(mockValidateSyncSourceFile).not.toHaveBeenCalled();
      expect(mockCategorizeSyncFileOperation).not.toHaveBeenCalled();
      expect(results.validationErrors).toEqual([
        {
          error: "No source file is recorded for this sample",
          filename: "kick.wav",
          kitName: "TestKit",
          sourcePath: "",
          type: "missing_file",
        },
      ]);
    });

    it("tags validation errors with the sample's kit", async () => {
      mockValidateSyncSourceFile.mockImplementation(
        async (filename, sourcePath, validationErrors) => {
          validationErrors.push({
            error: `Source file not found: ${sourcePath}`,
            filename,
            sourcePath,
            type: "missing_file",
          });
          return { fileSize: 0, isValid: false };
        },
      );

      await syncSampleProcessingService.processSampleForSync(
        monoSample,
        "/local/store",
        results,
      );

      expect(results.validationErrors).toEqual([
        expect.objectContaining({ filename: "kick.wav", kitName: "TestKit" }),
      ]);
    });

    it("doesn't warn about stereo playback for a sample that can't be written", async () => {
      mockValidateSyncSourceFile.mockResolvedValue({
        fileSize: 0,
        isValid: false,
      });

      await syncSampleProcessingService.processSampleForSync(
        stereoSample,
        "/local/store",
        results,
      );

      expect(results.warnings).toEqual([]);
    });

    it("should process mono sample correctly", async () => {
      await syncSampleProcessingService.processSampleForSync(
        monoSample,
        "/local/store",
        results,
      );

      expect(mockValidateSyncSourceFile).toHaveBeenCalledWith(
        "kick.wav",
        "/source/kick.wav",
        results.validationErrors,
      );
      expect(mockCategorizeSyncFileOperation).toHaveBeenCalledWith(
        monoSample,
        "kick.wav",
        "/source/kick.wav",
        path.join("/local/store", "sync_output", "TestKit", "1-01 kick.wav"),
        results,
      );
    });

    it("should process stereo sample from voice 1", async () => {
      await syncSampleProcessingService.processSampleForSync(
        stereoSample,
        "/local/store",
        results,
      );

      expect(mockCategorizeSyncFileOperation).toHaveBeenCalledTimes(1);
      // Stereo is a voice setting: samples carry no stereo flag to warn about
      expect(results.warnings).toEqual([]);
    });

    it("should process stereo sample from voice 4 without warning", async () => {
      const voice4Stereo = { ...stereoSample, voice_number: 4 };

      await syncSampleProcessingService.processSampleForSync(
        voice4Stereo,
        "/local/store",
        results,
      );

      // Should process normally but without cross-voice warning (no voice 5)
      expect(mockCategorizeSyncFileOperation).toHaveBeenCalledTimes(1);
      expect(
        results.warnings.filter((w) => w.includes("will play across")),
      ).toHaveLength(0);
    });

    it("should handle invalid source file", async () => {
      mockValidateSyncSourceFile.mockResolvedValue({
        fileSize: 0,
        isValid: false,
      });

      await syncSampleProcessingService.processSampleForSync(
        monoSample,
        "/local/store",
        results,
      );

      expect(mockCategorizeSyncFileOperation).not.toHaveBeenCalled();
    });

    it("should use SD card path when provided", async () => {
      await syncSampleProcessingService.processSampleForSync(
        monoSample,
        "/local/store",
        results,
        "/sdcard",
      );

      expect(mockCategorizeSyncFileOperation).toHaveBeenCalledWith(
        monoSample,
        "kick.wav",
        "/source/kick.wav",
        path.join("/sdcard", "TestKit", "1-01 kick.wav"),
        results,
      );
    });
  });

  describe("stereo sample processing", () => {
    const testStereoSample = {
      filename: "stereo_kick.wav",
      kit_name: "TestKit",
      slot_number: 0,
      source_path: "/source/stereo_kick.wav",
      voice_number: 1,
    } as unknown;

    const testMonoSample = {
      filename: "kick.wav",
      kit_name: "TestKit",
      slot_number: 0,
      source_path: "/source/kick.wav",
      voice_number: 1,
    } as unknown;

    const testResults = {
      filesToConvert: [],
      filesToCopy: [],
      hasFormatWarnings: false,
      validationErrors: [],
      warnings: [],
    } as unknown;

    beforeEach(() => {
      mockValidateSyncSourceFile.mockResolvedValue({
        fileSize: 1024,
        isValid: true,
      });
      testResults.warnings = [];
    });

    it("doesn't warn about a sample on voice 2 (RE-29)", async () => {
      const voice2Stereo = { ...testStereoSample, voice_number: 2 };

      await syncSampleProcessingService.processSampleForSync(
        voice2Stereo,
        "/local/store",
        testResults,
      );

      expect(testResults.warnings).toEqual([]);
    });

    it("should not add cross-voice warning for stereo sample on voice 4", async () => {
      const voice4Stereo = { ...testStereoSample, voice_number: 4 };

      await syncSampleProcessingService.processSampleForSync(
        voice4Stereo,
        "/local/store",
        testResults,
      );

      expect(
        testResults.warnings.filter((w) => w.includes("will play across")),
      ).toHaveLength(0);
    });

    it("should not add warning for mono samples", async () => {
      await syncSampleProcessingService.processSampleForSync(
        testMonoSample,
        "/local/store",
        testResults,
      );

      expect(
        testResults.warnings.filter((w) => w.includes("will play across")),
      ).toHaveLength(0);
    });
  });
});
