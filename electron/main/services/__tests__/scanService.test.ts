import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("node:fs", () => ({
  promises: { readdir: vi.fn() },
  statSync: vi.fn(),
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
vi.mock("../kitScanReads.js", () => ({
  mergeKitScanReadingAsync: vi.fn(),
}));

vi.mock("../../db/romperDbCoreORM.js", () => ({
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

import { getAudioMetadata } from "../../audioUtils.js";
import { mergeKitScanReadingAsync } from "../kitScanReads.js";
import { readWavMetadata, ScanService } from "../scanService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockMergeKitScan = vi.mocked(mergeKitScanReadingAsync);
const mockReaddir = vi.mocked(fs.promises.readdir);
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
    mockFs.statSync.mockReturnValue({
      mtimeMs: 1_700_000_000_000.75,
      size: 88_244,
    } as fs.Stats);
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
      mockReaddir.mockResolvedValue([
        "1_kick.wav",
        "1_snare.WAV",
        "2_hihat.wav",
        "readme.txt", // Non-WAV file should be ignored
      ] as unknown as fs.Dirent<NonSharedBuffer>[]);

      mockGroupSamplesByVoice.mockReturnValue({
        1: ["1_kick.wav", "1_snare.WAV"],
        2: ["2_hihat.wav"],
        3: [],
        4: [],
      });

      mockMergeKitScan.mockResolvedValue({
        data: { ...EMPTY_SCAN_RESULT, addedSamples: 3, scannedSamples: 3 },
        success: true,
      });
    });

    it("merges the kit folder's WAV files instead of deleting samples", async () => {
      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(result.data?.addedSamples).toBe(3);
      expect(mockReaddir).toHaveBeenCalledWith("/test/path/TestKit");
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
      );
    });

    it("returns the merge result unchanged, including a locked kit", async () => {
      const locked = { ...EMPTY_SCAN_RESULT, locked: true, scannedSamples: 3 };
      mockMergeKitScan.mockResolvedValue({ data: locked, success: true });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result).toEqual({ data: locked, success: true });
    });

    it("returns error when no local store path configured", async () => {
      const result = await scanService.rescanKit({}, "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
      expect(mockMergeKitScan).not.toHaveBeenCalled();
    });

    it("returns error when kit directory does not exist", async () => {
      mockReaddir.mockRejectedValue(
        Object.assign(new Error("ENOENT: no such file or directory"), {
          code: "ENOENT",
        }),
      );

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit directory not found");
      expect(mockMergeKitScan).not.toHaveBeenCalled();
    });

    it("reports a failed (rolled back) merge", async () => {
      mockMergeKitScan.mockResolvedValue({
        error: "SQLITE_BUSY",
        success: false,
      });

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to scan kit TestKit: SQLITE_BUSY");
    });

    it("handles exceptions gracefully", async () => {
      mockReaddir.mockRejectedValue(new Error("Permission denied"));

      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "TestKit",
      );

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
        source_mtime_ms: 1_700_000_000_000,
        source_size: 88_244,
        source_status: "readable",
        wav_bit_depth: 16,
        wav_bitrate: null,
        wav_channels: null,
        wav_format_tag: null,
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
    beforeEach(() => {
      vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("rescans a kit in the override, not the saved path", async () => {
      mockReaddir.mockResolvedValue([]);
      mockGroupSamplesByVoice.mockReturnValue({});
      mockMergeKitScan.mockResolvedValue({
        data: EMPTY_SCAN_RESULT,
        success: true,
      });

      const result = await scanService.rescanKit(mockInMemorySettings, "A0");

      expect(result.success).toBe(true);
      expect(mockReaddir).toHaveBeenCalledWith("/env/store/A0");
      expect(mockMergeKitScan).toHaveBeenCalledWith(
        "/env/store/.romperdb",
        "A0",
        expect.objectContaining({ kitPath: "/env/store/A0" }),
      );
    });
  });
});
