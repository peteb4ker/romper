import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
  basename: vi.fn((p) => p.split("/").pop()),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
  getKitSamples: vi.fn(),
  markKitAsModified: vi.fn(),
}));

// Mock audioUtils
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
}));

import { getAudioMetadata } from "../../audioUtils.js";
import {
  addSample,
  deleteSamples,
  getKitSamples,
  markKitAsModified,
} from "../../db/romperDbCoreORM.js";
import { SampleService } from "../sampleService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockAddSample = vi.mocked(addSample);
const mockDeleteSamples = vi.mocked(deleteSamples);
const mockGetKitSamples = vi.mocked(getKitSamples);
const mockMarkKitAsModified = vi.mocked(markKitAsModified);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);

describe("SampleService", () => {
  let sampleService: SampleService;
  const mockInMemorySettings = {
    localStorePath: "/test/path",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sampleService = new SampleService();

    // Set up default successful mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ size: 1024 } as any);
    mockFs.openSync.mockReturnValue(3 as any);
    mockFs.closeSync.mockReturnValue(undefined);
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.basename.mockImplementation((p) => p.split("/").pop() || "");

    // Mock valid WAV file header
    const validWavHeader = Buffer.from("RIFF\x20\x00\x00\x00WAVE");
    mockFs.readSync.mockImplementation(
      (fd, buffer, offset, length, position) => {
        validWavHeader.copy(
          buffer as Buffer,
          offset,
          0,
          Math.min(length, validWavHeader.length),
        );
        return 12;
      },
    );

    mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });
    mockDeleteSamples.mockReturnValue({ success: true });
    mockMarkKitAsModified.mockReturnValue({ success: true });
  });

  describe("validateVoiceAndSlot", () => {
    it("accepts valid voice numbers 1-4", () => {
      for (let voice = 1; voice <= 4; voice++) {
        const result = sampleService.validateVoiceAndSlot(voice, 0);
        expect(result.isValid).toBe(true);
      }
    });

    it("rejects voice number 0", () => {
      const result = sampleService.validateVoiceAndSlot(0, 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
    });

    it("rejects voice number 5", () => {
      const result = sampleService.validateVoiceAndSlot(5, 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
    });

    it("accepts valid slot indices 0-11", () => {
      for (let slot = 0; slot <= 11; slot++) {
        const result = sampleService.validateVoiceAndSlot(1, slot);
        expect(result.isValid).toBe(true);
      }
    });

    it("rejects slot index -1", () => {
      const result = sampleService.validateVoiceAndSlot(1, -1);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)",
      );
    });

    it("rejects slot index 12", () => {
      const result = sampleService.validateVoiceAndSlot(1, 12);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)",
      );
    });
  });

  describe("validateSampleFile", () => {
    it("accepts valid WAV files", () => {
      const result = sampleService.validateSampleFile("/test/valid.wav");
      expect(result.isValid).toBe(true);
    });

    it("rejects non-existent files", () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = sampleService.validateSampleFile("/test/missing.wav");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Sample file not found");
    });

    it("rejects non-WAV files", () => {
      const result = sampleService.validateSampleFile("/test/audio.mp3");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Only WAV files are supported");
    });

    it("rejects files too small for WAV header", () => {
      mockFs.statSync.mockReturnValue({ size: 20 } as any);
      const result = sampleService.validateSampleFile("/test/tiny.wav");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("File too small to be a valid WAV file");
    });

    it("rejects files without RIFF signature", () => {
      const invalidHeader = Buffer.from("FAKE\x20\x00\x00\x00WAVE");
      mockFs.readSync.mockImplementation(
        (fd, buffer, offset, length, position) => {
          invalidHeader.copy(
            buffer as Buffer,
            offset,
            0,
            Math.min(length, invalidHeader.length),
          );
          return 12;
        },
      );

      const result = sampleService.validateSampleFile("/test/invalid.wav");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid WAV file: missing RIFF signature");
    });

    it("rejects files without WAVE format identifier", () => {
      const invalidHeader = Buffer.from("RIFF\x20\x00\x00\x00FAKE");
      mockFs.readSync.mockImplementation(
        (fd, buffer, offset, length, position) => {
          invalidHeader.copy(
            buffer as Buffer,
            offset,
            0,
            Math.min(length, invalidHeader.length),
          );
          return 12;
        },
      );

      const result = sampleService.validateSampleFile("/test/invalid.wav");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Invalid WAV file: missing WAVE format identifier",
      );
    });

    it("handles file read errors gracefully", () => {
      mockFs.openSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = sampleService.validateSampleFile("/test/error.wav");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "Failed to validate file: Permission denied",
      );
    });
  });

  describe("addSampleToSlot", () => {
    it("successfully adds valid sample", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          kit_name: "TestKit",
          voice_number: 1,
          slot_number: 1, // 0-based index converted to 1-based
          source_path: "/test/sample.wav",
        }),
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("rejects invalid voice number", () => {
      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "TestKit",
        0,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("rejects invalid file", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/missing.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sample file not found");
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("returns error when no local store path configured", () => {
      const result = sampleService.addSampleToSlot(
        {},
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("marks kit as modified only when operation succeeds", () => {
      mockAddSample.mockReturnValue({ success: false, error: "DB error" });

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    // Task 7.1.2 tests: Apply 'default to mono samples' setting
    it("marks stereo file as mono when defaultToMonoSamples is true", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { channels: 2, sampleRate: 44100, bitDepth: 16 },
      });

      const settingsWithMono = {
        ...mockInMemorySettings,
        defaultToMonoSamples: true,
      };

      const result = sampleService.addSampleToSlot(
        settingsWithMono,
        "TestKit",
        1,
        0,
        "/test/stereo.wav",
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should be false even though file is stereo
        }),
      );
      // Should NOT call getAudioMetadata when defaultToMonoSamples is true
      expect(mockGetAudioMetadata).not.toHaveBeenCalled();
    });

    it("marks stereo file as stereo when defaultToMonoSamples is false", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { channels: 2, sampleRate: 44100, bitDepth: 16 },
      });

      const settingsWithStereo = {
        ...mockInMemorySettings,
        defaultToMonoSamples: false,
      };

      const result = sampleService.addSampleToSlot(
        settingsWithStereo,
        "TestKit",
        1,
        0,
        "/test/stereo.wav",
      );

      expect(result.success).toBe(true);
      expect(mockGetAudioMetadata).toHaveBeenCalledWith("/test/stereo.wav");
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: true, // Should be true because file is stereo and setting is OFF
        }),
      );
    });

    it("marks mono file as mono regardless of defaultToMonoSamples setting", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { channels: 1, sampleRate: 44100, bitDepth: 16 },
      });

      const settingsWithStereo = {
        ...mockInMemorySettings,
        defaultToMonoSamples: false,
      };

      const result = sampleService.addSampleToSlot(
        settingsWithStereo,
        "TestKit",
        1,
        0,
        "/test/mono.wav",
      );

      expect(result.success).toBe(true);
      expect(mockGetAudioMetadata).toHaveBeenCalledWith("/test/mono.wav");
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should be false because file is actually mono
        }),
      );
    });

    it("defaults to mono when defaultToMonoSamples is undefined", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      const settingsWithoutDefault = {
        ...mockInMemorySettings,
        // defaultToMonoSamples not set
      };

      const result = sampleService.addSampleToSlot(
        settingsWithoutDefault,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should default to mono (true)
        }),
      );
      expect(mockGetAudioMetadata).not.toHaveBeenCalled();
    });
  });

  describe("deleteSampleFromSlot", () => {
    it("successfully deletes sample", () => {
      // Mock existing sample at the slot
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [{ voice_number: 2, slot_number: 6, filename: "existing.wav" }],
      });

      const result = sampleService.deleteSampleFromSlot(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(true);
      expect(mockDeleteSamples).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        { voiceNumber: 2, slotNumber: 6 }, // 0-based index converted to 1-based
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("marks kit as modified only when operation succeeds", () => {
      mockDeleteSamples.mockReturnValue({ success: false, error: "DB error" });

      const result = sampleService.deleteSampleFromSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });
  });

  describe("validateSampleSources", () => {
    it("validates all samples for a kit", () => {
      const mockSamples = [
        { filename: "kick.wav", source_path: "/path/to/kick.wav" },
        { filename: "snare.wav", source_path: "/path/to/snare.wav" },
      ];

      mockGetKitSamples.mockReturnValue({ success: true, data: mockSamples });

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(result.data?.totalSamples).toBe(2);
      expect(result.data?.validSamples).toBe(2);
      expect(result.data?.invalidSamples).toHaveLength(0);
    });

    it("identifies invalid sample sources", () => {
      const mockSamples = [
        { filename: "kick.wav", source_path: "/path/to/kick.wav" },
        { filename: "missing.wav", source_path: "/path/to/missing.wav" },
      ];

      mockGetKitSamples.mockReturnValue({ success: true, data: mockSamples });
      mockFs.existsSync.mockImplementation(
        (path: string) => !path.includes("missing.wav"),
      );

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(result.data?.totalSamples).toBe(2);
      expect(result.data?.validSamples).toBe(1);
      expect(result.data?.invalidSamples).toHaveLength(1);
      expect(result.data?.invalidSamples[0].filename).toBe("missing.wav");
      expect(result.data?.invalidSamples[0].error).toBe(
        "Sample file not found",
      );
    });

    it("handles samples without source_path", () => {
      const mockSamples = [
        { filename: "legacy.wav", source_path: null },
        { filename: "new.wav", source_path: "/path/to/new.wav" },
      ];

      mockGetKitSamples.mockReturnValue({ success: true, data: mockSamples });

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(result.data?.totalSamples).toBe(2);
      expect(result.data?.validSamples).toBe(2); // Legacy samples without source_path are counted as valid
      expect(result.data?.invalidSamples).toHaveLength(0);
    });
  });

  describe("replaceSampleInSlot", () => {
    it("successfully replaces sample", () => {
      // Mock existing sample at the slot
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [{ voice_number: 2, slot_number: 6, filename: "old.wav" }],
      });
      mockDeleteSamples.mockReturnValue({ success: true });
      mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });

      const result = sampleService.replaceSampleInSlot(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
        "/test/new-sample.wav",
      );

      expect(result.success).toBe(true);
      expect(mockDeleteSamples).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        { voiceNumber: 2, slotNumber: 6 },
      );
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          kit_name: "TestKit",
          voice_number: 2,
          slot_number: 6,
          source_path: "/test/new-sample.wav",
        }),
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("fails if delete operation fails", () => {
      // Mock existing sample at the slot
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [{ voice_number: 1, slot_number: 1, filename: "old.wav" }],
      });
      mockDeleteSamples.mockReturnValue({
        success: false,
        error: "Delete failed",
      });

      const result = sampleService.replaceSampleInSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/new-sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");
      expect(mockAddSample).not.toHaveBeenCalled();
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    // Task 7.1.2 tests for replaceSampleInSlot
    it("applies defaultToMonoSamples setting when replacing stereo sample", () => {
      // Mock existing sample at the slot
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [{ voice_number: 1, slot_number: 1, filename: "old.wav" }],
      });
      mockDeleteSamples.mockReturnValue({ success: true });
      mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { channels: 2, sampleRate: 44100, bitDepth: 16 },
      });

      const settingsWithMono = {
        ...mockInMemorySettings,
        defaultToMonoSamples: true,
      };

      const result = sampleService.replaceSampleInSlot(
        settingsWithMono,
        "TestKit",
        1,
        0,
        "/test/stereo-replace.wav",
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should be false even though file is stereo
        }),
      );
      expect(mockGetAudioMetadata).not.toHaveBeenCalled();
    });

    it("preserves stereo when defaultToMonoSamples is false for replacement", () => {
      // Mock existing sample at the slot
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [{ voice_number: 1, slot_number: 1, filename: "old.wav" }],
      });
      mockDeleteSamples.mockReturnValue({ success: true });
      mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { channels: 2, sampleRate: 44100, bitDepth: 16 },
      });

      const settingsWithStereo = {
        ...mockInMemorySettings,
        defaultToMonoSamples: false,
      };

      const result = sampleService.replaceSampleInSlot(
        settingsWithStereo,
        "TestKit",
        1,
        0,
        "/test/stereo-replace.wav",
      );

      expect(result.success).toBe(true);
      expect(mockGetAudioMetadata).toHaveBeenCalledWith(
        "/test/stereo-replace.wav",
      );
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: true, // Should be true because file is stereo and setting is OFF
        }),
      );
    });
  });
});
