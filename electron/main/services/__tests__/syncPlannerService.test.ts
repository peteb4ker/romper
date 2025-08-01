import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  getKitSamples: vi.fn(),
}));

// Mock audio utilities
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
  validateSampleFormat: vi.fn(),
}));

import { getAudioMetadata, validateSampleFormat } from "../../audioUtils.js";
import { getKitSamples } from "../../db/romperDbCoreORM.js";
import { SyncPlannerService } from "../syncPlannerService.js";

const mockFs = vi.mocked(fs);
const _mockPath = vi.mocked(path);
const mockGetKitSamples = vi.mocked(getKitSamples);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);
const mockValidateSampleFormat = vi.mocked(validateSampleFormat);

describe("SyncPlannerService", () => {
  let service: SyncPlannerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncPlannerService();
  });

  describe("generateChangeSummary", () => {
    it("should return error when no local store path is configured", async () => {
      const result = await service.generateChangeSummary({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("should return error when failed to load kits", async () => {
      // Mock getKits to fail
      vi.doMock("../../db/romperDbCoreORM.js", () => ({
        getKits: vi.fn().mockResolvedValue({
          success: false,
          error: "Database error",
        }),
        getKitSamples: mockGetKitSamples,
      }));

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should generate summary with files to copy when format is valid", async () => {
      // Mock getKits to return test kits
      vi.doMock("../../db/romperDbCoreORM.js", () => ({
        getKits: vi.fn().mockResolvedValue({
          success: true,
          data: [{ name: "TestKit1" }],
        }),
        getKitSamples: mockGetKitSamples,
      }));

      // Mock sample data
      const testSample = {
        filename: "test.wav",
        source_path: "/source/test.wav",
        voice_number: 1,
        kitName: "TestKit1",
      };

      mockGetKitSamples.mockResolvedValue({
        success: true,
        data: [testSample],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      mockGetAudioMetadata.mockResolvedValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100 },
      });

      mockValidateSampleFormat.mockResolvedValue({
        success: true,
        data: { isValid: true, issues: [] },
      });

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesToCopy).toHaveLength(1);
      expect(result.data?.filesToConvert).toHaveLength(0);
      expect(result.data?.totalSize).toBe(1024);
      expect(result.data?.hasFormatWarnings).toBe(false);
      expect(result.data?.warnings).toHaveLength(0);
      expect(result.data?.validationErrors).toHaveLength(0);
    });

    it("should generate summary with files to convert when format is invalid", async () => {
      // Mock getKits to return test kits
      vi.doMock("../../db/romperDbCoreORM.js", () => ({
        getKits: vi.fn().mockResolvedValue({
          success: true,
          data: [{ name: "TestKit1" }],
        }),
        getKitSamples: mockGetKitSamples,
      }));

      const testSample = {
        filename: "test.wav",
        source_path: "/source/test.wav",
        voice_number: 1,
        kitName: "TestKit1",
      };

      mockGetKitSamples.mockResolvedValue({
        success: true,
        data: [testSample],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      mockGetAudioMetadata.mockResolvedValue({
        success: true,
        data: { bitDepth: 24, sampleRate: 48000 },
      });

      mockValidateSampleFormat.mockResolvedValue({
        success: false,
        data: {
          isValid: false,
          issues: [
            { message: "Bit depth must be 16" },
            { message: "Sample rate must be 44100Hz" },
          ],
        },
      });

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesToCopy).toHaveLength(0);
      expect(result.data?.filesToConvert).toHaveLength(1);
      expect(result.data?.filesToConvert[0].operation).toBe("convert");
      expect(result.data?.filesToConvert[0].reason).toBe(
        "Bit depth must be 16, Sample rate must be 44100Hz",
      );
      expect(result.data?.filesToConvert[0].originalFormat).toBe(
        "24bit/48000Hz",
      );
      expect(result.data?.filesToConvert[0].targetFormat).toBe(
        "16bit/44100Hz WAV",
      );
      expect(result.data?.totalSize).toBe(2048);
      expect(result.data?.hasFormatWarnings).toBe(true);
      expect(result.data?.warnings).toHaveLength(1);
    });

    it("should add validation errors for missing files", async () => {
      // Mock getKits to return test kits
      vi.doMock("../../db/romperDbCoreORM.js", () => ({
        getKits: vi.fn().mockResolvedValue({
          success: true,
          data: [{ name: "TestKit1" }],
        }),
        getKitSamples: mockGetKitSamples,
      }));

      const testSample = {
        filename: "missing.wav",
        source_path: "/source/missing.wav",
        voice_number: 1,
        kitName: "TestKit1",
      };

      mockGetKitSamples.mockResolvedValue({
        success: true,
        data: [testSample],
      });

      mockFs.existsSync.mockReturnValue(false);

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesToCopy).toHaveLength(0);
      expect(result.data?.filesToConvert).toHaveLength(0);
      expect(result.data?.validationErrors).toHaveLength(1);
      expect(result.data?.validationErrors[0]).toEqual({
        filename: "missing.wav",
        sourcePath: "/source/missing.wav",
        error: "Source file not found: /source/missing.wav",
        type: "missing_file",
      });
    });

    it("should skip samples without source path", async () => {
      // Mock getKits to return test kits
      vi.doMock("../../db/romperDbCoreORM.js", () => ({
        getKits: vi.fn().mockResolvedValue({
          success: true,
          data: [{ name: "TestKit1" }],
        }),
        getKitSamples: mockGetKitSamples,
      }));

      const testSamples = [
        {
          filename: "baseline.wav",
          source_path: null, // No source path - should be skipped
          voice_number: 1,
          kitName: "TestKit1",
        },
        {
          filename: "user.wav",
          source_path: "/source/user.wav",
          voice_number: 2,
          kitName: "TestKit1",
        },
      ];

      mockGetKitSamples.mockResolvedValue({
        success: true,
        data: testSamples,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      mockValidateSampleFormat.mockResolvedValue({
        success: true,
        data: { isValid: true, issues: [] },
      });

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesToCopy).toHaveLength(1); // Only the user sample
      expect(result.data?.filesToCopy[0].filename).toBe("user.wav");
    });

    it("should handle errors gracefully", async () => {
      // Mock getKits to throw an error
      vi.doMock("../../db/romperDbCoreORM.js", () => ({
        getKits: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
        getKitSamples: mockGetKitSamples,
      }));

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to generate sync summary: Database connection failed",
      );
    });

    it("should process multiple kits correctly", async () => {
      // Mock getKits to return multiple kits
      vi.doMock("../../db/romperDbCoreORM.js", () => ({
        getKits: vi.fn().mockResolvedValue({
          success: true,
          data: [{ name: "Kit1" }, { name: "Kit2" }],
        }),
        getKitSamples: mockGetKitSamples,
      }));

      // Mock different samples for each kit
      mockGetKitSamples
        .mockResolvedValueOnce({
          success: true,
          data: [
            {
              filename: "kit1_sample.wav",
              source_path: "/source/kit1_sample.wav",
              voice_number: 1,
              kitName: "Kit1",
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          data: [
            {
              filename: "kit2_sample.wav",
              source_path: "/source/kit2_sample.wav",
              voice_number: 1,
              kitName: "Kit2",
            },
          ],
        });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      mockValidateSampleFormat.mockResolvedValue({
        success: true,
        data: { isValid: true, issues: [] },
      });

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesToCopy).toHaveLength(2);
      expect(result.data?.totalSize).toBe(2048); // 2 files × 1024 bytes
      expect(mockGetKitSamples).toHaveBeenCalledTimes(2);
    });
  });
});
