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
  deleteSamplesWithoutCompaction: vi.fn(),
  getKitSamples: vi.fn(),
  markKitAsModified: vi.fn(),
  moveSample: vi.fn(),
}));

// Mock audioUtils
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
}));

import { getAudioMetadata } from "../../audioUtils.js";
import {
  addSample,
  deleteSamples,
  deleteSamplesWithoutCompaction,
  getKitSamples,
  markKitAsModified,
  moveSample,
} from "../../db/romperDbCoreORM.js";
import { SampleService } from "../sampleService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockAddSample = vi.mocked(addSample);
const mockDeleteSamples = vi.mocked(deleteSamples);
const mockDeleteSamplesWithoutCompaction = vi.mocked(
  deleteSamplesWithoutCompaction,
);
const mockGetKitSamples = vi.mocked(getKitSamples);
const mockMarkKitAsModified = vi.mocked(markKitAsModified);
const mockMoveSample = vi.mocked(moveSample);
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
    mockFs.readSync.mockImplementation((fd, buffer, offset, length) => {
      validWavHeader.copy(
        buffer as Buffer,
        offset,
        0,
        Math.min(length, validWavHeader.length),
      );
      return 12;
    });

    mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });
    mockDeleteSamples.mockReturnValue({ success: true });
    mockDeleteSamplesWithoutCompaction.mockReturnValue({
      success: true,
      data: { deletedSamples: [] },
    });
    mockMoveSample.mockReturnValue({ success: true });
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
      mockFs.readSync.mockImplementation((fd, buffer, offset, length) => {
        invalidHeader.copy(
          buffer as Buffer,
          offset,
          0,
          Math.min(length, invalidHeader.length),
        );
        return 12;
      });

      const result = sampleService.validateSampleFile("/test/invalid.wav");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid WAV file: missing RIFF signature");
    });

    it("rejects files without WAVE format identifier", () => {
      const invalidHeader = Buffer.from("RIFF\x20\x00\x00\x00FAKE");
      mockFs.readSync.mockImplementation((fd, buffer, offset, length) => {
        invalidHeader.copy(
          buffer as Buffer,
          offset,
          0,
          Math.min(length, invalidHeader.length),
        );
        return 12;
      });

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

  describe("getSampleAudioBuffer", () => {
    it("successfully returns audio buffer for existing sample", () => {
      const mockSample = {
        voice_number: 2,
        slot_number: 3,
        filename: "test.wav",
        source_path: "/path/to/test.wav",
      };

      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [mockSample],
      });

      const mockFileData = Buffer.from("mock audio data");
      mockFs.readFileSync.mockReturnValue(mockFileData);

      const result = sampleService.getSampleAudioBuffer(
        mockInMemorySettings,
        "TestKit",
        2,
        3,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        mockFileData.buffer.slice(
          mockFileData.byteOffset,
          mockFileData.byteOffset + mockFileData.byteLength,
        ),
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith("/path/to/test.wav");
    });

    it("returns null for non-existent sample (empty slot)", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [], // No samples
      });

      const result = sampleService.getSampleAudioBuffer(
        mockInMemorySettings,
        "TestKit",
        2,
        3,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns error when getKitSamples fails", () => {
      mockGetKitSamples.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const result = sampleService.getSampleAudioBuffer(
        mockInMemorySettings,
        "TestKit",
        2,
        3,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get samples for kit TestKit");
    });

    it("returns error when file read fails", () => {
      const mockSample = {
        voice_number: 2,
        slot_number: 3,
        filename: "test.wav",
        source_path: "/path/to/test.wav",
      };

      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [mockSample],
      });

      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      const result = sampleService.getSampleAudioBuffer(
        mockInMemorySettings,
        "TestKit",
        2,
        3,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to read sample audio: File not found");
    });

    it("returns error when no local store path configured", () => {
      const result = sampleService.getSampleAudioBuffer({}, "TestKit", 2, 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });
  });

  describe("deleteSampleFromSlotWithoutCompaction", () => {
    it("successfully deletes sample without compaction", () => {
      mockDeleteSamplesWithoutCompaction.mockReturnValue({
        success: true,
        data: { deletedSamples: [{ filename: "test.wav" }] },
      });

      const result = sampleService.deleteSampleFromSlotWithoutCompaction(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(true);
      expect(mockDeleteSamplesWithoutCompaction).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        { voiceNumber: 2, slotNumber: 6 }, // 0-based index converted to 1-based
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("rejects invalid voice number", () => {
      const result = sampleService.deleteSampleFromSlotWithoutCompaction(
        mockInMemorySettings,
        "TestKit",
        0,
        5,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
      expect(mockDeleteSamplesWithoutCompaction).not.toHaveBeenCalled();
    });

    it("rejects invalid slot index", () => {
      const result = sampleService.deleteSampleFromSlotWithoutCompaction(
        mockInMemorySettings,
        "TestKit",
        2,
        12,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)",
      );
      expect(mockDeleteSamplesWithoutCompaction).not.toHaveBeenCalled();
    });

    it("returns error when no local store path configured", () => {
      const result = sampleService.deleteSampleFromSlotWithoutCompaction(
        {},
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("handles database operation errors", () => {
      mockDeleteSamplesWithoutCompaction.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const result = sampleService.deleteSampleFromSlotWithoutCompaction(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(false);
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    it("handles thrown exceptions", () => {
      mockDeleteSamplesWithoutCompaction.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = sampleService.deleteSampleFromSlotWithoutCompaction(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete sample: Unexpected error");
    });
  });

  describe("moveSampleInKit", () => {
    const mockSample = {
      id: 1,
      voice_number: 1,
      slot_number: 1,
      filename: "test.wav",
      is_stereo: false,
    };

    it("successfully moves sample within kit", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [mockSample],
      });
      mockMoveSample.mockReturnValue({
        success: true,
        data: {
          movedSample: mockSample,
          affectedSamples: [],
        },
      });

      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(true);
      expect(mockMoveSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        1,
        1, // 0-based converted to 1-based
        2,
        4, // 0-based converted to 1-based
        "insert",
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("rejects invalid source voice number", () => {
      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        0,
        0,
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Source Voice number must be between 1 and 4");
      expect(mockMoveSample).not.toHaveBeenCalled();
    });

    it("rejects invalid destination voice number", () => {
      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        5,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Destination Voice number must be between 1 and 4",
      );
      expect(mockMoveSample).not.toHaveBeenCalled();
    });

    it("rejects moving to same location", () => {
      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        1,
        0,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot move sample to the same location");
      expect(mockMoveSample).not.toHaveBeenCalled();
    });

    it("rejects moving non-existent sample", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [], // No samples
      });

      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found at voice 1, slot 1");
    });

    it("rejects moving stereo sample to voice 4", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [stereoSample],
      });

      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        4,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Cannot move stereo sample to voice 4 (no adjacent voice available)",
      );
    });

    it("rejects stereo sample move with adjacent voice conflict", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      const conflictSample = {
        id: 2,
        voice_number: 3,
        slot_number: 4,
        filename: "conflict.wav",
        is_stereo: false,
      };

      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [stereoSample, conflictSample],
      });

      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Stereo sample move would conflict with sample in voice 3, slot 4",
      );
    });

    it("returns error when no local store path configured", () => {
      const result = sampleService.moveSampleInKit(
        {},
        "TestKit",
        1,
        0,
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("handles database operation errors", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [mockSample],
      });
      mockMoveSample.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });
  });

  describe("moveSampleBetweenKits", () => {
    const mockSample = {
      id: 1,
      voice_number: 1,
      slot_number: 1,
      filename: "test.wav",
      source_path: "/path/to/test.wav",
      is_stereo: false,
    };

    beforeEach(() => {
      // Reset addSampleToSlot and deleteSampleFromSlot mocks
      vi.clearAllMocks();

      // Set up successful defaults
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });
      mockDeleteSamples.mockReturnValue({
        success: true,
        data: { deletedSamples: [], affectedSamples: [] },
      });
      mockMarkKitAsModified.mockReturnValue({ success: true });

      // Mock file system
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);
      mockFs.openSync.mockReturnValue(3 as any);
      mockFs.closeSync.mockReturnValue(undefined);
      const validWavHeader = Buffer.from("RIFF\x20\x00\x00\x00WAVE");
      mockFs.readSync.mockImplementation((fd, buffer, offset, length) => {
        validWavHeader.copy(
          buffer as Buffer,
          offset,
          0,
          Math.min(length, validWavHeader.length),
        );
        return 12;
      });
    });

    it("successfully moves sample between kits", () => {
      // Source kit has the sample to move
      mockGetKitSamples
        .mockReturnValueOnce({
          success: true,
          data: [mockSample], // Source kit call
        })
        .mockReturnValueOnce({
          success: true,
          data: [], // Destination kit call
        })
        .mockReturnValueOnce({
          success: true,
          data: [], // addSampleToSlot call
        })
        .mockReturnValueOnce({
          success: true,
          data: [mockSample], // deleteSampleFromSlot call
        });

      const result = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        "SourceKit",
        1,
        0,
        "DestKit",
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(true);
      expect(result.data?.movedSample).toEqual(mockSample);
    });

    it("rejects moving non-existent sample", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [], // No samples in source kit
      });

      const result = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        "SourceKit",
        1,
        0,
        "DestKit",
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found at SourceKit voice 1, slot 1");
    });

    it("rejects moving stereo sample to voice 4", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [stereoSample],
      });

      const result = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        "SourceKit",
        1,
        0,
        "DestKit",
        4,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Cannot move stereo sample to voice 4 (no adjacent voice available)",
      );
    });

    it("rejects stereo sample move with adjacent voice conflict in destination", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      const conflictSample = {
        id: 2,
        voice_number: 3,
        slot_number: 4,
        filename: "conflict.wav",
        is_stereo: false,
      };

      mockGetKitSamples
        .mockReturnValueOnce({
          success: true,
          data: [stereoSample], // Source kit
        })
        .mockReturnValueOnce({
          success: true,
          data: [conflictSample], // Destination kit
        });

      const result = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        "SourceKit",
        1,
        0,
        "DestKit",
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Stereo sample move would conflict with sample in DestKit voice 3, slot 4",
      );
    });

    it("rollback on delete failure", () => {
      // Source kit has the sample to move
      mockGetKitSamples
        .mockReturnValueOnce({
          success: true,
          data: [mockSample], // Source kit call
        })
        .mockReturnValueOnce({
          success: true,
          data: [], // Destination kit call
        })
        .mockReturnValueOnce({
          success: true,
          data: [], // addSampleToSlot call - no existing samples
        })
        .mockReturnValueOnce({
          success: true,
          data: [mockSample], // deleteSampleFromSlot call - sample exists
        });

      // Make delete fail after successful add
      mockDeleteSamples.mockReturnValue({
        success: false,
        error: "Delete failed",
      });

      const result = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        "SourceKit",
        1,
        0,
        "DestKit",
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to delete source sample: Delete failed",
      );
    });

    it("returns error when source kit samples cannot be retrieved", () => {
      mockGetKitSamples.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const result = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        "SourceKit",
        1,
        0,
        "DestKit",
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("handles thrown exceptions", () => {
      mockGetKitSamples.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = sampleService.moveSampleBetweenKits(
        mockInMemorySettings,
        "SourceKit",
        1,
        0,
        "DestKit",
        2,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to move sample between kits: Unexpected error",
      );
    });
  });

  describe("addSampleToSlot - forceMono/forceStereo options", () => {
    beforeEach(() => {
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { channels: 2, sampleRate: 44100, bitDepth: 16 },
      });
    });

    it("forceMono option overrides defaultToMonoSamples setting", () => {
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
        { forceMono: true },
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should be false due to forceMono
        }),
      );
      expect(mockGetAudioMetadata).not.toHaveBeenCalled();
    });

    it("forceStereo option overrides defaultToMonoSamples setting", () => {
      const settingsWithMono = {
        ...mockInMemorySettings,
        defaultToMonoSamples: true,
      };

      const result = sampleService.addSampleToSlot(
        settingsWithMono,
        "TestKit",
        1,
        0,
        "/test/mono.wav",
        { forceStereo: true },
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: true, // Should be true due to forceStereo
        }),
      );
      expect(mockGetAudioMetadata).not.toHaveBeenCalled();
    });

    it("forceMono takes precedence over forceStereo", () => {
      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
        { forceMono: true, forceStereo: true },
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // forceMono takes precedence
        }),
      );
    });
  });

  describe("error handling and edge cases", () => {
    it("handles getAudioMetadata failure gracefully in addSampleToSlot", () => {
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockGetAudioMetadata.mockReturnValue({
        success: false,
        error: "Audio metadata error",
      });

      const settingsWithStereoDetection = {
        ...mockInMemorySettings,
        defaultToMonoSamples: false,
      };

      const result = sampleService.addSampleToSlot(
        settingsWithStereoDetection,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should default to false when metadata fails
        }),
      );
    });

    it("handles getAudioMetadata returning null data", () => {
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: null,
      });

      const settingsWithStereoDetection = {
        ...mockInMemorySettings,
        defaultToMonoSamples: false,
      };

      const result = sampleService.addSampleToSlot(
        settingsWithStereoDetection,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should default to false when data is null
        }),
      );
    });

    it("handles addSample database error in addSampleToSlot", () => {
      mockGetKitSamples.mockReturnValue({ success: true, data: [] });
      mockAddSample.mockReturnValue({
        success: false,
        error: "Database constraint violation",
      });

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database constraint violation");
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    it("handles thrown exception in addSampleToSlot", () => {
      mockGetKitSamples.mockImplementation(() => {
        throw new Error("Unexpected database error");
      });

      const result = sampleService.addSampleToSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to add sample: Unexpected database error",
      );
    });

    it("handles deleteSampleFromSlot when sample does not exist", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [], // No samples exist
      });

      const result = sampleService.deleteSampleFromSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found in voice 1, slot 1 to delete");
      expect(mockDeleteSamples).not.toHaveBeenCalled();
    });

    it("handles getKitSamples failure in deleteSampleFromSlot", () => {
      mockGetKitSamples.mockReturnValue({
        success: false,
        error: "Database connection error",
      });

      const result = sampleService.deleteSampleFromSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(mockDeleteSamples).not.toHaveBeenCalled();
    });

    it("handles validateSampleSources with getKitSamples failure", () => {
      mockGetKitSamples.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("handles validateSampleSources with null sample data", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: null,
      });

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(true);
      expect(result.data?.totalSamples).toBe(0);
      expect(result.data?.validSamples).toBe(0);
      expect(result.data?.invalidSamples).toHaveLength(0);
    });

    it("handles validateSampleSources with thrown exception", () => {
      mockGetKitSamples.mockImplementation(() => {
        throw new Error("Database connection lost");
      });

      const result = sampleService.validateSampleSources(
        mockInMemorySettings,
        "TestKit",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to validate sample sources: Database connection lost",
      );
    });

    it("handles replaceSampleInSlot when no existing sample found", () => {
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: [], // No existing sample
      });
      // This should call addSampleToSlot instead
      mockAddSample.mockReturnValue({ success: true, data: { sampleId: 456 } });

      const result = sampleService.replaceSampleInSlot(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/new-sample.wav",
      );

      expect(result.success).toBe(true);
      expect(mockDeleteSamples).not.toHaveBeenCalled(); // Should not try to delete
      expect(mockAddSample).toHaveBeenCalled(); // Should add instead
    });
  });
});
