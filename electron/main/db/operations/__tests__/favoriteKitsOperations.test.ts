import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { type RomperDb, withDb } from "../../utils/dbUtilities.js";
import { getFavoriteKits, getFavoriteKitsCount } from "../crudOperations.js";
import { createBatchQueryMock, createSingleQueryMock } from "./testUtils.js";

/** Runs the operation's query on a mock db and wraps it as withDb does */
function mockWithDb(select: Mock) {
  vi.mocked(withDb).mockImplementation((_dbDir, fn) => ({
    data: fn({ select } as unknown as RomperDb),
    success: true,
  }));
}

describe("Favorite Kits Operations - Unit Tests", () => {
  const mockDbDir = "/test/db";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFavoriteKits", () => {
    test("should return empty array when no favorite kits exist", () => {
      const mockSelect = createSingleQueryMock([]);
      mockWithDb(mockSelect);

      const result = getFavoriteKits(mockDbDir);

      expect(result.data).toEqual([]);
      expect(mockSelect).toHaveBeenCalled();
    });

    test("should return favorite kits with null relations", () => {
      const mockKits = [
        {
          bank_letter: "A",
          bpm: 120,
          editable: false,
          is_favorite: true,
          name: "A0",
        },
        {
          bank_letter: "B",
          bpm: 140,
          editable: true,
          is_favorite: true,
          name: "B1",
        },
      ];

      // Setup batch query mock: [favorite kits, all banks, voices, samples]
      const mockSelect = createBatchQueryMock([mockKits, [], [], []]);
      mockWithDb(mockSelect);

      const result = getFavoriteKits(mockDbDir);

      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toEqual({
        bank: null,
        bank_letter: "A",
        bpm: 120,
        editable: false,
        is_favorite: true,
        name: "A0",
        quarantined: false,
        samples: [],
        voices: [],
      });
      expect(result.data?.[1]).toEqual({
        bank: null,
        bank_letter: "B",
        bpm: 140,
        editable: true,
        is_favorite: true,
        name: "B1",
        quarantined: false,
        samples: [],
        voices: [],
      });
    });

    test("should filter only favorite kits", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
          }),
        }),
      });

      mockWithDb(mockSelect);

      getFavoriteKits(mockDbDir);

      // Verify that the where clause filters for favorite kits
      const fromCall = mockSelect().from();
      const whereCall = fromCall.where;
      expect(whereCall).toHaveBeenCalled();
    });

    test("should handle database errors gracefully", () => {
      vi.mocked(withDb).mockReturnValue({
        error: "Database connection failed",
        success: false,
      });

      const result = getFavoriteKits(mockDbDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    test("should call withDb with correct parameters", () => {
      const mockSelect = createSingleQueryMock([]);
      mockWithDb(mockSelect);

      getFavoriteKits(mockDbDir);

      expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
    });
  });

  describe("getFavoriteKitsCount", () => {
    test("should return 0 when no favorite kits exist", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: 0 }),
          }),
        }),
      });

      mockWithDb(mockSelect);

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result.data).toBe(0);
    });

    test("should return correct count of favorite kits", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: 5 }),
          }),
        }),
      });

      mockWithDb(mockSelect);

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result.data).toBe(5);
    });

    test("should handle null result gracefully", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(null),
          }),
        }),
      });

      mockWithDb(mockSelect);

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result.data).toBe(0);
    });

    test("should handle undefined count gracefully", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: undefined }),
          }),
        }),
      });

      mockWithDb(mockSelect);

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result.data).toBe(0);
    });

    test("should use count function in select", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: 3 }),
          }),
        }),
      });

      mockWithDb(mockSelect);

      getFavoriteKitsCount(mockDbDir);

      // Verify that select was called with count object (Drizzle SQL object)
      expect(mockSelect).toHaveBeenCalledWith({ count: expect.any(Object) });
    });

    test("should filter for favorite kits only", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: 2 }),
          }),
        }),
      });

      mockWithDb(mockSelect);

      getFavoriteKitsCount(mockDbDir);

      // Verify that the where clause filters for favorite kits
      const fromCall = mockSelect().from();
      const whereCall = fromCall.where;
      expect(whereCall).toHaveBeenCalled();
    });

    test("should handle database errors gracefully", () => {
      vi.mocked(withDb).mockReturnValue({
        error: "Database connection failed",
        success: false,
      });

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    test("should call withDb with correct parameters", () => {
      mockWithDb(
        vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockReturnValue({ count: 1 }),
            }),
          }),
        }),
      );

      getFavoriteKitsCount(mockDbDir);

      expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
    });
  });
});
