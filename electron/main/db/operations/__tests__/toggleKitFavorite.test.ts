import type BetterSqlite3 from "better-sqlite3";

import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDbTransaction: vi.fn(),
}));

// The read and the write are one transaction (RE-28)
import { type RomperDb, withDbTransaction } from "../../utils/dbUtilities.js";
import { toggleKitFavorite } from "../kitCrudOperations.js";

/** Runs the operation on a mock db and wraps it as withDbTransaction does */
function mockTransaction(mockDb: { select: Mock; update?: Mock }) {
  vi.mocked(withDbTransaction).mockImplementation((_dbDir, fn) => ({
    data: fn(mockDb as unknown as RomperDb, {} as BetterSqlite3.Database),
    success: true,
  }));
}

describe("toggleKitFavorite - Unit Tests", () => {
  const mockDbDir = "/test/db";
  const mockKitName = "A0";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should toggle favorite status from false to true", () => {
    const mockKit = {
      bank_letter: "A",
      is_favorite: false,
      name: "A0",
    };

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(mockKit),
        }),
      }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn(),
        }),
      }),
    });

    mockTransaction({
      select: mockSelect,
      update: mockUpdate,
    });

    const result = toggleKitFavorite(mockDbDir, mockKitName);

    expect(result).toEqual({ data: { isFavorite: true }, success: true });
    expect(mockSelect).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  test("should toggle favorite status from true to false", () => {
    const mockKit = {
      bank_letter: "A",
      is_favorite: true,
      name: "A0",
    };

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(mockKit),
        }),
      }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn(),
        }),
      }),
    });

    mockTransaction({
      select: mockSelect,
      update: mockUpdate,
    });

    const result = toggleKitFavorite(mockDbDir, mockKitName);

    expect(result).toEqual({ data: { isFavorite: false }, success: true });
    expect(mockSelect).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  test("should throw error when kit not found", () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(null),
        }),
      }),
    });

    mockTransaction({
      select: mockSelect,
    });

    expect(() => toggleKitFavorite(mockDbDir, "NonExistent")).toThrow(
      "Kit 'NonExistent' not found",
    );
  });

  test("should update kit with new favorite status and timestamp", () => {
    const mockKit = {
      bank_letter: "A",
      is_favorite: false,
      name: "A0",
    };

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(mockKit),
        }),
      }),
    });

    const mockRun = vi.fn();
    const mockWhere = vi.fn().mockReturnValue({
      run: mockRun,
    });
    const mockSet = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockUpdate = vi.fn().mockReturnValue({
      set: mockSet,
    });

    mockTransaction({
      select: mockSelect,
      update: mockUpdate,
    });

    toggleKitFavorite(mockDbDir, mockKitName);

    expect(mockSet).toHaveBeenCalledWith({
      is_favorite: true,
    });
    expect(mockRun).toHaveBeenCalled();
  });

  test("should handle database errors gracefully", () => {
    vi.mocked(withDbTransaction).mockReturnValue({
      error: "Database connection failed",
      success: false,
    });

    const result = toggleKitFavorite(mockDbDir, mockKitName);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
  });

  test("should run in one transaction with correct parameters", () => {
    const mockKit = {
      is_favorite: false,
      name: "A0",
    };

    mockTransaction({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(mockKit),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn(),
          }),
        }),
      }),
    });

    toggleKitFavorite(mockDbDir, mockKitName);

    expect(withDbTransaction).toHaveBeenCalledWith(
      mockDbDir,
      expect.any(Function),
    );
  });
});
