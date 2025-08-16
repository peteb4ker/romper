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
        query: {
          kits: {
            findMany: vi.fn().mockReturnValue([]),
          },
        },
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
        query: {
          kits: {
            findMany: vi.fn().mockReturnValue(mockKitData),
          },
        },
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
        query: {
          kits: {
            findMany: vi.fn().mockReturnValue(mockKitData),
          },
        },
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
        artist: "Artist 1",
        bank: {
          artist: "Bank Artist A",
          letter: "A",
          rtf_filename: "BankA.rtf",
          scanned_at: new Date("2023-01-01"),
        },
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
        artist: "Artist 2",
        bank: {
          artist: "Bank Artist B",
          letter: "B",
          rtf_filename: "BankB.rtf",
          scanned_at: new Date("2023-01-02"),
        },
        bank_letter: "B",
        bpm: 140,
        editable: false,
        is_favorite: false,
        locked: true,
        modified_since_sync: true,
        name: "B1",
        step_pattern: null,
      },
    ];

    const findManyMock = vi.fn().mockReturnValue(mockKitData);
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        query: {
          kits: {
            findMany: findManyMock,
          },
        },
      };
      return fn(mockDb);
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result).toEqual(mockKitData);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A0");
    expect(result[0].bank?.artist).toBe("Bank Artist A");
    expect(result[1].name).toBe("B1");
    expect(result[1].bank?.artist).toBe("Bank Artist B");

    // Verify single query was made with bank relation
    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      with: {
        bank: true,
      },
    });
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
        query: {
          kits: {
            findMany: vi.fn().mockReturnValue([]),
          },
        },
      };
      return fn(mockDb);
    });

    getKitsMetadata(mockDbDir);

    expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
  });

  test("should use Drizzle query API with bank relation", () => {
    const findManyMock = vi.fn().mockReturnValue([]);
    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        query: {
          kits: {
            findMany: findManyMock,
          },
        },
      };
      return fn(mockDb);
    });

    getKitsMetadata(mockDbDir);

    // Verify the query uses the correct relation
    expect(findManyMock).toHaveBeenCalledWith({
      with: {
        bank: true,
      },
    });
  });

  test("should handle empty bank relations correctly", () => {
    const mockKitData = [
      {
        alias: "Test Kit",
        artist: "Test Artist",
        bank: null, // No bank relation
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
        query: {
          kits: {
            findMany: vi.fn().mockReturnValue(mockKitData),
          },
        },
      };
      return fn(mockDb);
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result).toEqual(mockKitData);
    expect(result[0].bank).toBeNull();
  });
});
