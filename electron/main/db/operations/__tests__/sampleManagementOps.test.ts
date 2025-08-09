import type { Sample } from "@romper/shared/db/schema.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withDb } from "../../utils/dbUtilities.js";
import {
  compactSlotsAfterDelete,
  executeMoveOperation,
  getSampleToMove,
  groupSamplesByVoice,
  handleInsertMode,
  handleOverwriteMode,
  handleOverwriteModeOperation,
  handlePostMoveCompaction,
  handleSameVoiceCompaction,
  handleSampleShifting,
  initializeMoveContext,
  moveSample,
  performVoiceCompaction,
  updateSamplePosition,
} from "../sampleManagementOps";

// Mock dependencies
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
}));

vi.mock("@romper/shared/db/schema.js", () => ({
  samples: {
    id: "id",
    kit_name: "kit_name",
    slot_number: "slot_number",
    voice_number: "voice_number",
  },
}));

// Import the actual withDbTransaction type for better type safety
import { withDbTransaction } from "../../utils/dbUtilities.js";

// Mock withDb and withDbTransaction functions
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
  withDbTransaction: vi.fn(),
}));

describe("sampleManagementOps unit tests", () => {
  let mockDb: any;
  let consoleLogSpy: any;
  const testDbDir = "/test/db/dir";
  const testKitName = "Test Kit";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock database operations
    mockDb = {
      all: vi.fn(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      get: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue({ changes: 1 }),
      select: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };

    // Mock withDb to execute the function with mockDb
    vi.mocked(withDb).mockImplementation(
      (dbDir: string, fn: (db: any) => any) => {
        if (!dbDir || dbDir.includes("/test/")) {
          // For test database paths, actually execute the function
          try {
            const result = fn(mockDb);
            return { data: result, success: true };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : String(error),
              success: false,
            };
          }
        } else {
          // For other paths, return database error
          return {
            error: `Database file does not exist: ${dbDir}/romper.sqlite`,
            success: false,
          };
        }
      },
    );

    // Mock withDbTransaction to execute the function with mockDb and mock sqlite
    vi.mocked(withDbTransaction).mockImplementation(
      (dbDir: string, fn: (db: any, sqlite: any) => any) => {
        if (!dbDir || dbDir.includes("/test/")) {
          // For test database paths, actually execute the function
          try {
            const mockSqlite = {
              close: vi.fn(),
              exec: vi.fn(),
            };
            const result = fn(mockDb, mockSqlite);
            return { data: result, success: true };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : String(error),
              success: false,
            };
          }
        } else {
          // For other paths, return database error
          return {
            error: `Database file does not exist: ${dbDir}/romper.sqlite`,
            success: false,
          };
        }
      },
    );
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("compactSlotsAfterDelete", () => {
    const testVoiceNumber = 1;
    const testDeletedSlot = 3;

    it("should compact slots after deletion", () => {
      const mockSamples = [
        { id: 1, slot_number: 4, voice_number: 1 },
        { id: 2, slot_number: 5, voice_number: 1 },
        { id: 3, slot_number: 6, voice_number: 1 },
      ];

      mockDb.all.mockReturnValue(mockSamples);

      const result = compactSlotsAfterDelete(
        testDbDir,
        testKitName,
        testVoiceNumber,
        testDeletedSlot,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(mockDb.update).toHaveBeenCalledTimes(3);
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 3 }); // First sample moved from 4 to 3
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 4 }); // Second sample moved from 5 to 4
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 5 }); // Third sample moved from 6 to 5
    });

    it("should handle no samples to compact", () => {
      mockDb.all.mockReturnValue([]);

      const result = compactSlotsAfterDelete(
        testDbDir,
        testKitName,
        testVoiceNumber,
        testDeletedSlot,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("getSampleToMove", () => {
    const testFromVoice = 1;
    const testFromSlot = 2;

    it("should return sample when found", () => {
      const mockSample = {
        filename: "test.wav",
        id: 1,
        kit_name: testKitName,
        slot_number: testFromSlot,
        voice_number: testFromVoice,
      };

      mockDb.get.mockReturnValue(mockSample);

      const result = getSampleToMove(
        mockDb,
        testKitName,
        testFromVoice,
        testFromSlot,
      );

      expect(result).toEqual(mockSample);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should return null when sample not found", () => {
      mockDb.get.mockReturnValue(null);

      const result = getSampleToMove(
        mockDb,
        testKitName,
        testFromVoice,
        testFromSlot,
      );

      expect(result).toBe(null);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[Main] No sample found at voice ${testFromVoice}, slot ${testFromSlot}`,
      );
    });
  });

  describe("groupSamplesByVoice", () => {
    it("should group samples by voice number", () => {
      const samplesToDelete: Sample[] = [
        { id: 1, slot_number: 1, voice_number: 1 } as Sample,
        { id: 2, slot_number: 2, voice_number: 1 } as Sample,
        { id: 3, slot_number: 1, voice_number: 2 } as Sample,
        { id: 4, slot_number: 1, voice_number: 3 } as Sample,
        { id: 5, slot_number: 3, voice_number: 2 } as Sample,
      ];

      const result = groupSamplesByVoice(samplesToDelete);

      expect(result.size).toBe(3);
      expect(result.get(1)).toHaveLength(2);
      expect(result.get(2)).toHaveLength(2);
      expect(result.get(3)).toHaveLength(1);
    });

    it("should handle empty array", () => {
      const result = groupSamplesByVoice([]);

      expect(result.size).toBe(0);
    });
  });

  describe("handleSampleShifting", () => {
    const testToVoice = 1;
    const testToSlot = 3;

    it("should shift samples down to make room for insert", () => {
      const mockSamples = [
        { id: 1, slot_number: 3, voice_number: 1 },
        { id: 2, slot_number: 4, voice_number: 1 },
        { id: 3, slot_number: 5, voice_number: 1 },
      ];

      mockDb.all.mockReturnValue(mockSamples);

      const result = handleSampleShifting(
        mockDb,
        testKitName,
        testToVoice,
        testToSlot,
      );

      expect(result).toHaveLength(3);
      expect(mockDb.update).toHaveBeenCalledTimes(3);
      // Samples should be shifted in reverse order to avoid conflicts
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 6 }); // 5 -> 6
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 5 }); // 4 -> 5
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 4 }); // 3 -> 4
    });

    it("should handle no samples to shift", () => {
      mockDb.all.mockReturnValue([]);

      const result = handleSampleShifting(
        mockDb,
        testKitName,
        testToVoice,
        testToSlot,
      );

      expect(result).toEqual([]);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("handleInsertMode", () => {
    it("should delegate to handleSampleShifting", () => {
      const testToVoice = 1;
      const testToSlot = 3;
      const mockSamples = [{ id: 1, slot_number: 3 }];

      mockDb.all.mockReturnValue(mockSamples);

      const result = handleInsertMode(
        mockDb,
        testKitName,
        testToVoice,
        testToSlot,
      );

      expect(result).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("handleOverwriteMode", () => {
    it("should call handleOverwriteModeOperation and return empty array", () => {
      const testToVoice = 1;
      const testToSlot = 3;
      const mockMoveContext = { replacedSample: null };

      mockDb.get.mockReturnValue(null); // No existing sample

      const result = handleOverwriteMode(
        mockDb,
        testKitName,
        testToVoice,
        testToSlot,
        mockMoveContext,
      );

      expect(result).toEqual([]);
    });
  });

  describe("handleOverwriteModeOperation", () => {
    const testToVoice = 1;
    const testToSlot = 3;

    it("should replace existing sample", () => {
      const mockExistingSample = {
        id: 2,
        slot_number: testToSlot,
        voice_number: testToVoice,
      };
      const mockMoveContext = { replacedSample: null };

      mockDb.get.mockReturnValue(mockExistingSample);

      handleOverwriteModeOperation(
        mockDb,
        testToVoice,
        testToSlot,
        mockMoveContext,
      );

      expect(mockMoveContext.replacedSample).toEqual(mockExistingSample);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should handle no existing sample", () => {
      const mockMoveContext = { replacedSample: null };

      mockDb.get.mockReturnValue(null);

      handleOverwriteModeOperation(
        mockDb,
        testToVoice,
        testToSlot,
        mockMoveContext,
      );

      expect(mockMoveContext.replacedSample).toBe(null);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe("handlePostMoveCompaction", () => {
    const testFromVoice = 1;
    const testFromSlot = 2;

    it("should compact slots after cross-voice move", () => {
      const mockSamples = [
        { id: 1, slot_number: 3, voice_number: 1 },
        { id: 2, slot_number: 4, voice_number: 1 },
        { id: 3, slot_number: 5, voice_number: 1 },
      ];

      mockDb.all.mockReturnValue(mockSamples);

      const result = handlePostMoveCompaction(
        mockDb,
        testKitName,
        testFromVoice,
        testFromSlot,
      );

      expect(result).toHaveLength(3);
      expect(mockDb.update).toHaveBeenCalledTimes(3);
      expect(result[0]).toEqual(
        expect.objectContaining({
          original_slot_number: 3,
          slot_number: 2,
        }),
      );
    });
  });

  describe("handleSameVoiceCompaction", () => {
    const testFromVoice = 1;

    it("should handle moving down (fromSlot < toSlot)", () => {
      const testFromSlot = 2;
      const testToSlot = 5;
      const mockSamples = [
        { id: 1, slot_number: 3, voice_number: 1 },
        { id: 2, slot_number: 4, voice_number: 1 },
        { id: 3, slot_number: 5, voice_number: 1 },
      ];

      mockDb.all.mockReturnValue(mockSamples);

      const result = handleSameVoiceCompaction(
        mockDb,
        testKitName,
        testFromVoice,
        testFromSlot,
        testToSlot,
      );

      expect(result).toHaveLength(3);
      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it("should handle moving up (fromSlot > toSlot)", () => {
      const testFromSlot = 5;
      const testToSlot = 2;
      const mockSamples = [
        { id: 1, slot_number: 2, voice_number: 1 },
        { id: 2, slot_number: 3, voice_number: 1 },
        { id: 3, slot_number: 4, voice_number: 1 },
      ];

      mockDb.all.mockReturnValue(mockSamples);

      const result = handleSameVoiceCompaction(
        mockDb,
        testKitName,
        testFromVoice,
        testFromSlot,
        testToSlot,
      );

      expect(result).toHaveLength(3);
      expect(mockDb.update).toHaveBeenCalledTimes(3);
      // Samples should be shifted down by 1
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 5 }); // 4 -> 5
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 4 }); // 3 -> 4
      expect(mockDb.set).toHaveBeenCalledWith({ slot_number: 3 }); // 2 -> 3
    });
  });

  describe("initializeMoveContext", () => {
    it("should create move context with correct structure", () => {
      const testToSlot = 5;

      const result = initializeMoveContext(testToSlot);

      expect(result).toEqual({
        replacedSample: null,
        toSlot: testToSlot,
      });
    });
  });

  // temporarilyMoveSample test removed - function deprecated in favor of atomic moves

  describe("updateSamplePosition", () => {
    it("should update sample position", () => {
      const testSampleId = 123;
      const testNewSlot = 5;
      const testNewVoice = 2;

      updateSamplePosition(mockDb, testSampleId, testNewSlot, testNewVoice);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({
        slot_number: testNewSlot,
        voice_number: testNewVoice,
      });
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("executeMoveOperation", () => {
    const mockSampleToMove = {
      id: 1,
      slot_number: 2,
      voice_number: 1,
    } as Sample;

    let baseMoveParams: any;

    beforeEach(() => {
      baseMoveParams = {
        db: mockDb,
        dbDir: testDbDir,
        fromSlot: 2,
        fromVoice: 1,
        kitName: testKitName,
        sampleToMove: mockSampleToMove,
        toVoice: 2,
      };
    });

    it("should execute insert mode operation", () => {
      const mockMoveContext = { replacedSample: null, toSlot: 3 };
      const moveParams = {
        ...baseMoveParams,
        mode: "insert" as const,
        moveContext: mockMoveContext,
      };

      mockDb.all.mockReturnValue([]); // No samples to shift

      const result = executeMoveOperation(moveParams);

      expect(result.movedSample).toEqual({
        ...mockSampleToMove,
        slot_number: 3,
        voice_number: 2,
      });
      expect(mockDb.update).toHaveBeenCalled(); // For temporary move and final position
    });

    it("should execute overwrite mode operation", () => {
      const mockMoveContext = { replacedSample: null, toSlot: 3 };
      const moveParams = {
        ...baseMoveParams,
        mode: "overwrite" as const,
        moveContext: mockMoveContext,
      };

      mockDb.all.mockReturnValue([]); // No samples to compact
      mockDb.get.mockReturnValue(null); // No existing sample to replace

      const result = executeMoveOperation(moveParams);

      expect(result.movedSample).toEqual({
        ...mockSampleToMove,
        slot_number: 3,
        voice_number: 2,
      });
    });

    it("should handle same voice move", () => {
      const mockMoveContext = { replacedSample: null, toSlot: 4 };
      const moveParams = {
        ...baseMoveParams,
        fromVoice: 1,
        mode: "insert" as const,
        moveContext: mockMoveContext,
        toVoice: 1, // Same voice
      };

      mockDb.all.mockReturnValue([]); // No samples to shift

      const result = executeMoveOperation(moveParams);

      expect(result.movedSample.voice_number).toBe(1);
      expect(result.movedSample.slot_number).toBe(4);
    });
  });

  describe("moveSample", () => {
    const testFromVoice = 1;
    const testFromSlot = 2;
    const testToVoice = 2;
    const testToSlot = 3;

    it("should successfully move sample", () => {
      const mockSample = {
        id: 1,
        slot_number: testFromSlot,
        voice_number: testFromVoice,
      } as Sample;

      mockDb.get.mockReturnValue(mockSample);
      mockDb.all.mockReturnValue([]); // No samples to shift/compact

      const result = moveSample(
        testDbDir,
        testKitName,
        testFromVoice,
        testFromSlot,
        testToVoice,
        testToSlot,
        "insert",
      );

      expect(result.success).toBe(true);
      expect(result.data?.movedSample).toEqual({
        ...mockSample,
        slot_number: testToSlot,
        voice_number: testToVoice,
      });
    });

    it("should handle sample not found", () => {
      mockDb.get.mockReturnValue(null);

      const result = moveSample(
        testDbDir,
        testKitName,
        testFromVoice,
        testFromSlot,
        testToVoice,
        testToSlot,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        `No sample found at voice ${testFromVoice}, slot ${testFromSlot}`,
      );
    });
  });

  describe("performVoiceCompaction", () => {
    it("should compact multiple voices after deletion", () => {
      const samplesToDelete: Sample[] = [
        { id: 1, slot_number: 2, voice_number: 1 } as Sample,
        { id: 2, slot_number: 4, voice_number: 1 } as Sample,
        { id: 3, slot_number: 1, voice_number: 2 } as Sample,
      ];

      // Mock the compactSlotsAfterDelete function calls
      vi.mocked(withDb).mockImplementation(
        (_dbDir: string, _fn: (db: any) => any) => {
          // Simulate compaction results
          return { data: [{ id: 4, slot_number: 3 }], success: true };
        },
      );

      const result = performVoiceCompaction(
        testDbDir,
        testKitName,
        samplesToDelete,
      );

      expect(result).toHaveLength(3); // 3 calls to compactSlotsAfterDelete
      expect(vi.mocked(withDb)).toHaveBeenCalledTimes(3);
    });

    it("should handle empty deletion list", () => {
      const result = performVoiceCompaction(testDbDir, testKitName, []);

      expect(result).toEqual([]);
    });

    it("should handle compaction failures gracefully", () => {
      const samplesToDelete: Sample[] = [
        { id: 1, slot_number: 2, voice_number: 1 } as Sample,
      ];

      vi.mocked(withDb).mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = performVoiceCompaction(
        testDbDir,
        testKitName,
        samplesToDelete,
      );

      expect(result).toEqual([]);
    });
  });
});
