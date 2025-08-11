import type { Sample } from "@romper/shared/db/schema.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withDb } from "../../utils/dbUtilities.js";
import {
  getSampleToMove,
  groupSamplesByVoice,
  moveSample,
  performVoiceReindexing,
} from "../sampleManagementOps";

// Mock dependencies
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  ne: vi.fn(), // Not equal operator
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
      orderBy: vi.fn().mockReturnThis(),
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
        { id: 1, slot_number: 0, voice_number: 1 } as Sample,
        { id: 2, slot_number: 1, voice_number: 1 } as Sample,
        { id: 3, slot_number: 0, voice_number: 2 } as Sample,
        { id: 4, slot_number: 0, voice_number: 3 } as Sample,
        { id: 5, slot_number: 2, voice_number: 2 } as Sample,
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

  // Legacy functions removed - only atomic moveSample() and performVoiceReindexing() remain

  describe("moveSample", () => {
    const testFromVoice = 1;
    const testFromSlot = 2; // 0-based slot indexing (0-11) - slot 3 in UI
    const testToVoice = 2;
    const testToSlot = 3; // 0-based slot indexing (0-11) - slot 4 in UI

    it("should successfully move sample", () => {
      const mockSample = {
        id: 1,
        slot_number: testFromSlot,
        voice_number: testFromVoice,
      } as Sample;

      const expectedMovedSample = {
        id: 1,
        slot_number: testToSlot,
        voice_number: testToVoice,
      } as Sample;

      // Mock the database calls to simulate the move operation
      mockDb.get.mockReturnValue(mockSample); // Initial sample lookup
      mockDb.all.mockReturnValue([]); // No samples to shift/reindex

      // Mock the update operation to return the updated sample
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockReturnValue({ changes: 1 }),
          }),
        }),
      });

      // Mock the final sample lookup to return the updated sample
      mockDb.get
        .mockReturnValueOnce(mockSample) // First call for finding sample
        .mockReturnValueOnce(expectedMovedSample); // Second call for returning moved sample

      const result = moveSample(
        testDbDir,
        testKitName,
        testFromVoice,
        testFromSlot,
        testToVoice,
        testToSlot,
      );

      if (!result.success) {
        console.error("Move failed with error:", result.error);
      }
      expect(result.success).toBe(true);
      expect(result.data?.movedSample).toEqual(expectedMovedSample);
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

  describe("performVoiceReindexing", () => {
    it("should reindex multiple voices after deletion", () => {
      const samplesToDelete: Sample[] = [
        { id: 1, slot_number: 1, voice_number: 1 } as Sample,
        { id: 2, slot_number: 3, voice_number: 1 } as Sample,
        { id: 3, slot_number: 0, voice_number: 2 } as Sample,
      ];

      // Mock the database calls for reindexing
      vi.mocked(withDb).mockImplementation(
        (_dbDir: string, fn: (db: any) => any) => {
          // Mock the database query and update calls for reindexing
          const mockDb = {
            all: vi.fn().mockReturnValue([{ id: 4, slot_number: 300 }]), // Reindexed result
            from: vi.fn().mockReturnThis(),
            run: vi.fn(),
            select: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
          };
          const result = fn(mockDb);
          return { data: result, success: true };
        },
      );

      const result = performVoiceReindexing(
        testDbDir,
        testKitName,
        samplesToDelete,
      );

      expect(result).toHaveLength(2); // 2 voices to reindex (voice 1 and voice 2)
      expect(vi.mocked(withDb)).toHaveBeenCalledTimes(2); // One call per voice
    });

    it("should handle empty deletion list", () => {
      const result = performVoiceReindexing(testDbDir, testKitName, []);

      expect(result).toEqual([]);
    });

    it("should handle reindexing failures gracefully", () => {
      const samplesToDelete: Sample[] = [
        { id: 1, slot_number: 1, voice_number: 1 } as Sample,
      ];

      vi.mocked(withDb).mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = performVoiceReindexing(
        testDbDir,
        testKitName,
        samplesToDelete,
      );

      expect(result).toEqual([]);
    });
  });
});
