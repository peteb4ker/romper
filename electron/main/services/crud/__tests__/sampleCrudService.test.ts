import { beforeEach, describe, expect, it, vi } from "vitest";

import * as romperDbCoreORM from "../../../db/romperDbCoreORM.js";
import * as fileSystemUtils from "../../../utils/fileSystemUtils.js";
import * as stereoProcessingUtils from "../../../utils/stereoProcessingUtils.js";
import * as sampleBatchOperations from "../../sampleBatchOperations.js";
import * as sampleValidation from "../../sampleValidation.js";
import { SampleCrudService } from "../sampleCrudService";

// Mock dependencies
vi.mock("../../../db/romperDbCoreORM.js");
vi.mock("../../../utils/fileSystemUtils.js");
vi.mock("../../../utils/stereoProcessingUtils.js");
vi.mock("../../sampleBatchOperations.js");
vi.mock("../../sampleValidation.js");

const mockORM = vi.mocked(romperDbCoreORM);
const mockFileSystem = vi.mocked(fileSystemUtils);
const mockStereoUtils = vi.mocked(stereoProcessingUtils);
const mockBatchOps = vi.mocked(sampleBatchOperations);
const mockValidation = vi.mocked(sampleValidation);

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

    // Mock validation service
    mockValidation.sampleValidationService.validateVoiceAndSlot.mockReturnValue(
      {
        isValid: true,
      },
    );
    mockValidation.sampleValidationService.validateSampleFile.mockReturnValue({
      isValid: true,
    });
    mockValidation.sampleValidationService.checkSampleExists.mockReturnValue({
      exists: false,
    });
  });

  describe("addSampleToSlot", () => {
    it("should successfully add a sample", () => {
      // Mock validation (already set in beforeEach, but override for clarity)
      mockValidation.sampleValidationService.validateVoiceAndSlot.mockReturnValue(
        {
          isValid: true,
        },
      );
      mockValidation.sampleValidationService.validateSampleFile.mockReturnValue(
        {
          isValid: true,
        },
      );

      // Mock stereo configuration
      mockStereoUtils.determineStereoConfiguration.mockReturnValue(false);

      // Mock database operations
      mockValidation.sampleValidationService.checkSampleExists.mockReturnValue({
        exists: false,
        sample: undefined,
      });
      mockORM.addSample.mockReturnValue({
        data: { sampleId: 123 },
        success: true,
      });
      mockORM.markKitAsModified.mockReturnValue({ success: true });

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
      mockValidation.sampleValidationService.validateVoiceAndSlot.mockReturnValue(
        {
          error: "Invalid voice number",
          isValid: false,
        },
      );

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
      mockValidation.sampleValidationService.validateVoiceAndSlot.mockReturnValue(
        {
          isValid: true,
        },
      );
      mockValidation.sampleValidationService.validateSampleFile.mockReturnValue(
        {
          error: "File not found",
          isValid: false,
        },
      );

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
    it("should delegate to batch operations service", () => {
      const mockResult = {
        data: { affectedSamples: [], deletedSamples: [] },
        success: true,
      };

      mockBatchOps.sampleBatchOperationsService.deleteSampleFromSlot.mockReturnValue(
        mockResult,
      );

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        0,
      );

      expect(result).toEqual(mockResult);
      expect(
        mockBatchOps.sampleBatchOperationsService.deleteSampleFromSlot,
      ).toHaveBeenCalledWith(mockSettings, "TestKit", 1, 0);
    });
  });
});
