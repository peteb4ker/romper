import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { withDb } from "../../utils/dbUtilities.js";
import { toggleKitFavorite } from "../crudOperations.js";

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

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        select: mockSelect,
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const result = toggleKitFavorite(mockDbDir, mockKitName);

    expect(result).toEqual({ isFavorite: true });
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

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        select: mockSelect,
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const result = toggleKitFavorite(mockDbDir, mockKitName);

    expect(result).toEqual({ isFavorite: false });
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

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        select: mockSelect,
      };
      return fn(mockDb);
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

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        select: mockSelect,
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    toggleKitFavorite(mockDbDir, mockKitName);

    expect(mockSet).toHaveBeenCalledWith({
      is_favorite: true,
    });
    expect(mockRun).toHaveBeenCalled();
  });

  test("should handle database errors gracefully", () => {
    vi.mocked(withDb).mockReturnValue({
      error: "Database connection failed",
      success: false,
    });

    const result = toggleKitFavorite(mockDbDir, mockKitName);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
  });

  test("should call withDb with correct parameters", () => {
    const mockKit = {
      is_favorite: false,
      name: "A0",
    };

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
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
      };
      return fn(mockDb);
    });

    toggleKitFavorite(mockDbDir, mockKitName);

    expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
  });
});
