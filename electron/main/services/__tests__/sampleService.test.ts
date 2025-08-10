import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("fs", () => ({
  closeSync: vi.fn(),
  existsSync: vi.fn(),
  openSync: vi.fn(),
  readFileSync: vi.fn(),
  readSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  basename: vi.fn((p) => p.split("/").pop()),
  join: vi.fn((...args) => args.join("/")),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
  deleteSamplesWithoutReindexing: vi.fn(),
  getKitSamples: vi.fn(),
  markKitAsModified: vi.fn(),
  moveSample: vi.fn(),
}));

// Mock audioUtils
vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
}));

// Mock stereoProcessingUtils
vi.mock("../../utils/stereoProcessingUtils.js", () => ({
  determineStereoConfiguration: vi.fn(),
}));

import { getAudioMetadata } from "../../audioUtils.js";
import {
  addSample,
  deleteSamples,
  deleteSamplesWithoutReindexing,
  getKitSamples,
  markKitAsModified,
  moveSample,
} from "../../db/romperDbCoreORM.js";
import { determineStereoConfiguration } from "../../utils/stereoProcessingUtils.js";
import { SampleService } from "../sampleService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockAddSample = vi.mocked(addSample);
const mockDeleteSamples = vi.mocked(deleteSamples);
const mockDeleteSamplesWithoutReindexing = vi.mocked(
  deleteSamplesWithoutReindexing,
);
const mockGetKitSamples = vi.mocked(getKitSamples);
const mockMarkKitAsModified = vi.mocked(markKitAsModified);
const mockMoveSample = vi.mocked(moveSample);
const _mockGetAudioMetadata = vi.mocked(getAudioMetadata);
const mockDetermineStereoConfiguration = vi.mocked(
  determineStereoConfiguration,
);

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

    mockAddSample.mockReturnValue({ data: { sampleId: 123 }, success: true });
    mockDeleteSamples.mockReturnValue({ success: true });
    mockDeleteSamplesWithoutReindexing.mockReturnValue({
      data: { deletedSamples: [] },
      success: true,
    });
    mockMoveSample.mockReturnValue({ success: true });
    mockMarkKitAsModified.mockReturnValue({ success: true });
    mockDetermineStereoConfiguration.mockReturnValue(false);
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
      mockGetKitSamples.mockReturnValue({ data: [], success: true });

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
          slot_number: 100, // 0-based index converted to spaced slot
          source_path: "/test/sample.wav",
          voice_number: 1,
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
      mockAddSample.mockReturnValue({ error: "DB error", success: false });

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
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
      mockDetermineStereoConfiguration.mockReturnValue(false);

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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/stereo.wav",
        settingsWithMono,
        undefined,
      );
    });

    it("marks stereo file as stereo when defaultToMonoSamples is false", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
      mockDetermineStereoConfiguration.mockReturnValue(true);

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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/stereo.wav",
        settingsWithStereo,
        undefined,
      );
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: true, // Should be true because file is stereo and setting is OFF
        }),
      );
    });

    it("marks mono file as mono regardless of defaultToMonoSamples setting", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
      mockDetermineStereoConfiguration.mockReturnValue(false);

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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/mono.wav",
        settingsWithStereo,
        undefined,
      );
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          is_stereo: false, // Should be false because file is actually mono
        }),
      );
    });

    it("defaults to mono when defaultToMonoSamples is undefined", () => {
      // Mock that no existing samples exist for the check
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
      mockDetermineStereoConfiguration.mockReturnValue(false);
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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/sample.wav",
        settingsWithoutDefault,
        undefined,
      );
    });
  });

  describe("deleteSampleFromSlot", () => {
    it("successfully deletes sample", () => {
      // Mock existing sample at the slot
      mockGetKitSamples.mockReturnValue({
        data: [{ filename: "existing.wav", slot_number: 600, voice_number: 2 }],
        success: true,
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
        { slotNumber: 600, voiceNumber: 2 }, // 0-based index converted to 1-based
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("marks kit as modified only when operation succeeds", () => {
      mockDeleteSamples.mockReturnValue({ error: "DB error", success: false });

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

      mockGetKitSamples.mockReturnValue({ data: mockSamples, success: true });

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

      mockGetKitSamples.mockReturnValue({ data: mockSamples, success: true });
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

      mockGetKitSamples.mockReturnValue({ data: mockSamples, success: true });

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
        data: [{ filename: "old.wav", slot_number: 600, voice_number: 2 }],
        success: true,
      });
      mockDeleteSamples.mockReturnValue({ success: true });
      mockAddSample.mockReturnValue({ data: { sampleId: 123 }, success: true });

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
        { slotNumber: 600, voiceNumber: 2 },
      );
      expect(mockAddSample).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          kit_name: "TestKit",
          slot_number: 600,
          source_path: "/test/new-sample.wav",
          voice_number: 2,
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
        data: [{ filename: "old.wav", slot_number: 100, voice_number: 1 }],
        success: true,
      });
      mockDeleteSamples.mockReturnValue({
        error: "Delete failed",
        success: false,
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
        data: [{ filename: "old.wav", slot_number: 100, voice_number: 1 }],
        success: true,
      });
      mockDeleteSamples.mockReturnValue({ success: true });
      mockAddSample.mockReturnValue({ data: { sampleId: 123 }, success: true });
      mockDetermineStereoConfiguration.mockReturnValue(false);

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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/stereo-replace.wav",
        settingsWithMono,
        undefined,
      );
    });

    it("preserves stereo when defaultToMonoSamples is false for replacement", () => {
      // Mock existing sample at the slot
      mockGetKitSamples.mockReturnValue({
        data: [{ filename: "old.wav", slot_number: 100, voice_number: 1 }],
        success: true,
      });
      mockDeleteSamples.mockReturnValue({ success: true });
      mockAddSample.mockReturnValue({ data: { sampleId: 123 }, success: true });
      mockDetermineStereoConfiguration.mockReturnValue(true);

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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/stereo-replace.wav",
        settingsWithStereo,
        undefined,
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
        filename: "test.wav",
        slot_number: 300,
        source_path: "/path/to/test.wav",
        voice_number: 2,
      };

      mockGetKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
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
        data: [], // No samples
        success: true,
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
        error: "Database error",
        success: false,
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
        filename: "test.wav",
        slot_number: 300,
        source_path: "/path/to/test.wav",
        voice_number: 2,
      };

      mockGetKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
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

  describe("deleteSampleFromSlotWithoutReindexing", () => {
    it("successfully deletes sample without reindexing", () => {
      mockDeleteSamplesWithoutReindexing.mockReturnValue({
        data: { deletedSamples: [{ filename: "test.wav" }] },
        success: true,
      });

      const result = sampleService.deleteSampleFromSlotWithoutReindexing(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(true);
      expect(mockDeleteSamplesWithoutReindexing).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
        { slotNumber: 600, voiceNumber: 2 }, // 0-based index converted to 1-based
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("rejects invalid voice number", () => {
      const result = sampleService.deleteSampleFromSlotWithoutReindexing(
        mockInMemorySettings,
        "TestKit",
        0,
        5,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
      expect(mockDeleteSamplesWithoutReindexing).not.toHaveBeenCalled();
    });

    it("rejects invalid slot index", () => {
      const result = sampleService.deleteSampleFromSlotWithoutReindexing(
        mockInMemorySettings,
        "TestKit",
        2,
        12,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)",
      );
      expect(mockDeleteSamplesWithoutReindexing).not.toHaveBeenCalled();
    });

    it("returns error when no local store path configured", () => {
      const result = sampleService.deleteSampleFromSlotWithoutReindexing(
        {},
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("handles database operation errors", () => {
      mockDeleteSamplesWithoutReindexing.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = sampleService.deleteSampleFromSlotWithoutReindexing(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
      );

      expect(result.success).toBe(false);
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    it("handles thrown exceptions", () => {
      mockDeleteSamplesWithoutReindexing.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = sampleService.deleteSampleFromSlotWithoutReindexing(
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
      filename: "test.wav",
      id: 1,
      is_stereo: false,
      slot_number: 100,
      voice_number: 1,
    };

    it("successfully moves sample within kit", () => {
      mockGetKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });
      mockMoveSample.mockReturnValue({
        data: {
          affectedSamples: [],
          movedSample: mockSample,
        },
        success: true,
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
        100, // 0-based converted to spaced slot
        2,
        400, // 0-based converted to spaced slot
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
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot move sample to the same location");
      expect(mockMoveSample).not.toHaveBeenCalled();
    });

    it("rejects moving non-existent sample", () => {
      mockGetKitSamples.mockReturnValue({
        data: [], // No samples
        success: true,
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
        data: [stereoSample],
        success: true,
      });

      const result = sampleService.moveSampleInKit(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        4,
        3,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Cannot move stereo sample to voice 4 (no adjacent voice available)",
      );
    });

    it("rejects stereo sample move with adjacent voice conflict", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      const conflictSample = {
        filename: "conflict.wav",
        id: 2,
        is_stereo: false,
        slot_number: 400,
        voice_number: 3,
      };

      mockGetKitSamples.mockReturnValue({
        data: [stereoSample, conflictSample],
        success: true,
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
      const result = sampleService.moveSampleInKit({}, "TestKit", 1, 0, 2, 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("handles database operation errors", () => {
      mockGetKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });
      mockMoveSample.mockReturnValue({
        error: "Database error",
        success: false,
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
      filename: "test.wav",
      id: 1,
      is_stereo: false,
      slot_number: 100,
      source_path: "/path/to/test.wav",
      voice_number: 1,
    };

    beforeEach(() => {
      // Reset addSampleToSlot and deleteSampleFromSlot mocks
      vi.clearAllMocks();

      // Set up successful defaults
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
      mockAddSample.mockReturnValue({ data: { sampleId: 123 }, success: true });
      mockDeleteSamples.mockReturnValue({
        data: { affectedSamples: [], deletedSamples: [] },
        success: true,
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
          data: [mockSample], // Source kit call
          success: true,
        })
        .mockReturnValueOnce({
          data: [], // Destination kit call
          success: true,
        })
        .mockReturnValueOnce({
          data: [], // addSampleToSlot call
          success: true,
        })
        .mockReturnValueOnce({
          data: [mockSample], // deleteSampleFromSlot call
          success: true,
        });

      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "SourceKit",
        fromSlot: 0,
        fromVoice: 1,
        toKit: "DestKit",
        toSlot: 3,
        toVoice: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.movedSample).toEqual(mockSample);
    });

    it("rejects moving non-existent sample", () => {
      mockGetKitSamples.mockReturnValue({
        data: [], // No samples in source kit
        success: true,
      });

      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "SourceKit",
        fromSlot: 0,
        fromVoice: 1,
        toKit: "DestKit",
        toSlot: 3,
        toVoice: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found at SourceKit voice 1, slot 1");
    });

    it("rejects moving stereo sample to voice 4", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      mockGetKitSamples.mockReturnValue({
        data: [stereoSample],
        success: true,
      });

      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "SourceKit",
        fromSlot: 0,
        fromVoice: 1,
        toKit: "DestKit",
        toSlot: 3,
        toVoice: 4,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Cannot move stereo sample to voice 4 (no adjacent voice available)",
      );
    });

    it("rejects stereo sample move with adjacent voice conflict in destination", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      const conflictSample = {
        filename: "conflict.wav",
        id: 2,
        is_stereo: false,
        slot_number: 400,
        voice_number: 3,
      };

      mockGetKitSamples
        .mockReturnValueOnce({
          data: [stereoSample], // Source kit
          success: true,
        })
        .mockReturnValueOnce({
          data: [conflictSample], // Destination kit
          success: true,
        });

      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "SourceKit",
        fromSlot: 0,
        fromVoice: 1,
        toKit: "DestKit",
        toSlot: 3,
        toVoice: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Stereo sample move would conflict with sample in DestKit voice 3, slot 4",
      );
    });

    it("rollback on delete failure", () => {
      // Source kit has the sample to move
      mockGetKitSamples
        .mockReturnValueOnce({
          data: [mockSample], // Source kit call
          success: true,
        })
        .mockReturnValueOnce({
          data: [], // Destination kit call
          success: true,
        })
        .mockReturnValueOnce({
          data: [], // addSampleToSlot call - no existing samples
          success: true,
        })
        .mockReturnValueOnce({
          data: [mockSample], // deleteSampleFromSlot call - sample exists
          success: true,
        });

      // Make delete fail after successful add
      mockDeleteSamples.mockReturnValue({
        error: "Delete failed",
        success: false,
      });

      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "SourceKit",
        fromSlot: 0,
        fromVoice: 1,
        toKit: "DestKit",
        toSlot: 3,
        toVoice: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to delete source sample: Delete failed",
      );
    });

    it("returns error when source kit samples cannot be retrieved", () => {
      mockGetKitSamples.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "SourceKit",
        fromSlot: 0,
        fromVoice: 1,
        toKit: "DestKit",
        toSlot: 3,
        toVoice: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("handles thrown exceptions", () => {
      mockGetKitSamples.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = sampleService.moveSampleBetweenKits(mockInMemorySettings, {
        fromKit: "SourceKit",
        fromSlot: 0,
        fromVoice: 1,
        toKit: "DestKit",
        toSlot: 3,
        toVoice: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to move sample between kits: Unexpected error",
      );
    });
  });

  describe("addSampleToSlot - forceMono/forceStereo options", () => {
    beforeEach(() => {
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
    });

    it("forceMono option overrides defaultToMonoSamples setting", () => {
      mockDetermineStereoConfiguration.mockReturnValue(false);
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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/stereo.wav",
        settingsWithStereo,
        { forceMono: true },
      );
    });

    it("forceStereo option overrides defaultToMonoSamples setting", () => {
      mockDetermineStereoConfiguration.mockReturnValue(true);
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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/mono.wav",
        settingsWithMono,
        { forceStereo: true },
      );
    });

    it("forceMono takes precedence over forceStereo", () => {
      mockDetermineStereoConfiguration.mockReturnValue(false);
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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/sample.wav",
        mockInMemorySettings,
        { forceMono: true, forceStereo: true },
      );
    });
  });

  describe("error handling and edge cases", () => {
    it("handles determineStereoConfiguration gracefully in addSampleToSlot", () => {
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
      mockDetermineStereoConfiguration.mockReturnValue(false);

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
      expect(mockDetermineStereoConfiguration).toHaveBeenCalledWith(
        "/test/sample.wav",
        settingsWithStereoDetection,
        undefined,
      );
    });

    it("handles addSample database error in addSampleToSlot", () => {
      mockGetKitSamples.mockReturnValue({ data: [], success: true });
      mockAddSample.mockReturnValue({
        error: "Database constraint violation",
        success: false,
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
        data: [], // No samples exist
        success: true,
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
        error: "Database connection error",
        success: false,
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
        error: "Database error",
        success: false,
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
        data: null,
        success: true,
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
        data: [], // No existing sample
        success: true,
      });
      // This should call addSampleToSlot instead
      mockAddSample.mockReturnValue({ data: { sampleId: 456 }, success: true });

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

  // Tests for the extracted helper methods
  describe("Helper Methods", () => {
    describe("validateAndGetSampleToMove", () => {
      it("successfully validates and returns sample to move", () => {
        const mockSample = {
          filename: "test.wav",
          id: 1,
          is_stereo: false,
          slot_number: 300,
          source_path: "/path/to/test.wav",
          voice_number: 2,
        };

        mockGetKitSamples.mockReturnValue({
          data: [mockSample],
          success: true,
        });

        // Access the private method through instance
        const result = (sampleService as any).validateAndGetSampleToMove(
          "/test/db/path",
          "SourceKit",
          2,
          2, // 0-based slot index
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSample);
        expect(mockGetKitSamples).toHaveBeenCalledWith(
          "/test/db/path",
          "SourceKit",
        );
      });

      it("returns error when getKitSamples fails", () => {
        mockGetKitSamples.mockReturnValue({
          error: "Database connection error",
          success: false,
        });

        const result = (sampleService as any).validateAndGetSampleToMove(
          "/test/db/path",
          "SourceKit",
          2,
          2,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Database connection error");
      });

      it("returns error when getKitSamples returns null data", () => {
        mockGetKitSamples.mockReturnValue({
          data: null,
          success: true,
        });

        const result = (sampleService as any).validateAndGetSampleToMove(
          "/test/db/path",
          "SourceKit",
          2,
          2,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeUndefined(); // Will fall through to sample not found
      });

      it("returns error when sample not found at specified location", () => {
        mockGetKitSamples.mockReturnValue({
          data: [
            {
              filename: "other.wav",
              id: 1,
              is_stereo: false,
              slot_number: 100,
              source_path: "/path/to/other.wav",
              voice_number: 1,
            },
          ],
          success: true,
        });

        const result = (sampleService as any).validateAndGetSampleToMove(
          "/test/db/path",
          "SourceKit",
          2,
          2, // Looking for voice 2, slot 3 (2+1)
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(
          "No sample found at SourceKit voice 2, slot 3",
        );
      });

      it("finds correct sample among multiple samples", () => {
        const targetSample = {
          filename: "target.wav",
          id: 2,
          is_stereo: true,
          slot_number: 500,
          source_path: "/path/to/target.wav",
          voice_number: 3,
        };

        mockGetKitSamples.mockReturnValue({
          data: [
            {
              filename: "first.wav",
              id: 1,
              is_stereo: false,
              slot_number: 100,
              source_path: "/path/to/first.wav",
              voice_number: 1,
            },
            targetSample,
            {
              filename: "third.wav",
              id: 3,
              is_stereo: false,
              slot_number: 200,
              source_path: "/path/to/third.wav",
              voice_number: 4,
            },
          ],
          success: true,
        });

        const result = (sampleService as any).validateAndGetSampleToMove(
          "/test/db/path",
          "SourceKit",
          3,
          4, // 0-based slot index for slot 5
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(targetSample);
      });
    });

    describe("checkStereoConflicts", () => {
      const mockSample = {
        filename: "test.wav",
        id: 1,
        is_stereo: false,
        slot_number: 100,
        source_path: "/path/to/test.wav",
        voice_number: 1,
      };

      it("allows mono sample to any voice", () => {
        const result = (sampleService as any).checkStereoConflicts(
          mockSample,
          4,
          3,
          [],
          "DestKit",
        );

        expect(result.hasConflict).toBe(false);
        expect(result.error).toBeUndefined();
      });

      it("rejects stereo sample to voice 4", () => {
        const stereoSample = { ...mockSample, is_stereo: true };

        const result = (sampleService as any).checkStereoConflicts(
          stereoSample,
          4,
          3,
          [],
          "DestKit",
        );

        expect(result.hasConflict).toBe(true);
        expect(result.error).toBe(
          "Cannot move stereo sample to voice 4 (no adjacent voice available)",
        );
      });

      it("allows stereo sample to voice 1-3 in insert mode", () => {
        const stereoSample = { ...mockSample, is_stereo: true };

        const result = (sampleService as any).checkStereoConflicts(
          stereoSample,
          3,
          2,
          [],
          "DestKit",
        );

        expect(result.hasConflict).toBe(false);
        expect(result.error).toBeUndefined();
      });

      it("rejects stereo sample in insert mode when adjacent voice has conflict", () => {
        const stereoSample = { ...mockSample, is_stereo: true };
        const conflictingSample = {
          filename: "conflict.wav",
          id: 2,
          is_stereo: false,
          slot_number: 400,
          source_path: "/path/to/conflict.wav",
          voice_number: 3,
        };

        const result = (sampleService as any).checkStereoConflicts(
          stereoSample,
          2,
          3, // Destination slot 4 (3+1)
          [conflictingSample],
          "insert",
          "DestKit",
        );

        expect(result.hasConflict).toBe(true);
        expect(result.error).toBe(
          "Stereo sample move would conflict with sample in DestKit voice 3, slot 4",
        );
      });

      it("allows stereo sample in insert mode when no adjacent voice conflict", () => {
        const stereoSample = { ...mockSample, is_stereo: true };
        const nonConflictingSample = {
          filename: "noconflict.wav",
          id: 2,
          is_stereo: false,
          slot_number: 500, // Different slot
          source_path: "/path/to/noconflict.wav",
          voice_number: 3,
        };

        const result = (sampleService as any).checkStereoConflicts(
          stereoSample,
          2,
          3, // Destination slot 4 (3+1)
          [nonConflictingSample],
          "DestKit",
        );

        expect(result.hasConflict).toBe(false);
        expect(result.error).toBeUndefined();
      });

      it("allows stereo sample in insert mode when adjacent voice is different", () => {
        const stereoSample = { ...mockSample, is_stereo: true };
        const nonConflictingSample = {
          filename: "noconflict.wav",
          id: 2,
          is_stereo: false,
          slot_number: 400, // Same slot but voice 4 instead of 3
          source_path: "/path/to/noconflict.wav",
          voice_number: 4,
        };

        const result = (sampleService as any).checkStereoConflicts(
          stereoSample,
          2,
          3, // Destination slot 4 (3+1), should check voice 3
          [nonConflictingSample],
          "DestKit",
        );

        expect(result.hasConflict).toBe(false);
        expect(result.error).toBeUndefined();
      });
    });

    describe("getDestinationSamplesAndReplacements", () => {
      it("successfully retrieves destination samples and no replacement in insert mode", () => {
        const mockDestSamples = [
          {
            filename: "dest1.wav",
            id: 1,
            is_stereo: false,
            slot_number: 100,
            source_path: "/path/to/dest1.wav",
            voice_number: 1,
          },
          {
            filename: "dest2.wav",
            id: 2,
            is_stereo: true,
            slot_number: 300,
            source_path: "/path/to/dest2.wav",
            voice_number: 2,
          },
        ];

        mockGetKitSamples.mockReturnValue({
          data: mockDestSamples,
          success: true,
        });

        const result = (
          sampleService as any
        ).getDestinationSamplesAndReplacements(
          "/test/db/path",
          "DestKit",
          2,
          4, // 0-based slot index for slot 5
          "insert",
        );

        expect(result.destSamples).toEqual(mockDestSamples);
        expect(result.replacedSample).toBeUndefined();
        expect(mockGetKitSamples).toHaveBeenCalledWith(
          "/test/db/path",
          "DestKit",
        );
      });

      it("returns no replaced sample in insert-only mode", () => {
        const replacedSample = {
          filename: "replaced.wav",
          id: 2,
          is_stereo: false,
          slot_number: 500,
          source_path: "/path/to/replaced.wav",
          voice_number: 2,
        };

        const mockDestSamples = [
          {
            filename: "dest1.wav",
            id: 1,
            is_stereo: false,
            slot_number: 100,
            source_path: "/path/to/dest1.wav",
            voice_number: 1,
          },
          replacedSample,
        ];

        mockGetKitSamples.mockReturnValue({
          data: mockDestSamples,
          success: true,
        });

        const result = (
          sampleService as any
        ).getDestinationSamplesAndReplacements(
          "/test/db/path",
          "DestKit",
          2,
          4, // 0-based slot index for slot 5
          "insert",
        );

        expect(result.destSamples).toEqual(mockDestSamples);
        expect(result.replacedSample).toBeUndefined(); // Insert-only mode never replaces
      });

      it("handles no replacement when target slot is empty in insert-only mode", () => {
        const mockDestSamples = [
          {
            filename: "dest1.wav",
            id: 1,
            is_stereo: false,
            slot_number: 100,
            source_path: "/path/to/dest1.wav",
            voice_number: 1,
          },
          {
            filename: "dest2.wav",
            id: 2,
            is_stereo: false,
            slot_number: 200,
            source_path: "/path/to/dest2.wav",
            voice_number: 3,
          },
        ];

        mockGetKitSamples.mockReturnValue({
          data: mockDestSamples,
          success: true,
        });

        const result = (
          sampleService as any
        ).getDestinationSamplesAndReplacements(
          "/test/db/path",
          "DestKit",
          2,
          4, // 0-based slot index for slot 5 - no sample at voice 2, slot 5
          "insert",
        );

        expect(result.destSamples).toEqual(mockDestSamples);
        expect(result.replacedSample).toBeUndefined();
      });

      it("handles getKitSamples failure gracefully", () => {
        mockGetKitSamples.mockReturnValue({
          error: "Database error",
          success: false,
        });

        const result = (
          sampleService as any
        ).getDestinationSamplesAndReplacements(
          "/test/db/path",
          "DestKit",
          2,
          4,
          "insert",
        );

        expect(result.destSamples).toEqual([]);
        expect(result.replacedSample).toBeUndefined();
      });

      it("handles null data from getKitSamples", () => {
        mockGetKitSamples.mockReturnValue({
          data: null,
          success: true,
        });

        const result = (
          sampleService as any
        ).getDestinationSamplesAndReplacements(
          "/test/db/path",
          "DestKit",
          2,
          4,
          "insert",
        );

        expect(result.destSamples).toEqual([]);
        expect(result.replacedSample).toBeUndefined();
      });

      it("correctly identifies replacement with multiple samples at different voices/slots", () => {
        const targetSample = {
          filename: "target.wav",
          id: 3,
          is_stereo: true,
          slot_number: 700,
          source_path: "/path/to/target.wav",
          voice_number: 3,
        };

        const mockDestSamples = [
          {
            filename: "different-voice.wav",
            id: 1,
            is_stereo: false,
            slot_number: 700,
            source_path: "/path/to/different-voice.wav",
            voice_number: 2,
          },
          {
            filename: "different-slot.wav",
            id: 2,
            is_stereo: false,
            slot_number: 600,
            source_path: "/path/to/different-slot.wav",
            voice_number: 3,
          },
          targetSample,
        ];

        mockGetKitSamples.mockReturnValue({
          data: mockDestSamples,
          success: true,
        });

        const result = (
          sampleService as any
        ).getDestinationSamplesAndReplacements(
          "/test/db/path",
          "DestKit",
          3,
          6, // 0-based slot index for slot 7
          "insert",
        );

        expect(result.destSamples).toEqual(mockDestSamples);
        expect(result.replacedSample).toBeUndefined(); // Insert-only mode never replaces
      });
    });
  });
});
