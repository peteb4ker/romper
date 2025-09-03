import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as romperDbCoreORM from "../../db/romperDbCoreORM.js";
import * as fileSystemUtils from "../../utils/fileSystemUtils.js";
import { SampleBatchOperationsService } from "../sampleBatchOperations.js";
import * as sampleValidation from "../sampleValidation.js";

// Mock dependencies
vi.mock("../../db/romperDbCoreORM.js");
vi.mock("../../utils/fileSystemUtils.js");
vi.mock("../sampleValidation.js");

const mockORM = vi.mocked(romperDbCoreORM);
const mockFileSystem = vi.mocked(fileSystemUtils);
const mockSampleValidation = vi.mocked(sampleValidation);

describe("SampleBatchOperationsService", () => {
  let service: SampleBatchOperationsService;
  const mockSettings = { localStorePath: "/mock/path" };
  const mockDbPath = "/mock/db.sqlite";

  const mockSample: Sample = {
    filename: "test.wav",
    id: 1,
    is_stereo: false,
    kit_name: "TestKit",
    slot_number: 2,
    source_path: "/path/test.wav",
    voice_number: 1,
  };

  beforeEach(() => {
    service = new SampleBatchOperationsService();
    vi.clearAllMocks();

    // Setup common mocks
    mockFileSystem.ServicePathManager.getLocalStorePath.mockReturnValue(
      "/mock/path",
    );
    mockFileSystem.ServicePathManager.getDbPath.mockReturnValue(mockDbPath);
    mockSampleValidation.sampleValidationService.validateVoiceAndSlot.mockReturnValue(
      {
        isValid: true,
      },
    );
  });

  describe("deleteSampleFromSlot", () => {
    it("should successfully delete a sample", () => {
      mockSampleValidation.sampleValidationService.checkSampleExists.mockReturnValue(
        {
          exists: true,
          sample: mockSample,
        },
      );

      mockORM.deleteSamples.mockReturnValue({
        data: {
          affectedSamples: [mockSample],
          deletedSamples: [mockSample],
        },
        success: true,
      });

      mockORM.markKitAsModified.mockReturnValue({ success: true });

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(true);
      expect(result.data?.deletedSamples).toEqual([mockSample]);
      expect(mockORM.deleteSamples).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
        {
          slotNumber: 2,
          voiceNumber: 1,
        },
      );
      expect(mockORM.markKitAsModified).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
      );
    });

    it("should return error when sample doesn't exist", () => {
      mockSampleValidation.sampleValidationService.checkSampleExists.mockReturnValue(
        {
          exists: false,
        },
      );

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found in voice 1, slot 3 to delete");
    });

    it("should return error for invalid voice/slot", () => {
      mockSampleValidation.sampleValidationService.validateVoiceAndSlot.mockReturnValue(
        {
          error: "Invalid voice number",
          isValid: false,
        },
      );

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        99,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid voice number");
    });

    it("should return error when no local store path", () => {
      mockFileSystem.ServicePathManager.getLocalStorePath.mockReturnValue(null);

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("should handle database deletion error", () => {
      mockSampleValidation.sampleValidationService.checkSampleExists.mockReturnValue(
        {
          exists: true,
          sample: mockSample,
        },
      );

      mockORM.deleteSamples.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(mockORM.markKitAsModified).not.toHaveBeenCalled();
    });
  });

  describe("deleteSampleFromSlotWithoutReindexing", () => {
    it("should successfully delete without reindexing", () => {
      mockORM.deleteSamplesWithoutReindexing.mockReturnValue({
        data: {
          deletedSamples: [mockSample],
        },
        success: true,
      });

      mockORM.markKitAsModified.mockReturnValue({ success: true });

      const result = service.deleteSampleFromSlotWithoutReindexing(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(true);
      expect(result.data?.deletedSamples).toEqual([mockSample]);
      expect(result.data?.affectedSamples).toEqual([mockSample]);
      expect(mockORM.deleteSamplesWithoutReindexing).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
        {
          slotNumber: 2,
          voiceNumber: 1,
        },
      );
    });

    it("should handle validation error", () => {
      mockSampleValidation.sampleValidationService.validateVoiceAndSlot.mockReturnValue(
        {
          error: "Invalid parameters",
          isValid: false,
        },
      );

      const result = service.deleteSampleFromSlotWithoutReindexing(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid parameters");
    });
  });

  describe("moveSampleInKit", () => {
    const mockMoveResult = {
      data: {
        affectedSamples: [{ ...mockSample, original_slot_number: 2 }],
        movedSample: mockSample,
        replacedSample: null,
      },
      success: true,
    };

    it("should successfully move sample within kit", () => {
      mockSampleValidation.sampleValidationService.validateSampleMovement.mockReturnValue(
        {
          success: true,
        },
      );

      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      mockSampleValidation.sampleValidationService.validateStereoSampleMove.mockReturnValue(
        {
          success: true,
        },
      );

      mockORM.moveSample.mockReturnValue(mockMoveResult);
      mockORM.markKitAsModified.mockReturnValue({ success: true });

      const result = service.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        2,
        1,
        3,
        "insert",
      );

      expect(result.success).toBe(true);
      expect(result.data?.movedSample).toEqual(mockSample);
      expect(result.data?.replacedSample).toBeUndefined(); // null converted to undefined
      expect(mockORM.moveSample).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
        1,
        2,
        1,
        3,
      );
      expect(mockORM.markKitAsModified).toHaveBeenCalledWith(
        mockDbPath,
        "TestKit",
      );
    });

    it("should return error when sample not found", () => {
      mockSampleValidation.sampleValidationService.validateSampleMovement.mockReturnValue(
        {
          success: true,
        },
      );

      mockORM.getKitSamples.mockReturnValue({
        data: [], // No samples
        success: true,
      });

      const result = service.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        2,
        1,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found at voice 1, slot 3");
    });

    it("should return error for validation failure", () => {
      mockSampleValidation.sampleValidationService.validateSampleMovement.mockReturnValue(
        {
          error: "Invalid movement",
          success: false,
        },
      );

      const result = service.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        2,
        1,
        2,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid movement");
    });

    it("should return error for stereo validation failure", () => {
      mockSampleValidation.sampleValidationService.validateSampleMovement.mockReturnValue(
        {
          success: true,
        },
      );

      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      mockSampleValidation.sampleValidationService.validateStereoSampleMove.mockReturnValue(
        {
          error: "Stereo conflict",
          success: false,
        },
      );

      const result = service.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        2,
        1,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Stereo conflict");
    });

    it("should handle database move error", () => {
      mockSampleValidation.sampleValidationService.validateSampleMovement.mockReturnValue(
        {
          success: true,
        },
      );

      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      mockSampleValidation.sampleValidationService.validateStereoSampleMove.mockReturnValue(
        {
          success: true,
        },
      );

      mockORM.moveSample.mockReturnValue({
        error: "Database move error",
        success: false,
      });

      const result = service.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        2,
        1,
        3,
        "insert",
      );

      expect(result.success).toBe(false);
      expect(mockORM.markKitAsModified).not.toHaveBeenCalled();
    });
  });

  describe("executeCrossKitMove", () => {
    const mockAddSampleToSlot = vi.fn();

    it("should successfully execute cross-kit move", () => {
      mockAddSampleToSlot.mockReturnValue({
        data: { sampleId: 123 },
        success: true,
      });

      // Mock the deleteSampleFromSlot method
      const deleteSpy = vi
        .spyOn(service, "deleteSampleFromSlot")
        .mockReturnValue({
          data: {
            affectedSamples: [mockSample],
            deletedSamples: [mockSample],
          },
          success: true,
        });

      const result = service.executeCrossKitMove(
        mockAddSampleToSlot,
        mockSettings,
        mockSample,
        "DestKit",
        2,
        0,
        "SourceKit",
        1,
        2,
      );

      expect(result.success).toBe(true);
      expect(result.data?.movedSample).toEqual(mockSample);
      expect(result.data?.replacedSample).toBeUndefined();
      expect(mockAddSampleToSlot).toHaveBeenCalledWith(
        mockSettings,
        "DestKit",
        2,
        0,
        mockSample.source_path,
        { forceMono: true, forceStereo: false },
      );
      expect(deleteSpy).toHaveBeenCalledWith(mockSettings, "SourceKit", 1, 2);

      deleteSpy.mockRestore();
    });

    it("should handle add failure", () => {
      mockAddSampleToSlot.mockReturnValue({
        error: "Add failed",
        success: false,
      });

      const result = service.executeCrossKitMove(
        mockAddSampleToSlot,
        mockSettings,
        mockSample,
        "DestKit",
        2,
        0,
        "SourceKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to add sample to destination: Add failed",
      );
    });

    it("should handle delete failure with rollback", () => {
      mockAddSampleToSlot.mockReturnValue({
        data: { sampleId: 123 },
        success: true,
      });

      // Mock methods - first call succeeds (add), second fails (delete), third succeeds (rollback)
      const deleteSpy = vi
        .spyOn(service, "deleteSampleFromSlot")
        .mockReturnValueOnce({
          error: "Delete failed",
          success: false,
        })
        .mockReturnValueOnce({
          data: { affectedSamples: [], deletedSamples: [] },
          success: true,
        });

      const result = service.executeCrossKitMove(
        mockAddSampleToSlot,
        mockSettings,
        mockSample,
        "DestKit",
        2,
        0,
        "SourceKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to delete source sample: Delete failed",
      );
      expect(deleteSpy).toHaveBeenCalledTimes(2); // Delete attempt + rollback

      deleteSpy.mockRestore();
    });

    it("should handle stereo sample correctly", () => {
      const stereoSample = { ...mockSample, is_stereo: true };
      mockAddSampleToSlot.mockReturnValue({
        data: { sampleId: 123 },
        success: true,
      });

      const deleteSpy = vi
        .spyOn(service, "deleteSampleFromSlot")
        .mockReturnValue({
          data: {
            affectedSamples: [stereoSample],
            deletedSamples: [stereoSample],
          },
          success: true,
        });

      const result = service.executeCrossKitMove(
        mockAddSampleToSlot,
        mockSettings,
        stereoSample,
        "DestKit",
        2,
        0,
        "SourceKit",
        1,
        2,
      );

      expect(result.success).toBe(true);
      expect(mockAddSampleToSlot).toHaveBeenCalledWith(
        mockSettings,
        "DestKit",
        2,
        0,
        stereoSample.source_path,
        { forceMono: false, forceStereo: true }, // Should force stereo for stereo sample
      );

      deleteSpy.mockRestore();
    });
  });
});
