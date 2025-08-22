import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock shared utilities
vi.mock("@romper/shared/kitUtilsShared.js", () => ({
  groupSamplesByVoice: vi.fn(),
  inferVoiceTypeFromFilename: vi.fn(),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
  getAllSamples: vi.fn(),
  updateBank: vi.fn(),
  updateSampleMetadata: vi.fn(),
  updateVoiceAlias: vi.fn(),
}));

// Mock audio utilities
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
}));

import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "@romper/shared/kitUtilsShared.js";

import { getAudioMetadata } from "../../audioUtils.js";
import {
  addSample,
  deleteSamples,
  getAllSamples,
  updateBank,
  updateSampleMetadata,
  updateVoiceAlias,
} from "../../db/romperDbCoreORM.js";
import { ScanService } from "../scanService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockAddSample = vi.mocked(addSample);
const mockDeleteSamples = vi.mocked(deleteSamples);
const mockUpdateBank = vi.mocked(updateBank);
const mockUpdateSampleMetadata = vi.mocked(updateSampleMetadata);
const mockUpdateVoiceAlias = vi.mocked(updateVoiceAlias);
const mockGroupSamplesByVoice = vi.mocked(groupSamplesByVoice);
const mockInferVoiceTypeFromFilename = vi.mocked(inferVoiceTypeFromFilename);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);

