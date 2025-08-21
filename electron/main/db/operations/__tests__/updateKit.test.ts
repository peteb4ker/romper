import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { withDb } from "../../utils/dbUtilities.js";
import { updateKit } from "../crudOperations.js";

describe("updateKit - Unit Tests", () => {
  const mockDbDir = "/test/db";
  const mockKitName = "A0";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should update kit with single field", () => {
    const mockResult = { changes: 1 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const updates = { bpm: 120 };
    updateKit(mockDbDir, mockKitName, updates);

    expect(mockSet).toHaveBeenCalledWith({
      bpm: 120,
    });
    expect(mockRun).toHaveBeenCalled();
  });

  test("should update kit with multiple fields", () => {
    const mockResult = { changes: 1 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const updates = {
      bpm: 140,
      description: "Updated description",
      editable: true,
      is_favorite: false,
    };

    updateKit(mockDbDir, mockKitName, updates);

    expect(mockSet).toHaveBeenCalledWith({
      bpm: 140,
      description: "Updated description",
      editable: true,
      is_favorite: false,
    });
  });

  test("should update kit step pattern", () => {
    const mockResult = { changes: 1 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const stepPattern = [
      [1, 0, 1, 0],
      [0, 1, 0, 1],
    ];
    const updates = { step_pattern: stepPattern };

    updateKit(mockDbDir, mockKitName, updates);

    expect(mockSet).toHaveBeenCalledWith({
      step_pattern: stepPattern,
    });
  });

  test("should clear step pattern with null", () => {
    const mockResult = { changes: 1 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const updates = { step_pattern: null };

    updateKit(mockDbDir, mockKitName, updates);

    expect(mockSet).toHaveBeenCalledWith({
      step_pattern: null,
    });
  });

  test("should throw error when kit not found", () => {
    const mockResult = { changes: 0 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    expect(() => updateKit(mockDbDir, "NonExistent", { bpm: 120 })).toThrow(
      "Kit 'NonExistent' not found",
    );
  });

  test("should handle bank_letter update", () => {
    const mockResult = { changes: 1 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const updates = { bank_letter: "B" };

    updateKit(mockDbDir, mockKitName, updates);

    expect(mockSet).toHaveBeenCalledWith({
      bank_letter: "B",
    });
  });

  test("should handle kit name change", () => {
    const mockResult = { changes: 1 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    const updates = { name: "A1" };

    updateKit(mockDbDir, mockKitName, updates);

    expect(mockSet).toHaveBeenCalledWith({
      name: "A1",
    });
  });

  test("should handle database errors gracefully", () => {
    vi.mocked(withDb).mockReturnValue({
      error: "Database connection failed",
      success: false,
    });

    const result = updateKit(mockDbDir, mockKitName, { bpm: 120 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
  });

  test("should call withDb with correct parameters", () => {
    const mockResult = { changes: 1 };

    vi.mocked(withDb).mockImplementation((dbDir, fn) => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              run: vi.fn().mockReturnValue(mockResult),
            }),
          }),
        }),
      };
      return fn(mockDb);
    });

    updateKit(mockDbDir, mockKitName, { bpm: 120 });

    expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
  });

  test("should not add updated_at field (not in schema)", () => {
    const mockResult = { changes: 1 };

    const mockRun = vi.fn().mockReturnValue(mockResult);
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
        update: mockUpdate,
      };
      return fn(mockDb);
    });

    updateKit(mockDbDir, mockKitName, { bpm: 120 });

    const callArgs = mockSet.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("updated_at");
    expect(callArgs.bpm).toBe(120);
  });
});
