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
  updateBank: vi.fn(),
  updateVoiceAlias: vi.fn(),
}));

import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "@romper/shared/kitUtilsShared.js";

import {
  addSample,
  deleteSamples,
  updateBank,
  updateVoiceAlias,
} from "../../db/romperDbCoreORM.js";
import { ScanService } from "../scanService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockAddSample = vi.mocked(addSample);
const mockDeleteSamples = vi.mocked(deleteSamples);
const mockUpdateBank = vi.mocked(updateBank);
const mockUpdateVoiceAlias = vi.mocked(updateVoiceAlias);
const mockGroupSamplesByVoice = vi.mocked(groupSamplesByVoice);
const mockInferVoiceTypeFromFilename = vi.mocked(inferVoiceTypeFromFilename);

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
    mockAddSample.mockReturnValue({ success: true });
    mockUpdateVoiceAlias.mockReturnValue({ success: true });
    mockUpdateBank.mockReturnValue({ success: true });
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
});