describe("ScanService", () => {
  let scanService: ScanService;
  const mockInMemorySettings = {
    localStorePath: "/test/path",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    scanService = new ScanService();

    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockFs.existsSync.mockReturnValue(true);
    mockDeleteSamples.mockReturnValue({ success: true });
    mockAddSample.mockReturnValue({ data: { sampleId: 1 }, success: true });
    mockUpdateSampleMetadata.mockReturnValue({ success: true });
    mockUpdateVoiceAlias.mockReturnValue({ success: true });
    mockUpdateBank.mockReturnValue({ success: true });
    mockGetAudioMetadata.mockReturnValue({
      data: {
        bitDepth: 16,
        channels: 2,
        sampleRate: 44100,
      },
      success: true,
    });
  });

  describe("rescanKit", () => {
    beforeEach(() => {
      mockFs.readdirSync.mockReturnValue([
        "1_kick.wav",
        "1_snare.wav",
        "2_hihat.wav",
        "2_openhat.wav",
        "readme.txt", // Non-WAV file should be ignored
      ] as unknown);

      mockGroupSamplesByVoice.mockReturnValue({
        "1": ["1_kick.wav", "1_snare.wav"],
        "2": ["2_hihat.wav", "2_openhat.wav"],
      });

      mockInferVoiceTypeFromFilename.mockImplementation((filename: string) => {
        if (filename.includes("kick")) return "KICK";
        if (filename.includes("hihat")) return "HIHAT";
        return null;
      });
    });

    it("successfully rescans a kit directory", async () => {
      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(result.data?.scannedSamples).toBe(4);
      expect(result.data?.updatedVoices).toBe(2);

      // Should delete existing samples first
      expect(mockDeleteSamples).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );

      // Should scan kit directory
      expect(mockFs.readdirSync).toHaveBeenCalledWith("/test/path/TestKit");

      // Should add new samples
      expect(mockAddSample).toHaveBeenCalledTimes(4);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          filename: "1_kick.wav",
          is_stereo: false,
          kit_name: "TestKit",
          slot_number: 0,
          source_path: "/test/path/TestKit/1_kick.wav",
          voice_number: 1,
        }),
      );

      // Should update voice aliases
      expect(mockUpdateVoiceAlias).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        1,
        "KICK",
      );
      expect(mockUpdateVoiceAlias).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        2,
        "HIHAT",
      );

      // Should extract and save WAV metadata for each sample
      expect(mockGetAudioMetadata).toHaveBeenCalledTimes(4);
      expect(mockGetAudioMetadata).toHaveBeenCalledWith(
        "/test/path/TestKit/1_kick.wav",
      );
      expect(mockGetAudioMetadata).toHaveBeenCalledWith(
        "/test/path/TestKit/1_snare.wav",
      );
      expect(mockGetAudioMetadata).toHaveBeenCalledWith(
        "/test/path/TestKit/2_hihat.wav",
      );
      expect(mockGetAudioMetadata).toHaveBeenCalledWith(
        "/test/path/TestKit/2_openhat.wav",
      );

      // Should update sample metadata for each sample
      expect(mockUpdateSampleMetadata).toHaveBeenCalledTimes(4);
      expect(mockUpdateSampleMetadata).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        1,
        {
          wav_bit_depth: 16,
          wav_bitrate: 44100 * 2 * 16, // sampleRate * channels * bitDepth
          wav_channels: 2,
          wav_sample_rate: 44100,
        },
      );
    });

    it("detects stereo samples by filename patterns", async () => {
      mockFs.readdirSync.mockReturnValue([
        "1_kick_stereo.wav",
        "2_hat_st.wav",
      ] as unknown);
      mockGroupSamplesByVoice.mockReturnValue({
        "1": ["1_kick_stereo.wav"],
        "2": ["2_hat_st.wav"],
      });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          filename: "1_kick_stereo.wav",
          is_stereo: true,
        }),
      );
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          filename: "2_hat_st.wav",
          is_stereo: true,
        }),
      );
    });

    it("returns error when no local store path configured", async () => {
      const result = await scanService.rescanKit({}, "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("returns error when kit directory does not exist", async () => {
      mockFs.existsSync.mockImplementation(
        (path: string) => !path.includes("TestKit"),
      );

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit directory not found");
    });

    it("handles delete samples failure", async () => {
      mockDeleteSamples.mockReturnValue({
        error: "Delete failed",
        success: false,
      });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("handles add sample failure", async () => {
      mockAddSample.mockReturnValue({ error: "Add failed", success: false });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Add failed");
    });

    it("handles exceptions gracefully", async () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to scan kit directory: Permission denied",
      );
    });

    it("handles WAV metadata extraction failure gracefully", async () => {
      mockGetAudioMetadata.mockReturnValue({
        error: "Invalid WAV format",
        success: false,
      });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(result.data?.scannedSamples).toBe(4);
      // Should still add samples even if metadata extraction fails
      expect(mockAddSample).toHaveBeenCalledTimes(4);
      // Should not attempt to update metadata for failed extractions
      expect(mockUpdateSampleMetadata).not.toHaveBeenCalled();
    });

    it("handles incomplete WAV metadata gracefully", async () => {
      mockGetAudioMetadata.mockReturnValue({
        data: {
          bitDepth: 16,
          // Missing channels and sampleRate
        },
        success: true,
      });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(mockUpdateSampleMetadata).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        1,
        {
          wav_bit_depth: 16,
          wav_bitrate: null, // Should be null when calculation fails
          wav_channels: null,
          wav_sample_rate: null,
        },
      );
    });

    it("calculates bitrate correctly for different audio formats", async () => {
      mockGetAudioMetadata.mockReturnValue({
        data: {
          bitDepth: 24,
          channels: 1,
          sampleRate: 48000,
        },
        success: true,
      });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(mockUpdateSampleMetadata).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        1,
        {
          wav_bit_depth: 24,
          wav_bitrate: 48000 * 1 * 24, // 1,152,000 bps
          wav_channels: 1,
          wav_sample_rate: 48000,
        },
      );
    });

    it("handles missing sample metadata when addSample fails", async () => {
      mockAddSample.mockReturnValue({ error: "Add failed", success: false });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Add failed");
      // Should not attempt metadata extraction if sample insertion fails
      expect(mockGetAudioMetadata).not.toHaveBeenCalled();
      expect(mockUpdateSampleMetadata).not.toHaveBeenCalled();
    });
  });

  describe("scanBanks", () => {
    beforeEach(() => {
      mockFs.readdirSync.mockReturnValue([
        "A - Artist One.rtf",
        "B - Artist Two.rtf",
        "C - Artist Three.rtf",
        "invalid-format.rtf",
        "D - Artist Four.txt", // Wrong extension
        "regular-file.wav",
      ] as unknown);
    });

    it("successfully scans bank RTF files", async () => {
      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.scannedFiles).toBe(3); // Only valid RTF files
      expect(result.data?.updatedBanks).toBe(3);
      expect(result.data?.scannedAt).toBeInstanceOf(Date);

      // Should scan local store root
      expect(mockFs.readdirSync).toHaveBeenCalledWith("/test/path");

      // Should update banks for valid files
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A",
        expect.objectContaining({
          artist: "Artist One",
          rtf_filename: "A - Artist One.rtf",
        }),
      );
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "B",
        expect.objectContaining({
          artist: "Artist Two",
          rtf_filename: "B - Artist Two.rtf",
        }),
      );
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "C",
        expect.objectContaining({
          artist: "Artist Three",
          rtf_filename: "C - Artist Three.rtf",
        }),
      );
    });

    it("converts bank letters to uppercase", async () => {
      mockFs.readdirSync.mockReturnValue(["a - Artist Lower.rtf"] as unknown);

      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A", // Converted to uppercase
        expect.objectContaining({
          artist: "Artist Lower",
          rtf_filename: "a - Artist Lower.rtf",
        }),
      );
    });

    it("returns error when no local store path configured", async () => {
      const result = await scanService.scanBanks({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("returns error when local store path does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Local store path not found");
    });

    it("handles partial bank update failures", async () => {
      mockUpdateBank.mockImplementation((dbDir: string, bankLetter: string) => {
        if (bankLetter === "B") {
          return { error: "Update failed", success: false };
        }
        return { success: true };
      });

      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.scannedFiles).toBe(3);
      expect(result.data?.updatedBanks).toBe(2); // Only successful updates counted
    });

    it("handles exceptions gracefully", async () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to scan banks: Access denied");
    });
  });

  describe("rescanKitsWithMissingMetadata", () => {
    const mockGetAllSamples = vi.mocked(getAllSamples);

    beforeEach(() => {
      vi.clearAllMocks();
      mockFs.existsSync.mockReturnValue(true);
      mockGetAllSamples.mockReturnValue({ data: [], success: true });
    });

    it("identifies and rescans kits with missing metadata", async () => {
      // Mock samples with mixed metadata status
      const mockSamples = [
        // Kit A0 has complete metadata
        {
          filename: "sample1.wav",
          kit_name: "A0",
          wav_bit_depth: 16,
          wav_channels: 2,
          wav_sample_rate: 44100,
        },
        // Kit A1 has missing metadata
        {
          filename: "sample2.wav",
          kit_name: "A1",
          wav_bit_depth: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
        // Kit A2 has mixed metadata (some missing)
        {
          filename: "sample3.wav",
          kit_name: "A2",
          wav_bit_depth: null, // Missing
          wav_channels: 2,
          wav_sample_rate: 44100,
        },
      ];

      mockGetAllSamples.mockReturnValue({
        data: mockSamples as unknown[],
        success: true,
      });

      // Mock successful kit rescanning
      const scanService = new ScanService();
      vi.spyOn(scanService, "rescanKit").mockResolvedValue({
        data: { scannedSamples: 5, updatedVoices: 2 },
        success: true,
      });

      const result =
        await scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.kitsNeedingRescan).toEqual(["A1", "A2"]);
      expect(result.data?.kitsRescanned).toEqual(["A1", "A2"]);
      expect(result.data?.totalSamplesUpdated).toBe(10); // 5 + 5 from both rescans
    });

    it("handles kits with no missing metadata", async () => {
      // Mock samples with complete metadata
      const mockSamples = [
        {
          filename: "sample1.wav",
          kit_name: "A0",
          wav_bit_depth: 16,
          wav_channels: 2,
          wav_sample_rate: 44100,
        },
      ];

      mockGetAllSamples.mockReturnValue({
        data: mockSamples as unknown[],
        success: true,
      });

      const result =
        await scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.kitsNeedingRescan).toEqual([]);
      expect(result.data?.kitsRescanned).toEqual([]);
      expect(result.data?.totalSamplesUpdated).toBe(0);
    });

    it("returns error when no local store path configured", async () => {
      const result = await scanService.rescanKitsWithMissingMetadata({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("returns error when getAllSamples fails", async () => {
      mockGetAllSamples.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result =
        await scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to query samples");
    });

    it("handles individual kit rescan failures gracefully", async () => {
      const mockSamples = [
        {
          filename: "sample1.wav",
          kit_name: "A1",
          wav_bit_depth: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
        {
          filename: "sample2.wav",
          kit_name: "A2",
          wav_bit_depth: null,
          wav_channels: null,
          wav_sample_rate: null,
        },
      ];

      mockGetAllSamples.mockReturnValue({
        data: mockSamples as unknown[],
        success: true,
      });

      const scanService = new ScanService();
      vi.spyOn(scanService, "rescanKit").mockImplementation(
        async (_, kitName) => {
          if (kitName === "A1") {
            return { error: "Kit A1 failed", success: false };
          }
          return {
            data: { scannedSamples: 3, updatedVoices: 1 },
            success: true,
          };
        },
      );

      const result =
        await scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.kitsNeedingRescan).toEqual(["A1", "A2"]);
      expect(result.data?.kitsRescanned).toEqual(["A2"]); // Only successful one
      expect(result.data?.totalSamplesUpdated).toBe(3);
    });

    it("handles exceptions gracefully", async () => {
      mockGetAllSamples.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const result =
        await scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to rescan kits with missing metadata: Database connection failed",
      );
    });
  });
});
