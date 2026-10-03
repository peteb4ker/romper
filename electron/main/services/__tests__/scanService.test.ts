import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock path
vi.mock("node:path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock shared utilities
vi.mock("@romper/shared/kitUtilsShared.js", () => ({
  groupSamplesByVoice: vi.fn(),
  inferVoiceTypeFromFilename: vi.fn(),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  getAllSamples: vi.fn(),
  mergeKitScan: vi.fn(),
  updateBank: vi.fn(),
  // A bank scan commits once; each bank is a nested unit of work
  withDbTransaction: vi.fn((_dbDir: string, fn: () => unknown) => ({
    data: fn(),
    success: true,
  })),
}));

// Mock audio utilities
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
}));

import { groupSamplesByVoice } from "@romper/shared/kitUtilsShared.js";

import type { KitScanIo } from "../../db/operations/kitScanOperations.js";

import { getAudioMetadata } from "../../audioUtils.js";
import {
  getAllSamples,
  mergeKitScan,
  updateBank,
} from "../../db/romperDbCoreORM.js";
import { readWavMetadata, ScanService } from "../scanService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockMergeKitScan = vi.mocked(mergeKitScan);
const mockUpdateBank = vi.mocked(updateBank);
const mockGroupSamplesByVoice = vi.mocked(groupSamplesByVoice);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);

