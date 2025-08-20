import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { withDb } from "../../utils/dbUtilities.js";
import { getFavoriteKits, getFavoriteKitsCount } from "../crudOperations.js";

describe("Favorite Kits Operations - Unit Tests", () => {
  const mockDbDir = "/test/db";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFavoriteKits", () => {
    test("should return empty array when no favorite kits exist", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
          }),
        }),
      });

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

      const result = getFavoriteKits(mockDbDir);

      expect(result).toEqual([]);
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

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue(mockKits),
          }),
        }),
      });

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

      const result = getFavoriteKits(mockDbDir);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        bank: null,
        bank_letter: "A",
        bpm: 120,
        editable: false,
        is_favorite: true,
        name: "A0",
        samples: [],
        voices: [],
      });
      expect(result[1]).toEqual({
        bank: null,
        bank_letter: "B",
        bpm: 140,
        editable: true,
        is_favorite: true,
        name: "B1",
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

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

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
      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                all: vi.fn().mockReturnValue([]),
              }),
            }),
          }),
        };
        return fn(mockDb);
      });

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

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result).toBe(0);
    });

    test("should return correct count of favorite kits", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: 5 }),
          }),
        }),
      });

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result).toBe(5);
    });

    test("should handle null result gracefully", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(null),
          }),
        }),
      });

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result).toBe(0);
    });

    test("should handle undefined count gracefully", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: undefined }),
          }),
        }),
      });

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

      const result = getFavoriteKitsCount(mockDbDir);

      expect(result).toBe(0);
    });

    test("should use count function in select", () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({ count: 3 }),
          }),
        }),
      });

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

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

      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: mockSelect,
        };
        return fn(mockDb);
      });

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
      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockReturnValue({ count: 1 }),
              }),
            }),
          }),
        };
        return fn(mockDb);
      });

      getFavoriteKitsCount(mockDbDir);

      expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
    });
  });
});
