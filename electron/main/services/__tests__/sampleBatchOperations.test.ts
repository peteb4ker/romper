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
const mockFileSystem = vi.mocked(fileSystemUtils, { deep: true });
const mockSampleValidation = vi.mocked(sampleValidation, { deep: true });

describe("SampleBatchOperationsService", () => {
  let service: SampleBatchOperationsService;
  const mockSettings = { localStorePath: "/mock/path" };
  const mockDbPath = "/mock/db.sqlite";
  const mockDb = { handle: "transaction" } as never;
  const mockSqlite = {} as never;

  const mockSample = {
    filename: "test.wav",
    id: 1,
    kit_name: "TestKit",
    slot_number: 2,
    source_path: "/path/test.wav",
    voice_number: 1,
  } as Sample;

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
    mockSampleValidation.sampleValidationService.validateVoiceNotLinkedPartner.mockReturnValue(
      { isValid: true },
    );
    // One unit of work: a throw inside becomes a failed result
    mockORM.withDbTransaction.mockImplementation((_dbDir, fn) => {
      try {
        return { data: fn(mockDb, mockSqlite), success: true };
      } catch (error) {
        return { error: (error as Error).message, success: false };
      }
    });
  });

  describe("[UC-23] deleteSampleFromSlot", () => {
    it("[Q-02] deletes, reindexes and flags the kit in one transaction", () => {
      mockORM.deleteSamplesTx.mockReturnValue({
        affectedSamples: [mockSample],
        deletedSamples: [mockSample],
      });

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(true);
      expect(result.data?.deletedSamples).toEqual([mockSample]);
      expect(mockORM.withDbTransaction).toHaveBeenCalledTimes(1);
      expect(mockORM.withDbTransaction).toHaveBeenCalledWith(
        mockDbPath,
        expect.any(Function),
      );
      expect(mockORM.deleteSamplesTx).toHaveBeenCalledWith(mockDb, "TestKit", {
        slotNumber: 2,
        voiceNumber: 1,
      });
      expect(mockORM.flagKitModified).toHaveBeenCalledWith(mockDb, "TestKit");
    });

    it("should return error when sample doesn't exist", () => {
      mockORM.deleteSamplesTx.mockReturnValue({
        affectedSamples: [],
        deletedSamples: [],
      });

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No sample found in voice 1, slot 3 to delete");
      expect(mockORM.flagKitModified).not.toHaveBeenCalled();
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
      mockORM.deleteSamplesTx.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = service.deleteSampleFromSlot(
        mockSettings,
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(mockORM.flagKitModified).not.toHaveBeenCalled();
    });
  });

  describe("[UC-21] moveSampleInKit", () => {
    const mockMoveResult = {
      affectedSamples: [
        {
          ...mockSample,
          original_slot_number: 2,
          original_voice_number: 1,
        },
      ],
      movedSample: mockSample,
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

      mockORM.moveSampleTx.mockReturnValue(mockMoveResult);

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
      // The move and the modified flag are one transaction (RE-28)
      expect(mockORM.moveSampleTx).toHaveBeenCalledWith(
        mockDb,
        "TestKit",
        1,
        2,
        1,
        3,
      );
      expect(mockORM.flagKitModified).toHaveBeenCalledWith(mockDb, "TestKit");
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

    it("[UC-28] refuses a move onto the linked partner of a stereo voice", () => {
      mockSampleValidation.sampleValidationService.validateSampleMovement.mockReturnValue(
        {
          success: true,
        },
      );

      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      const linkError =
        "Voice 2 is linked to voice 1 for stereo. Unlink them to put samples on voice 2.";
      mockSampleValidation.sampleValidationService.validateVoiceNotLinkedPartner.mockReturnValue(
        {
          error: linkError,
          isValid: false,
        },
      );

      const result = service.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        2,
        2,
        0,
        "insert",
      );

      expect(result).toEqual({ error: linkError, success: false });
      expect(
        mockSampleValidation.sampleValidationService
          .validateVoiceNotLinkedPartner,
      ).toHaveBeenCalledWith(mockDbPath, "TestKit", 2);
      expect(mockORM.moveSampleTx).not.toHaveBeenCalled();
      expect(mockORM.flagKitModified).not.toHaveBeenCalled();
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

      mockORM.moveSampleTx.mockImplementation(() => {
        throw new Error("Database move error");
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

      expect(result).toEqual({ error: "Database move error", success: false });
      expect(mockORM.flagKitModified).not.toHaveBeenCalled();
    });
  });
});
