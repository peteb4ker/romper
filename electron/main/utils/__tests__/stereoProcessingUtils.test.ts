import { beforeEach, describe, expect, it, vi } from "vitest";

import { determineStereoConfiguration } from "../stereoProcessingUtils";

// Mock dependencies
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
}));

import * as audioUtils from "../../audioUtils.js";

const mockGetAudioMetadata = vi.mocked(audioUtils.getAudioMetadata);

describe("stereoProcessingUtils", () => {
  const testFilePath = "/path/to/sample.wav";
  let mockInMemorySettings: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockInMemorySettings = {};
  });

  describe("determineStereoConfiguration", () => {
    describe("with forceMono option", () => {
      it("should return false when forceMono is true", () => {
        mockInMemorySettings.defaultToMonoSamples = false;

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
          { forceMono: true },
        );

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).not.toHaveBeenCalled();
      });

      it("should override forceStereo when both are specified", () => {
        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
          { forceMono: true, forceStereo: true },
        );

        expect(result).toBe(false);
      });
    });

    describe("with forceStereo option", () => {
      it("should return true when forceStereo is true", () => {
        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
          { forceStereo: true },
        );

        expect(result).toBe(true);
        expect(mockGetAudioMetadata).not.toHaveBeenCalled();
      });

      it("should work with defaultToMonoSamples setting", () => {
        mockInMemorySettings.defaultToMonoSamples = true;

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
          { forceStereo: true },
        );

        expect(result).toBe(true);
      });
    });

    describe("with defaultToMonoSamples setting", () => {
      it("should return false when defaultToMonoSamples is true (default)", () => {
        mockInMemorySettings.defaultToMonoSamples = true;

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).not.toHaveBeenCalled();
      });

      it("should use true as default when defaultToMonoSamples is undefined", () => {
        // mockInMemorySettings.defaultToMonoSamples is undefined

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).not.toHaveBeenCalled();
      });

      it("should check file metadata when defaultToMonoSamples is false", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 2 },
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(true);
        expect(mockGetAudioMetadata).toHaveBeenCalledWith(testFilePath);
      });

      it("should return false for mono file when defaultToMonoSamples is false", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 1 },
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).toHaveBeenCalledWith(testFilePath);
      });
    });

    describe("error handling", () => {
      it("should handle getAudioMetadata failure gracefully", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          error: "Failed to read metadata",
          success: false,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).toHaveBeenCalledWith(testFilePath);
      });

      it("should handle missing metadata gracefully", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: null,
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
      });

      it("should handle missing channels in metadata", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: {}, // Missing channels property
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
      });

      it("should default to mono for channels undefined", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: undefined },
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle multichannel audio (> 2 channels)", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 6 }, // 5.1 surround
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(true); // More than 1 channel = stereo in this context
      });

      it("should handle zero channels gracefully", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 0 },
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false); // 0 channels <= 1, so mono
      });
    });

    describe("integration scenarios", () => {
      it("should work correctly with typical mono workflow", () => {
        mockInMemorySettings.defaultToMonoSamples = true;

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).not.toHaveBeenCalled();
      });

      it("should work correctly with stereo-detection workflow", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 2 },
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
        );

        expect(result).toBe(true);
        expect(mockGetAudioMetadata).toHaveBeenCalledWith(testFilePath);
      });

      it("should prioritize user override over automatic detection", () => {
        mockInMemorySettings.defaultToMonoSamples = false;
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 2 },
          success: true,
        });

        const result = determineStereoConfiguration(
          testFilePath,
          mockInMemorySettings,
          { forceMono: true },
        );

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).not.toHaveBeenCalled();
      });
    });
  });
});
