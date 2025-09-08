import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/romperDbCoreORM.js", () => ({
  getKitSamples: vi.fn(),
}));

vi.mock("../syncValidationService.js", () => ({
  syncValidationService: {
    validateSyncSourceFile: vi.fn().mockReturnValue({
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

import { getKitSamples } from "../../db/romperDbCoreORM.js";
import { syncFileOperationsService } from "../syncFileOperations.js";
import { syncSampleProcessingService } from "../syncSampleProcessing.js";
import { syncValidationService } from "../syncValidationService.js";

const mockGetKitSamples = vi.mocked(getKitSamples);
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

  describe("gatherAllSamples", () => {
    it("should successfully gather samples from all kits", async () => {
      // Mock dynamic import
      const mockGetKits = vi.fn().mockReturnValue({
        data: [{ name: "Kit1" }, { name: "Kit2" }],
        success: true,
      });

      vi.doMock("../../db/romperDbCoreORM.js", async () => ({
        getKits: mockGetKits,
        getKitSamples: mockGetKitSamples,
      }));

      mockGetKitSamples
        .mockReturnValueOnce({
          data: [
            { filename: "sample1.wav", kit_name: "Kit1" },
            { filename: "sample2.wav", kit_name: "Kit1" },
          ],
          success: true,
        })
        .mockReturnValueOnce({
          data: [{ filename: "sample3.wav", kit_name: "Kit2" }],
          success: true,
        });

      const result =
        await syncSampleProcessingService.gatherAllSamples("/test/db");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.[0]).toEqual({
        filename: "sample1.wav",
        kit_name: "Kit1",
        kitName: "Kit1",
      });
    });

    it("should handle failure to load kits", async () => {
      const mockGetKits = vi.fn().mockReturnValue({
        error: "Failed to connect to database",
        success: false,
      });

      vi.doMock("../../db/romperDbCoreORM.js", async () => ({
        getKits: mockGetKits,
      }));

      const result =
        await syncSampleProcessingService.gatherAllSamples("/test/db");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to connect to database");
    });

    it("should handle errors during sample gathering", async () => {
      const mockGetKits = vi.fn().mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      vi.doMock("../../db/romperDbCoreORM.js", async () => ({
        getKits: mockGetKits,
      }));

      const result =
        await syncSampleProcessingService.gatherAllSamples("/test/db");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to gather samples");
      expect(result.error).toContain("Database connection failed");
    });

    it("should skip kits with failed sample loading", async () => {
      const mockGetKits = vi.fn().mockReturnValue({
        data: [{ name: "Kit1" }, { name: "Kit2" }],
        success: true,
      });

      vi.doMock("../../db/romperDbCoreORM.js", async () => ({
        getKits: mockGetKits,
        getKitSamples: mockGetKitSamples,
      }));

      mockGetKitSamples
        .mockReturnValueOnce({
          data: [{ filename: "sample1.wav", kit_name: "Kit1" }],
          success: true,
        })
        .mockReturnValueOnce({
          error: "Kit2 not found",
          success: false,
        });

      const result =
        await syncSampleProcessingService.gatherAllSamples("/test/db");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].kitName).toBe("Kit1");
    });
  });

  describe("getDestinationPath", () => {
    const sample = {
      filename: "kick.wav",
      voice_number: 1,
    } as unknown;

    it("should generate correct destination path with SD card path", () => {
      const result = syncSampleProcessingService.getDestinationPath(
        "/local/store",
        "TestKit",
        sample,
        "/sdcard",
      );

      expect(result).toBe("/sdcard/TestKit/1/kick.wav");
    });

    it("should generate correct destination path without SD card path", () => {
      const result = syncSampleProcessingService.getDestinationPath(
        "/local/store",
        "TestKit",
        sample,
      );

      expect(result).toBe("/local/store/sync_output/TestKit/1/kick.wav");
    });

    it("should handle different voice numbers", () => {
      const sampleVoice2 = { ...sample, voice_number: 2 };

      const result = syncSampleProcessingService.getDestinationPath(
        "/local/store",
        "TestKit",
        sampleVoice2,
      );

      expect(result).toBe("/local/store/sync_output/TestKit/2/kick.wav");
    });
  });

  describe("processSampleForSync", () => {
    const monoSample = {
      filename: "kick.wav",
      is_stereo: false,
      kit_name: "TestKit",
      slot_number: 0,
      source_path: "/source/kick.wav",
      voice_number: 1,
    } as unknown;

    const stereoSample = {
      filename: "stereo_kick.wav",
      is_stereo: true,
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
      mockValidateSyncSourceFile.mockReturnValue({
        fileSize: 1024,
        isValid: true,
      });
      // Reset arrays
      results.warnings = [];
      results.validationErrors = [];
      results.filesToCopy = [];
      results.filesToConvert = [];
    });

    it("should handle sample without source path", () => {
      const sampleNoSource = { ...monoSample, source_path: undefined };

      syncSampleProcessingService.processSampleForSync(
        sampleNoSource,
        "/local/store",
        results,
      );

      expect(mockValidateSyncSourceFile).not.toHaveBeenCalled();
      expect(mockCategorizeSyncFileOperation).not.toHaveBeenCalled();
    });

    it("should process mono sample correctly", () => {
      syncSampleProcessingService.processSampleForSync(
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
        "/local/store/sync_output/TestKit/1/kick.wav",
        results,
      );
    });

    it("should process stereo sample from voice 1", () => {
      syncSampleProcessingService.processSampleForSync(
        stereoSample,
        "/local/store",
        results,
      );

      expect(mockCategorizeSyncFileOperation).toHaveBeenCalledTimes(1);
      expect(results.warnings).toContain(
        'Stereo sample "stereo_kick.wav" on voice 1 will play across voices 1 and 2',
      );
    });

    it("should process stereo sample from voice 4 without warning", () => {
      const voice4Stereo = { ...stereoSample, voice_number: 4 };

      syncSampleProcessingService.processSampleForSync(
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

    it("should handle invalid source file", () => {
      mockValidateSyncSourceFile.mockReturnValue({
        fileSize: 0,
        isValid: false,
      });

      syncSampleProcessingService.processSampleForSync(
        monoSample,
        "/local/store",
        results,
      );

      expect(mockCategorizeSyncFileOperation).not.toHaveBeenCalled();
    });

    it("should use SD card path when provided", () => {
      syncSampleProcessingService.processSampleForSync(
        monoSample,
        "/local/store",
        results,
        "/sdcard",
      );

      expect(mockCategorizeSyncFileOperation).toHaveBeenCalledWith(
        monoSample,
        "kick.wav",
        "/source/kick.wav",
        "/sdcard/TestKit/1/kick.wav",
        results,
      );
    });
  });

  describe("stereo sample processing", () => {
    const testStereoSample = {
      filename: "stereo_kick.wav",
      is_stereo: true,
      kit_name: "TestKit",
      slot_number: 0,
      source_path: "/source/stereo_kick.wav",
      voice_number: 1,
    } as unknown;

    const testMonoSample = {
      filename: "kick.wav",
      is_stereo: false,
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
      mockValidateSyncSourceFile.mockReturnValue({
        fileSize: 1024,
        isValid: true,
      });
      testResults.warnings = [];
    });

    it("should add warning for stereo samples on voices 1-3", () => {
      const voice2Stereo = { ...testStereoSample, voice_number: 2 };

      syncSampleProcessingService.processSampleForSync(
        voice2Stereo,
        "/local/store",
        testResults,
      );

      expect(testResults.warnings).toContain(
        'Stereo sample "stereo_kick.wav" on voice 2 will play across voices 2 and 3',
      );
    });

    it("should not add cross-voice warning for stereo sample on voice 4", () => {
      const voice4Stereo = { ...testStereoSample, voice_number: 4 };

      syncSampleProcessingService.processSampleForSync(
        voice4Stereo,
        "/local/store",
        testResults,
      );

      expect(
        testResults.warnings.filter((w) => w.includes("will play across")),
      ).toHaveLength(0);
    });

    it("should not add warning for mono samples", () => {
      syncSampleProcessingService.processSampleForSync(
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
