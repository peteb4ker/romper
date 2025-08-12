import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as romperDbCoreORM from "../../../db/romperDbCoreORM.js";
import * as fileSystemUtils from "../../../utils/fileSystemUtils.js";
import * as stereoProcessingUtils from "../../../utils/stereoProcessingUtils.js";
import * as sampleValidator from "../../validation/sampleValidator.js";
import { SampleCrudService } from "../sampleCrudService";

// Mock dependencies
vi.mock("../../../db/romperDbCoreORM.js");
vi.mock("../../../utils/fileSystemUtils.js");
vi.mock("../../../utils/stereoProcessingUtils.js");
vi.mock("../../validation/sampleValidator.js");

const mockORM = vi.mocked(romperDbCoreORM);
const mockFileSystem = vi.mocked(fileSystemUtils);
const mockStereoUtils = vi.mocked(stereoProcessingUtils);
const mockValidator = vi.mocked(sampleValidator);

describe("SampleCrudService", () => {
  let service: SampleCrudService;
  const mockSettings = { localStorePath: "/mock/path" };
  const mockDbPath = "/mock/db.sqlite";

  beforeEach(() => {
    service = new SampleCrudService();
    vi.clearAllMocks();

    // Setup common mocks
    mockFileSystem.ServicePathManager.getLocalStorePath.mockReturnValue(
      "/mock/path",
    );
    mockFileSystem.ServicePathManager.getDbPath.mockReturnValue(mockDbPath);
  });

  describe("addSampleToSlot", () => {
    it("should successfully add a sample", () => {
      // Mock validation
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        isValid: true,
      });
      mockValidator.sampleValidator.validateSampleFile.mockReturnValue({
        isValid: true,
      });

      // Mock stereo configuration
      mockStereoUtils.determineStereoConfiguration.mockReturnValue(false);

      // Mock database operations
      mockORM.getKitSamples.mockReturnValue({
        data: [],
        success: true,
      });
      mockORM.addSample.mockReturnValue({
        data: { sampleId: 123 },
        success: true,
      });
      mockORM.markKitAsModified.mockReturnValue(undefined);

      const result = service.addSampleToSlot(
        mockSettings,
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
      );

      expect(result.success).toBe(true);
      expect(result.data?.sampleId).toBe(123);
      expect(mockORM.addSample).toHaveBeenCalledWith(mockDbPath, {
        filename: "sample.wav",
        is_stereo: false,
        kit_name: "TestKit",
        slot_number: 0,
        source_path: "/path/to/sample.wav",
        voice_number: 1,
      });
      expect(mockORM.markKitAsModified).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
      );
    });

    it("should fail when local store path is not configured", () => {
      mockFileSystem.ServicePathManager.getLocalStorePath.mockReturnValue(null);

      const result = service.addSampleToSlot(
        {},
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("should fail when voice/slot validation fails", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        error: "Invalid voice number",
        isValid: false,
      });

      const result = service.addSampleToSlot(
        mockSettings,
        "TestKit",
        5, // Invalid voice
        0,
        "/path/to/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid voice number");
    });

    it("should fail when file validation fails", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        isValid: true,
      });
      mockValidator.sampleValidator.validateSampleFile.mockReturnValue({
        error: "File not found",
        isValid: false,
      });

      const result = service.addSampleToSlot(
        mockSettings,
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("File not found");
    });
  });

  describe("deleteSampleFromSlot", () => {
    it("should successfully delete a sample", () => {
      // Mock validation
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        isValid: true,
      });

      const existingSample: Sample = {
        created_at: "2023-01-01",
        filename: "sample.wav",
        id: 1,
        is_stereo: false,
        kit_name: "TestKit",
        slot_number: 0,
        source_path: "/path/to/sample.wav",
        voice_number: 1,
      };

      // Mock database operations
      mockORM.getKitSamples.mockReturnValue({
        data: [existingSample],
        success: true,
      });
      mockORM.deleteSamples.mockReturnValue({
        data: {
          affectedSamples: [],
          deletedSamples: [existingSample],
        },
        success: true,
      });
      mockORM.markKitAsModified.mockReturnValue(undefined);

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        0,
      );

      expect(result.success).toBe(true);
      expect(mockORM.deleteSamples).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
        {
          slotNumber: 0,
          voiceNumber: 1,
        },
      );
      expect(mockORM.markKitAsModified).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
      );
    });

    it("should fail when sample does not exist", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        isValid: true,
      });
      mockORM.getKitSamples.mockReturnValue({
        data: [], // No existing samples
        success: true,
      });

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found in voice 1, slot 1 to delete");
    });
  });

  describe("validateSampleMovement", () => {
    it("should validate successful movement parameters", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot
        .mockReturnValueOnce({ isValid: true }) // from
        .mockReturnValueOnce({ isValid: true }); // to

      // Access private method for testing
      const result = (service as any).validateSampleMovement(1, 0, 2, 1);

      expect(result.success).toBe(true);
    });

    it("should reject movement to same position", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot
        .mockReturnValueOnce({ isValid: true })
        .mockReturnValueOnce({ isValid: true });

      const result = (service as any).validateSampleMovement(1, 0, 1, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot move sample to the same position");
    });
  });
});
