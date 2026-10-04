import { beforeEach, describe, expect, it, vi } from "vitest";

import * as romperDbCoreORM from "../../../db/romperDbCoreORM.js";
import * as fileSystemUtils from "../../../utils/fileSystemUtils.js";
import * as sampleBatchOperations from "../../sampleBatchOperations.js";
import * as sampleValidation from "../../sampleValidation.js";
import { SampleCrudService } from "../sampleCrudService";

// Mock dependencies
vi.mock("../../../db/romperDbCoreORM.js");
vi.mock("../../../utils/fileSystemUtils.js");
vi.mock("../../sampleBatchOperations.js");
vi.mock("../../sampleValidation.js");

const mockORM = vi.mocked(romperDbCoreORM);
const mockFileSystem = vi.mocked(fileSystemUtils, true);
const mockBatchOps = vi.mocked(sampleBatchOperations, true);
const mockValidation = vi.mocked(sampleValidation, true);

describe("SampleCrudService", () => {
  let service: SampleCrudService;
  const mockSettings = { localStorePath: "/mock/path" };
  const mockDbPath = "/mock/db.sqlite";
  const mockDb = { handle: "transaction" } as never;

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
    mockValidation.sampleValidationService.validateVoiceNotLinkedPartner.mockReturnValue(
      { isValid: true },
    );
    mockValidation.sampleValidationService.validateSampleFile.mockReturnValue({
      isValid: true,
    });
    // One unit of work: a throw inside becomes a failed result
    mockORM.withDbTransaction.mockImplementation((_dbDir, fn) => {
      try {
        return { data: fn(mockDb, {} as never), success: true };
      } catch (error) {
        return { error: (error as Error).message, success: false };
      }
    });
  });

  describe("[UC-19] addSampleToSlot", () => {
    it("[Q-02] adds the sample and flags the kit in one transaction", () => {
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

      mockORM.addSampleTx.mockReturnValue({ sampleId: 123 });

      const result = service.addSampleToSlot(
        mockSettings,
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
      );

      expect(result.success).toBe(true);
      expect(result.data?.sampleId).toBe(123);
      expect(mockORM.withDbTransaction).toHaveBeenCalledTimes(1);
      expect(mockORM.addSampleTx).toHaveBeenCalledWith(mockDb, {
        filename: "sample.wav",
        kit_name: "TestKit",
        slot_number: 0,
        source_path: "/path/to/sample.wav",
        voice_number: 1,
      });
      expect(mockORM.flagKitModified).toHaveBeenCalledWith(mockDb, "TestKit");
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

    it("[UC-28] refuses the linked partner of a stereo voice", () => {
      const linkError =
        "Voice 2 is linked to voice 1 for stereo. Unlink them to put samples on voice 2.";
      mockValidation.sampleValidationService.validateVoiceNotLinkedPartner.mockReturnValue(
        {
          error: linkError,
          isValid: false,
        },
      );

      const result = service.addSampleToSlot(
        mockSettings,
        "TestKit",
        2,
        0,
        "/path/to/sample.wav",
      );

      expect(result).toEqual({ error: linkError, success: false });
      expect(
        mockValidation.sampleValidationService.validateVoiceNotLinkedPartner,
      ).toHaveBeenCalledWith(mockDbPath, "TestKit", 2);
      expect(mockORM.addSampleTx).not.toHaveBeenCalled();
      expect(mockORM.flagKitModified).not.toHaveBeenCalled();
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
