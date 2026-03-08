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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("determineStereoConfiguration", () => {
    describe("stereo file detection", () => {
      it("should return true for stereo file", () => {
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 2 },
          success: true,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(true);
        expect(mockGetAudioMetadata).toHaveBeenCalledWith(testFilePath);
      });

      it("should return false for mono file", () => {
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 1 },
          success: true,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).toHaveBeenCalledWith(testFilePath);
      });
    });

    describe("error handling", () => {
      it("should handle getAudioMetadata failure gracefully", () => {
        mockGetAudioMetadata.mockReturnValue({
          error: "Failed to read metadata",
          success: false,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(false);
        expect(mockGetAudioMetadata).toHaveBeenCalledWith(testFilePath);
      });

      it("should handle missing metadata gracefully", () => {
        mockGetAudioMetadata.mockReturnValue({
          data: null,
          success: true,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(false);
      });

      it("should handle missing channels in metadata", () => {
        mockGetAudioMetadata.mockReturnValue({
          data: {}, // Missing channels property
          success: true,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(false);
      });

      it("should default to mono for channels undefined", () => {
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: undefined },
          success: true,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle multichannel audio (> 2 channels)", () => {
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 6 }, // 5.1 surround
          success: true,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(true); // More than 1 channel = stereo in this context
      });

      it("should handle zero channels gracefully", () => {
        mockGetAudioMetadata.mockReturnValue({
          data: { channels: 0 },
          success: true,
        });

        const result = determineStereoConfiguration(testFilePath);

        expect(result).toBe(false); // 0 channels <= 1, so mono
      });
    });
  });
});
