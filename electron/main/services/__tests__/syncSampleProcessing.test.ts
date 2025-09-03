import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/romperDbCoreORM.js", () => ({
  getKitSamples: vi.fn(),
}));

vi.mock("./syncValidationService.js", () => ({
  syncValidationService: {
    validateSyncSourceFile: vi.fn(),
  },
}));

vi.mock("./syncFileOperations.js", () => ({
  syncFileOperationsService: {
    categorizeSyncFileOperation: vi.fn(),
  },
}));

import { getKitSamples } from "../../db/romperDbCoreORM.js";
import { syncFileOperationsService } from "../syncFileOperations.js";
import { syncSampleProcessingService } from "../syncSampleProcessing.js";
import { syncValidationService } from "../syncValidationService.js";

const mockGetKitSamples = vi.mocked(getKitSamples);
const _mockSyncValidationService = vi.mocked(syncValidationService);
const _mockSyncFileOperationsService = vi.mocked(syncFileOperationsService);

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
    const sample = {
      filename: "kick.wav",
      kit_name: "TestKit",
      source_path: "/source/kick.wav",
    } as unknown;

    const results = {
      filesToConvert: [],
      filesToCopy: [],
      hasFormatWarnings: false,
      validationErrors: [],
      warnings: [],
    } as unknown;

    it("should handle sample without source path", () => {
      const sampleNoSource = { ...sample, source_path: undefined };

      // Should not throw error when processing sample without source path
      expect(() => {
        syncSampleProcessingService.processSampleForSync(
          sampleNoSource,
          "/local/store",
          results,
        );
      }).not.toThrow();
    });

    it("should handle sample processing without error", () => {
      // Test that the method can be called successfully
      expect(() => {
        syncSampleProcessingService.processSampleForSync(
          sample,
          "/local/store",
          results,
          "/sdcard",
        );
      }).not.toThrow();
    });

    it("should handle sample processing without SD card", () => {
      // Test that the method handles non-SD card paths
      expect(() => {
        syncSampleProcessingService.processSampleForSync(
          sample,
          "/local/store",
          results,
        );
      }).not.toThrow();
    });
  });
});
