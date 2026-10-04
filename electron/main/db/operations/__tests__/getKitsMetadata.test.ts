import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { type RomperDb, withDb } from "../../utils/dbUtilities.js";
import { getKitsMetadata } from "../kitCrudOperations.js";

/** Runs the operation on a mock db and wraps the result as withDb does */
function mockWithDb(mockDb: Record<string, Mock>) {
  vi.mocked(withDb).mockImplementation((_dbDir, fn) => ({
    data: fn(mockDb as unknown as RomperDb),
    success: true,
  }));
}

describe("getKitsMetadata - Unit Tests", () => {
  const mockDbDir = "/test/db";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return empty array when no kits exist", () => {
    mockWithDb({
      all: vi.fn().mockReturnValue([]),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result.data).toEqual([]);
    expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
  });

  test("should return kit metadata with bank information", () => {
    const mockKitData = [
      {
        alias: "Test Kit",

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

    mockWithDb({
      all: vi.fn().mockReturnValue(mockKitData),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result.data).toEqual(mockKitData);
  });

  test("should return kit metadata without bank when no bank data exists", () => {
    const mockKitData = [
      {
        alias: "Test Kit",

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

    mockWithDb({
      all: vi.fn().mockReturnValue(mockKitData),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result.data).toEqual(mockKitData);
  });

  test("should return multiple kits efficiently", () => {
    const mockKitData = [
      {
        alias: "Kit 1",

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
    mockWithDb({
      all: allMock,
      from: fromMock,
      select: selectMock,
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result.data).toEqual(mockKitData);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0].name).toBe("A0");
    expect(result.data?.[0].bank_letter).toBe("A");
    expect(result.data?.[1].name).toBe("B1");
    expect(result.data?.[1].bank_letter).toBe("B");

    // Verify single query was made with explicit column selection to avoid circular references
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledWith({
      alias: expect.anything(),

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
    mockWithDb({
      all: vi.fn().mockReturnValue([]),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    });

    getKitsMetadata(mockDbDir);

    expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
  });

  test("should use Drizzle select API with explicit column selection", () => {
    const selectMock = vi.fn().mockReturnThis();
    const fromMock = vi.fn().mockReturnThis();
    const allMock = vi.fn().mockReturnValue([]);
    mockWithDb({
      all: allMock,
      from: fromMock,
      select: selectMock,
    });

    getKitsMetadata(mockDbDir);

    // Verify the query uses explicit column selection to avoid circular references
    expect(selectMock).toHaveBeenCalledWith({
      alias: expect.anything(),

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

    mockWithDb({
      all: vi.fn().mockReturnValue(mockKitData),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    });

    const result = getKitsMetadata(mockDbDir);

    expect(result.data).toEqual(mockKitData);
    // Verify bank_letter is included but no bank relation object
    expect(result.data?.[0].bank_letter).toBe("A");
    expect(result.data?.[0]).not.toHaveProperty("bank");
  });
});
