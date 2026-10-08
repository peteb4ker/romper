import type { Sample } from "@romper/shared/db/schema.js";
import type BetterSqlite3 from "better-sqlite3";

import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  type MockInstance,
  vi,
} from "vitest";

import { type RomperDb, withDb } from "../../utils/dbUtilities.js";
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
  banks: {},
  kits: { modified_since_sync: "modified_since_sync", name: "name" },
  samples: {
    id: "id",
    kit_name: "kit_name",
    slot_number: "slot_number",
    voice_number: "voice_number",
  },
  voices: {},
}));

// Import the actual withDbTransaction type for better type safety
import { withDbTransaction } from "../../utils/dbUtilities.js";

// Mock withDb and withDbTransaction functions
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
  withDbTransaction: vi.fn(),
}));

/** The query-builder methods the operations call, chained on one mock */
type MockDb = Record<
  | "all"
  | "delete"
  | "from"
  | "get"
  | "insert"
  | "orderBy"
  | "run"
  | "select"
  | "set"
  | "update"
  | "values"
  | "where",
  Mock
>;

describe("sampleManagementOps unit tests", () => {
  let mockDb: MockDb;
  let consoleLogSpy: MockInstance<typeof console.log>;
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
      (dbDir: string, fn: (db: RomperDb) => unknown) => {
        if (!dbDir || dbDir.includes("/test/")) {
          // For test database paths, actually execute the function
          try {
            const result = fn(mockDb as unknown as RomperDb);
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
      (
        dbDir: string,
        fn: (db: RomperDb, sqlite: BetterSqlite3.Database) => unknown,
      ) => {
        if (!dbDir || dbDir.includes("/test/")) {
          // For test database paths, actually execute the function
          try {
            const mockSqlite = {
              close: vi.fn(),
              exec: vi.fn(),
            };
            const result = fn(
              mockDb as unknown as RomperDb,
              mockSqlite as unknown as BetterSqlite3.Database,
            );
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
        mockDb as unknown as RomperDb,
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
        mockDb as unknown as RomperDb,
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

  describe("[Q-02] performVoiceReindexing", () => {
    /** A handle whose voice query returns `remaining` per voice */
    function reindexDb(remaining: Record<number, Sample[]>) {
      const updates: Array<{ id: unknown; slot: number }> = [];
      let voice = 0;
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({ all: () => remaining[voice] ?? [] }),
            }),
          }),
        }),
        update: () => ({
          set: ({ slot_number }: { slot_number: number }) => ({
            where: (id: unknown) => ({
              run: () => updates.push({ id, slot: slot_number }),
            }),
          }),
        }),
      };
      // eq(samples.voice_number, n) is mocked: track the voice by call order
      vi.mocked(eq).mockImplementation(((column: unknown, value: unknown) => {
        if (column === "voice_number") voice = value as number;
        return value;
      }) as never);
      return { db, updates };
    }

    it("renumbers each voice that lost samples, on the caller's handle", () => {
      const { db, updates } = reindexDb({
        1: [
          { id: 10, slot_number: 0, voice_number: 1 } as Sample,
          { id: 11, slot_number: 2, voice_number: 1 } as Sample,
          { id: 12, slot_number: 5, voice_number: 1 } as Sample,
        ],
        2: [],
      });

      const result = performVoiceReindexing(db as never, testKitName, [
        { id: 1, slot_number: 1, voice_number: 1 } as Sample,
        { id: 2, slot_number: 3, voice_number: 1 } as Sample,
        { id: 3, slot_number: 0, voice_number: 2 } as Sample,
      ]);

      expect(result.map((s) => [s.id, s.slot_number])).toEqual([
        [10, 0],
        [11, 1],
        [12, 2],
      ]);
      // Samples already in place aren't written
      expect(updates).toEqual([
        { id: 11, slot: 1 },
        { id: 12, slot: 2 },
      ]);
      expect(vi.mocked(withDb)).not.toHaveBeenCalled();
    });

    it("should handle empty deletion list", () => {
      const { db } = reindexDb({});
      expect(performVoiceReindexing(db as never, testKitName, [])).toEqual([]);
    });

    it("lets a failed update throw, so the caller's transaction rolls back", () => {
      const { db } = reindexDb({
        1: [{ id: 11, slot_number: 2, voice_number: 1 } as Sample],
      });
      db.update = () => {
        throw new Error("Database error");
      };

      expect(() =>
        performVoiceReindexing(db as never, testKitName, [
          { id: 1, slot_number: 1, voice_number: 1 } as Sample,
        ]),
      ).toThrow("Database error");
    });
  });
});
