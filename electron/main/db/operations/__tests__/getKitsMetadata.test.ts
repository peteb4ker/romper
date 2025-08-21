import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { withDb } from "../../utils/dbUtilities.js";
import { getKitsMetadata } from "../crudOperations.js";

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
        artist: "Test Artist",
        bank: {
          artist: "Bank Artist",
          letter: "A",
          rtf_filename: "BankA.rtf",
          scanned_at: new Date("2023-01-01"),
        },
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
        artist: "Test Artist",
        bank: null,
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
        bank_letter: "A",
        bpm: 120,
        created_at: "2023-01-01T00:00:00.000Z",
        editable: true,
        is_favorite: true,
        name: "A0",
        step_pattern: [[1, 0, 1, 0]],
        updated_at: "2023-01-01T00:00:00.000Z",
      },
      {
        alias: "Kit 2",
        bank_letter: "B",
        bpm: 140,
        created_at: "2023-01-02T00:00:00.000Z",
        editable: false,
        is_favorite: false,
        name: "B1",
        step_pattern: null,
        updated_at: "2023-01-02T00:00:00.000Z",
      },
    ];

    const findManyMock = vi.fn().mockReturnValue(mockKitData);
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: findManyMock,
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
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
    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith();
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

  test("should use Drizzle query API with explicit column selection", () => {
    const findManyMock = vi.fn().mockReturnValue([]);
    const selectMock = vi.fn().mockReturnThis();
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        all: findManyMock,
        from: vi.fn().mockReturnThis(),
        select: selectMock,
      };
      return fn(mockDb);
    });

    getKitsMetadata(mockDbDir);

    // Verify the query uses explicit column selection to avoid circular references
    expect(selectMock).toHaveBeenCalledWith({
      alias: expect.any(Object),
      bank_letter: expect.any(Object),
      bpm: expect.any(Object),
      editable: expect.any(Object),
      is_favorite: expect.any(Object),
      locked: expect.any(Object),
      modified_since_sync: expect.any(Object),
      name: expect.any(Object),
      step_pattern: expect.any(Object),
    });
    expect(findManyMock).toHaveBeenCalledWith();
  });

  test("should return only selected columns without relations", () => {
    const mockKitData = [
      {
        alias: "Test Kit",
        bank_letter: "A",
        bpm: 120,
        created_at: "2023-01-01T00:00:00.000Z",
        editable: true,
        is_favorite: false,
        name: "A0",
        step_pattern: null,
        updated_at: "2023-01-01T00:00:00.000Z",
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
