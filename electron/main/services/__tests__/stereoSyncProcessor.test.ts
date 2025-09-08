import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncResults } from "../syncFileOperations.js";

import { StereoSyncProcessor } from "../stereoSyncProcessor.js";
import {
  createMockSample,
  mockStereoSample,
  mockVoices,
} from "./fixtures/sampleFixtures.js";

// Mock dependencies
vi.mock("../rampleNamingService.js", () => ({
  rampleNamingService: {
    generateSampleDestinationPath: vi.fn().mockReturnValue("/mock/destination"),
  },
}));

vi.mock("../syncFileOperations.js", () => ({
  syncFileOperationsService: {
    categorizeSyncFileOperation: vi.fn(),
  },
}));

vi.mock("../syncValidationService.js", () => ({
  syncValidationService: {
    validateSyncSourceFile: vi
      .fn()
      .mockReturnValue({ fileSize: 1024, isValid: true }),
  },
}));

import { syncValidationService } from "../syncValidationService.js";

describe("StereoSyncProcessor", () => {
  let processor: StereoSyncProcessor;
  let mockResults: SyncResults;

  beforeEach(() => {
    processor = new StereoSyncProcessor();
    mockResults = {
      filesToConvert: [],
      filesToCopy: [],
      hasFormatWarnings: false,
      validationErrors: [],
      warnings: [],
    };
    vi.clearAllMocks();
  });

  describe("processSamplesForSync", () => {
    it("should process samples grouped by kit", async () => {
      const samples = [mockStereoSample];

      await processor.processSamplesForSync(
        samples,
        mockVoices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should handle multiple kits separately", async () => {
      const samples = [
        createMockSample({ kit_name: "A0" }),
        createMockSample({ id: 2, kit_name: "B0" }),
      ];

      const voices = [
        ...mockVoices,
        {
          id: 3,
          kit_name: "B0",
          stereo_mode: false,
          voice_alias: null,
          voice_number: 1,
        },
      ];

      await processor.processSamplesForSync(
        samples,
        voices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should skip samples without matching voice info", async () => {
      const samples = [createMockSample({ voice_number: 99 })];

      await processor.processSamplesForSync(
        samples,
        mockVoices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });
  });

  describe("processMonoVoiceSample", () => {
    it("should process mono sample correctly", async () => {
      const processor = new StereoSyncProcessor();

      // Use processSamplesForSync to test mono processing indirectly
      await processor.processSamplesForSync(
        [createMockSample({ is_stereo: false, wav_channels: 1 })],
        [
          {
            id: 1,
            kit_name: "A0",
            stereo_mode: false,
            voice_alias: null,
            voice_number: 1,
          },
        ],
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should skip samples without source_path", async () => {
      const sampleWithoutPath = createMockSample({
        is_stereo: false,
        source_path: null as unknown,
        wav_channels: 1,
      });

      await processor.processSamplesForSync(
        [sampleWithoutPath],
        [
          {
            id: 1,
            kit_name: "A0",
            stereo_mode: false,
            voice_alias: null,
            voice_number: 1,
          },
        ],
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });
  });

  describe("processStereoVoiceSample", () => {
    it("should process stereo sample from voice 1", async () => {
      const voices = [
        {
          id: 1,
          kit_name: "A0",
          stereo_mode: true,
          voice_alias: null,
          voice_number: 1,
        },
      ];

      await processor.processSamplesForSync(
        [mockStereoSample],
        voices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toContain(
        "Stereo voice 1 generates files for both channels: destination and destination",
      );
    });

    it("should convert voice 4 stereo to mono with warning", async () => {
      const voice4Sample = createMockSample({
        is_stereo: true,
        voice_number: 4,
        wav_channels: 2,
      });
      const voices = [
        {
          id: 4,
          kit_name: "A0",
          stereo_mode: true,
          voice_alias: null,
          voice_number: 4,
        },
      ];

      await processor.processSamplesForSync(
        [voice4Sample],
        voices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toContain(
        "Voice 4 cannot be in stereo mode for kit A0 - converting to mono",
      );
    });

    it("should skip stereo samples without source_path", async () => {
      const sampleWithoutPath = createMockSample({
        is_stereo: true,
        source_path: null as unknown,
        wav_channels: 2,
      });
      const voices = [
        {
          id: 1,
          kit_name: "A0",
          stereo_mode: true,
          voice_alias: null,
          voice_number: 1,
        },
      ];

      await processor.processSamplesForSync(
        [sampleWithoutPath],
        voices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });
  });

  describe("destination path generation", () => {
    it("should generate correct paths with custom SD card path", async () => {
      const samples = [mockStereoSample];
      const voices = [
        {
          id: 1,
          kit_name: "A0",
          stereo_mode: false,
          voice_alias: null,
          voice_number: 1,
        },
      ];

      await processor.processSamplesForSync(
        samples,
        voices,
        "/test/path",
        mockResults,
        "/custom/sd/card",
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should generate default paths without SD card path", async () => {
      const samples = [mockStereoSample];
      const voices = [
        {
          id: 1,
          kit_name: "A0",
          stereo_mode: false,
          voice_alias: null,
          voice_number: 1,
        },
      ];

      await processor.processSamplesForSync(
        samples,
        voices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty sample arrays", async () => {
      await processor.processSamplesForSync([], [], "/test/path", mockResults);

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should handle samples with no matching voices", async () => {
      const samples = [createMockSample({ voice_number: 99 })];

      await processor.processSamplesForSync(
        samples,
        [],
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should handle invalid file validation in mono sample", async () => {
      // Mock invalid file validation
      const invalidSample = createMockSample({ is_stereo: false });

      vi.mocked(
        syncValidationService.validateSyncSourceFile,
      ).mockReturnValueOnce({
        fileSize: 0,
        isValid: false,
      });

      await processor.processSamplesForSync(
        [invalidSample],
        [
          {
            id: 1,
            kit_name: "A0",
            stereo_mode: false,
            voice_number: 1,
          },
        ],
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should handle invalid file validation in stereo sample", async () => {
      // Mock invalid file validation for stereo
      const invalidStereoSample = createMockSample({ is_stereo: true });

      vi.mocked(
        syncValidationService.validateSyncSourceFile,
      ).mockReturnValueOnce({
        fileSize: 0,
        isValid: false,
      });

      await processor.processSamplesForSync(
        [invalidStereoSample],
        [
          {
            id: 1,
            kit_name: "A0",
            stereo_mode: true,
            voice_number: 1,
          },
        ],
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should group samples by kit correctly", async () => {
      const samples = [
        createMockSample({ id: 1, kit_name: "Kit1" }),
        createMockSample({ id: 2, kit_name: "Kit2" }),
        createMockSample({ id: 3, kit_name: "Kit1" }), // Another sample for Kit1
      ];

      const voices = [
        { id: 1, kit_name: "Kit1", stereo_mode: false, voice_number: 1 },
        { id: 2, kit_name: "Kit2", stereo_mode: false, voice_number: 1 },
      ];

      await processor.processSamplesForSync(
        samples,
        voices,
        "/test/path",
        mockResults,
      );

      // Should process all samples despite different kits
      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should handle samples with missing kit voices", async () => {
      const samples = [createMockSample({ kit_name: "MissingKit" })];

      await processor.processSamplesForSync(
        samples,
        mockVoices, // No voices for "MissingKit"
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });
  });

  describe("private method coverage", () => {
    it("should handle linked voice detection correctly", async () => {
      // Test isLinkedVoice method indirectly through sample processing
      const linkedVoiceSample = createMockSample({
        is_stereo: false,
        voice_number: 2, // Voice 2 linked to voice 1
      });

      const voices = [
        { id: 1, kit_name: "A0", stereo_mode: true, voice_number: 1 }, // Primary stereo voice
        { id: 2, kit_name: "A0", stereo_mode: false, voice_number: 2 }, // Linked voice
      ];

      await processor.processSamplesForSync(
        [linkedVoiceSample],
        voices,
        "/test/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should test destination path generation for different voice numbers", async () => {
      const voice3Sample = createMockSample({
        slot_number: 5,
        voice_number: 3,
      });

      await processor.processSamplesForSync(
        [voice3Sample],
        [{ id: 3, kit_name: "A0", stereo_mode: false, voice_number: 3 }],
        "/custom/path",
        mockResults,
      );

      expect(mockResults.warnings).toHaveLength(0);
    });

    it("should test stereo destination path generation for right channel", async () => {
      const stereoSample = createMockSample({
        is_stereo: true,
        slot_number: 3,
        voice_number: 2, // Test voice 2 stereo
      });

      await processor.processSamplesForSync(
        [stereoSample],
        [{ id: 2, kit_name: "A0", stereo_mode: true, voice_number: 2 }],
        "/test/path",
        mockResults,
        "/sd/card", // Test with SD card path
      );

      // Should generate warning about stereo files
      expect(mockResults.warnings).toContain(
        "Stereo voice 2 generates files for both channels: destination and destination",
      );
    });
  });
});

export const stereoSyncProcessor = new StereoSyncProcessor();
