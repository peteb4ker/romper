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
  getKits: vi.fn(),
  getKitSamples: vi.fn(),
}));

// Mock audio utilities
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
  validateSampleFormat: vi.fn(),
}));

import { getAudioMetadata, validateSampleFormat } from "../../audioUtils.js";
import { getKits, getKitSamples } from "../../db/romperDbCoreORM.js";
import { SyncPlannerService } from "../syncPlannerService.js";

const mockFs = vi.mocked(fs);
const _mockPath = vi.mocked(path);
const mockGetKits = vi.mocked(getKits);
const mockGetKitSamples = vi.mocked(getKitSamples);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);
const mockValidateSampleFormat = vi.mocked(validateSampleFormat);

describe("SyncPlannerService", () => {
  let service: SyncPlannerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncPlannerService();

    // Mock the dynamic import
    vi.doMock("../../db/romperDbCoreORM.js", () => ({
      getKits: mockGetKits,
      getKitSamples: mockGetKitSamples,
    }));
  });

  describe("generateChangeSummary", () => {
    it("should return error when no local store path is configured", async () => {
      const result = await service.generateChangeSummary({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("should return error when failed to load kits", async () => {
      // Mock getKits to fail
      mockGetKits.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should generate summary with files to copy when format is valid", async () => {
      // Mock getKits to return test kits
      mockGetKits.mockReturnValue({
        data: [{ name: "TestKit1" }],
        success: true,
      });

      // Mock sample data
      const testSample = {
        filename: "test.wav",
        kitName: "TestKit1",
        source_path: "/source/test.wav",
        voice_number: 1,
      };

      mockGetKitSamples.mockReturnValue({
        data: [testSample],
        success: true,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      mockGetAudioMetadata.mockReturnValue({
        data: { bitDepth: 16, sampleRate: 44100 },
        success: true,
      });

      mockValidateSampleFormat.mockReturnValue({
        data: { issues: [], isValid: true },
        success: true,
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
      mockGetKits.mockReturnValue({
        data: [{ name: "TestKit1" }],
        success: true,
      });

      const testSample = {
        filename: "test.wav",
        kitName: "TestKit1",
        source_path: "/source/test.wav",
        voice_number: 1,
      };

      mockGetKitSamples.mockReturnValue({
        data: [testSample],
        success: true,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      mockGetAudioMetadata.mockReturnValue({
        data: { bitDepth: 24, sampleRate: 48000 },
        success: true,
      });

      mockValidateSampleFormat.mockReturnValue({
        data: {
          issues: [
            { message: "Bit depth must be 16" },
            { message: "Sample rate must be 44100Hz" },
          ],
          isValid: false,
        },
        success: false,
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
      mockGetKits.mockReturnValue({
        data: [{ name: "TestKit1" }],
        success: true,
      });

      const testSample = {
        filename: "missing.wav",
        kitName: "TestKit1",
        source_path: "/source/missing.wav",
        voice_number: 1,
      };

      mockGetKitSamples.mockReturnValue({
        data: [testSample],
        success: true,
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
        error: "Source file not found: /source/missing.wav",
        filename: "missing.wav",
        sourcePath: "/source/missing.wav",
        type: "missing_file",
      });
    });

    it("should skip samples without source path", async () => {
      // Mock getKits to return test kits
      mockGetKits.mockReturnValue({
        data: [{ name: "TestKit1" }],
        success: true,
      });

      const testSamples = [
        {
          filename: "baseline.wav",
          kitName: "TestKit1",
          source_path: null, // No source path - should be skipped
          voice_number: 1,
        },
        {
          filename: "user.wav",
          kitName: "TestKit1",
          source_path: "/source/user.wav",
          voice_number: 2,
        },
      ];

      mockGetKitSamples.mockReturnValue({
        data: testSamples,
        success: true,
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      mockValidateSampleFormat.mockReturnValue({
        data: { issues: [], isValid: true },
        success: true,
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
      mockGetKits.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const result = await service.generateChangeSummary({
        localStorePath: "/test/path",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to load kits: Database connection failed",
      );
    });

    it("should process multiple kits correctly", async () => {
      // Mock getKits to return multiple kits
      mockGetKits.mockReturnValue({
        data: [{ name: "Kit1" }, { name: "Kit2" }],
        success: true,
      });

      // Mock different samples for each kit
      mockGetKitSamples
        .mockReturnValueOnce({
          data: [
            {
              filename: "kit1_sample.wav",
              kitName: "Kit1",
              source_path: "/source/kit1_sample.wav",
              voice_number: 1,
            },
          ],
          success: true,
        })
        .mockReturnValueOnce({
          data: [
            {
              filename: "kit2_sample.wav",
              kitName: "Kit2",
              source_path: "/source/kit2_sample.wav",
              voice_number: 1,
            },
          ],
          success: true,
        });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      mockValidateSampleFormat.mockReturnValue({
        data: { issues: [], isValid: true },
        success: true,
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