const EMPTY_SCAN_RESULT = {
  addedSamples: 0,
  locked: false,
  metadataUpdated: 0,
  missingSamples: [],
  scannedSamples: 0,
  skippedFiles: [],
  updatedVoices: 0,
};

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
        "1_snare.WAV",
        "2_hihat.wav",
        "readme.txt", // Non-WAV file should be ignored
      ] as unknown);

      mockGroupSamplesByVoice.mockReturnValue({
        1: ["1_kick.wav", "1_snare.WAV"],
        2: ["2_hihat.wav"],
        3: [],
        4: [],
      });

      mockMergeKitScan.mockReturnValue({
        data: { ...EMPTY_SCAN_RESULT, addedSamples: 3, scannedSamples: 3 },
        success: true,
      });
    });

    it("merges the kit folder's WAV files instead of deleting samples", () => {
      const result = scanService.rescanKit(mockInMemorySettings, "TestKit");

      expect(result.success).toBe(true);
      expect(result.data?.addedSamples).toBe(3);
      expect(mockFs.readdirSync).toHaveBeenCalledWith("/test/path/TestKit");
      expect(mockGroupSamplesByVoice).toHaveBeenCalledWith([
        "1_kick.wav",
        "1_snare.WAV",
        "2_hihat.wav",
      ]);
      expect(mockMergeKitScan).toHaveBeenCalledTimes(1);
      expect(mockMergeKitScan).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        {
          filesByVoice: {
            1: ["1_kick.wav", "1_snare.WAV"],
            2: ["2_hihat.wav"],
            3: [],
            4: [],
          },
          kitPath: "/test/path/TestKit",
        },
        expect.objectContaining({
          fileExists: expect.any(Function),
          readMetadata: expect.any(Function),
        }),
      );
    });

    it("gives the merge real file checks and WAV metadata", () => {
      scanService.rescanKit(mockInMemorySettings, "TestKit");
      const io = mockMergeKitScan.mock.calls[0][3] as KitScanIo;

      mockFs.existsSync.mockReturnValueOnce(false);
      expect(io.fileExists("/gone.wav")).toBe(false);

      mockGetAudioMetadata.mockReturnValue({
        data: { bitDepth: 16, channels: 2, sampleRate: 44100 },
        success: true,
      });
      expect(io.readMetadata("/x.wav")).toEqual({
        wav_bit_depth: 16,
        wav_bitrate: 44100 * 2 * 16,
        wav_channels: 2,
        wav_sample_rate: 44100,
      });
    });

    it("returns the merge result unchanged, including a locked kit", () => {
      const locked = { ...EMPTY_SCAN_RESULT, locked: true, scannedSamples: 3 };
      mockMergeKitScan.mockReturnValue({ data: locked, success: true });

      const result = scanService.rescanKit(mockInMemorySettings, "TestKit");

      expect(result).toEqual({ data: locked, success: true });
    });

    it("returns error when no local store path configured", () => {
      const result = scanService.rescanKit({}, "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
      expect(mockMergeKitScan).not.toHaveBeenCalled();
    });

    it("returns error when kit directory does not exist", () => {
      mockFs.existsSync.mockImplementation(
        (path: string) => !path.includes("TestKit"),
      );

      const result = scanService.rescanKit(mockInMemorySettings, "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit directory not found");
      expect(mockMergeKitScan).not.toHaveBeenCalled();
    });

    it("reports a failed (rolled back) merge", () => {
      mockMergeKitScan.mockReturnValue({
        error: "SQLITE_BUSY",
        success: false,
      });

      const result = scanService.rescanKit(mockInMemorySettings, "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to scan kit TestKit: SQLITE_BUSY");
    });

    it("handles exceptions gracefully", () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = scanService.rescanKit(mockInMemorySettings, "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to scan kit directory: Permission denied",
      );
      expect(mockMergeKitScan).not.toHaveBeenCalled();
    });
  });

  describe("readWavMetadata", () => {
    it("returns null when the WAV can't be read", () => {
      mockGetAudioMetadata.mockReturnValue({
        error: "Invalid WAV format",
        success: false,
      });

      expect(readWavMetadata("/bad.wav")).toBeNull();
    });

    it("leaves bitrate null when a field is missing", () => {
      mockGetAudioMetadata.mockReturnValue({
        data: { bitDepth: 16 },
        success: true,
      });

      expect(readWavMetadata("/partial.wav")).toEqual({
        wav_bit_depth: 16,
        wav_bitrate: null,
        wav_channels: null,
        wav_sample_rate: null,
      });
    });

    it("calculates bitrate for other formats", () => {
      mockGetAudioMetadata.mockReturnValue({
        data: { bitDepth: 24, channels: 1, sampleRate: 48000 },
        success: true,
      });

      expect(readWavMetadata("/mono.wav")?.wav_bitrate).toBe(48000 * 1 * 24);
    });
  });

  describe("with ROMPER_LOCAL_PATH set", () => {
    const noSavedPath = { localStorePath: null };

    beforeEach(() => {
      vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("scans banks in the override when no path is saved", () => {
      mockFs.readdirSync.mockReturnValue(["A - Artist One.rtf"] as unknown);

      const result = scanService.scanBanks(noSavedPath);

      expect(result.success).toBe(true);
      expect(mockFs.readdirSync).toHaveBeenCalledWith("/env/store");
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/env/store/.romperdb",
        "A",
        expect.objectContaining({ artist: "Artist One" }),
        { source: "scan" },
      );
    });

    it("rescans a kit in the override, not the saved path", () => {
      mockFs.readdirSync.mockReturnValue([] as unknown);
      mockGroupSamplesByVoice.mockReturnValue({});
      mockMergeKitScan.mockReturnValue({
        data: {
          addedSamples: 0,
          locked: false,
          metadataUpdated: 0,
          missingSamples: [],
          scannedSamples: 0,
          skippedFiles: [],
          updatedVoices: 0,
        },
        success: true,
      });

      const result = scanService.rescanKit(mockInMemorySettings, "A0");

      expect(result.success).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith("/env/store/A0");
      expect(mockMergeKitScan).toHaveBeenCalledWith(
        "/env/store/.romperdb",
        "A0",
        expect.objectContaining({ kitPath: "/env/store/A0" }),
        expect.anything(),
      );
    });

    it("reads samples from the override when finding kits to rescan", () => {
      vi.mocked(getAllSamples).mockReturnValue({ data: [], success: true });

      const result = scanService.rescanKitsWithMissingMetadata(noSavedPath);

      expect(result.success).toBe(true);
      expect(getAllSamples).toHaveBeenCalledWith("/env/store/.romperdb");
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

    it("successfully scans bank RTF files", () => {
      const result = scanService.scanBanks(mockInMemorySettings);

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
        { source: "scan" },
      );
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "B",
        expect.objectContaining({
          artist: "Artist Two",
          rtf_filename: "B - Artist Two.rtf",
        }),
        { source: "scan" },
      );
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "C",
        expect.objectContaining({
          artist: "Artist Three",
          rtf_filename: "C - Artist Three.rtf",
        }),
        { source: "scan" },
      );
    });

    it("converts bank letters to uppercase", () => {
      mockFs.readdirSync.mockReturnValue(["a - Artist Lower.rtf"] as unknown);

      const result = scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(mockUpdateBank).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A", // Converted to uppercase
        expect.objectContaining({
          artist: "Artist Lower",
          rtf_filename: "a - Artist Lower.rtf",
        }),
        { source: "scan" },
      );
    });

    it("returns error when no local store path configured", () => {
      const result = scanService.scanBanks({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("returns error when local store path does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Local store path not found");
    });

    it("handles partial bank update failures", () => {
      mockUpdateBank.mockImplementation((dbDir: string, bankLetter: string) => {
        if (bankLetter === "B") {
          return { error: "Update failed", success: false };
        }
        return { success: true };
      });

      const result = scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.scannedFiles).toBe(3);
      expect(result.data?.updatedBanks).toBe(2); // Only successful updates counted
    });

    it("handles exceptions gracefully", () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const result = scanService.scanBanks(mockInMemorySettings);

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

    it("identifies and rescans kits with missing metadata", () => {
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
      vi.spyOn(scanService, "rescanKit").mockReturnValue({
        data: { ...EMPTY_SCAN_RESULT, addedSamples: 1, metadataUpdated: 4 },
        success: true,
      });

      const result =
        scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.kitsNeedingRescan).toEqual(["A1", "A2"]);
      expect(result.data?.kitsRescanned).toEqual(["A1", "A2"]);
      expect(result.data?.totalSamplesUpdated).toBe(10); // (4 + 1) per kit
    });

    it("handles kits with no missing metadata", () => {
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
        scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.kitsNeedingRescan).toEqual([]);
      expect(result.data?.kitsRescanned).toEqual([]);
      expect(result.data?.totalSamplesUpdated).toBe(0);
    });

    it("returns error when no local store path configured", () => {
      const result = scanService.rescanKitsWithMissingMetadata({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("returns error when getAllSamples fails", () => {
      mockGetAllSamples.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result =
        scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to query samples");
    });

    it("handles individual kit rescan failures gracefully", () => {
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
      vi.spyOn(scanService, "rescanKit").mockImplementation((_, kitName) => {
        if (kitName === "A1") {
          return { error: "Kit A1 failed", success: false };
        }
        return {
          data: { ...EMPTY_SCAN_RESULT, metadataUpdated: 3 },
          success: true,
        };
      });

      const result =
        scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data?.kitsNeedingRescan).toEqual(["A1", "A2"]);
      expect(result.data?.kitsRescanned).toEqual(["A2"]); // Only successful one
      expect(result.data?.totalSamplesUpdated).toBe(3);
    });

    it("handles exceptions gracefully", () => {
      mockGetAllSamples.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const result =
        scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to rescan kits with missing metadata: Database connection failed",
      );
    });
  });
});
