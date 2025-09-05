import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { withDb } from "../../utils/dbUtilities.js";
import { getKitsMetadata } from "../kitCrudOperations.js";

describe("getKitsMetadata - Unit Tests", () => {
  const mockDbDir = "/test/db";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return empty array when no kits exist", () => {
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: vi.fn().mockReturnValue([]),
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      };
      return fn(mockDb);
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result).toEqual([]);
    expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
  });

  test("should return kit metadata with bank information", () => {
    const mockKitData = [
      {
        alias: "Test Kit",
        artist: null,
        bank_letter: "A",
        bpm: 120,
        editable: true,
        is_favorite: false,
        locked: false,
        modified_since_sync: false,
        name: "A0",
        step_pattern: null,
      },
    ];

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: vi.fn().mockReturnValue(mockKitData),
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      };
      return fn(mockDb);
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result).toEqual(mockKitData);
  });

  test("should return kit metadata without bank when no bank data exists", () => {
    const mockKitData = [
      {
        alias: "Test Kit",
        artist: null,
        bank_letter: null,
        bpm: 120,
        editable: true,
        is_favorite: false,
        locked: false,
        modified_since_sync: false,
        name: "A0",
        step_pattern: null,
      },
    ];

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: vi.fn().mockReturnValue(mockKitData),
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      };
      return fn(mockDb);
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result).toEqual(mockKitData);
  });

  test("should return multiple kits efficiently", () => {
    const mockKitData = [
      {
        alias: "Kit 1",
        artist: null,
        bank_letter: "A",
        bpm: 120,
        editable: true,
        is_favorite: true,
        locked: false,
        modified_since_sync: false,
        name: "A0",
        step_pattern: [[1, 0, 1, 0]],
      },
      {
        alias: "Kit 2",
        artist: null,
        bank_letter: "B",
        bpm: 140,
        editable: false,
        is_favorite: false,
        locked: false,
        modified_since_sync: false,
        name: "B1",
        step_pattern: null,
      },
    ];

    const selectMock = vi.fn().mockReturnThis();
    const fromMock = vi.fn().mockReturnThis();
    const allMock = vi.fn().mockReturnValue(mockKitData);
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: allMock,
        from: fromMock,
        select: selectMock,
      };
      return fn(mockDb);
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result).toEqual(mockKitData);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A0");
    expect(result[0].bank_letter).toBe("A");
    expect(result[1].name).toBe("B1");
    expect(result[1].bank_letter).toBe("B");

    // Verify single query was made with explicit column selection to avoid circular references
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledWith({
      alias: expect.anything(),
      artist: expect.anything(),
      bank_letter: expect.anything(),
      bpm: expect.anything(),
      editable: expect.anything(),
      is_favorite: expect.anything(),
      locked: expect.anything(),
      modified_since_sync: expect.anything(),
      name: expect.anything(),
      step_pattern: expect.anything(),
      // Note: created_at and updated_at columns do not exist in the current schema
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(allMock).toHaveBeenCalledTimes(1);
  });

  test("should handle database errors gracefully", () => {
    vi.mocked(withDb).mockReturnValue({
      error: "Database connection failed",
      success: false,
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
  });

  test("should call withDb with correct parameters", () => {
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: vi.fn().mockReturnValue([]),
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      };
      return fn(mockDb);
    });

    getKitsMetadata(mockDbDir);

    expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
  });

  test("should use Drizzle select API with explicit column selection", () => {
    const selectMock = vi.fn().mockReturnThis();
    const fromMock = vi.fn().mockReturnThis();
    const allMock = vi.fn().mockReturnValue([]);
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: allMock,
        from: fromMock,
        select: selectMock,
      };
      return fn(mockDb);
    });

    getKitsMetadata(mockDbDir);

    // Verify the query uses explicit column selection to avoid circular references
    expect(selectMock).toHaveBeenCalledWith({
      alias: expect.anything(),
      artist: expect.anything(),
      bank_letter: expect.anything(),
      bpm: expect.anything(),
      editable: expect.anything(),
      is_favorite: expect.anything(),
      locked: expect.anything(),
      modified_since_sync: expect.anything(),
      name: expect.anything(),
      step_pattern: expect.anything(),
      // Note: created_at and updated_at columns do not exist in the current schema
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(allMock).toHaveBeenCalledTimes(1);
  });

  test("should return only selected columns without relations", () => {
    const mockKitData = [
      {
        alias: "Test Kit",
        artist: null,
        bank_letter: "A",
        bpm: 120,
        editable: true,
        is_favorite: false,
        locked: false,
        modified_since_sync: false,
        name: "A0",
        step_pattern: null,
      },
    ];

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: vi.fn().mockReturnValue(mockKitData),
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      };
      return fn(mockDb);
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result).toEqual(mockKitData);
    // Verify bank_letter is included but no bank relation object
    expect(result[0].bank_letter).toBe("A");
    expect(result[0]).not.toHaveProperty("bank");
  });
});
