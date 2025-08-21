import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import { withDb } from "../../utils/dbUtilities.js";
import {
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
} from "../crudOperations.js";

describe("Kit Sync Status Operations - Unit Tests", () => {
  const mockDbDir = "/test/db";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("markKitAsModified", () => {
    test("should mark single kit as modified", () => {
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
          update: mockUpdate,
        };
        return fn(mockDb);
      });

      markKitAsModified(mockDbDir, "A0");

      expect(mockSet).toHaveBeenCalledWith({
        modified_since_sync: true,
      });
      expect(mockRun).toHaveBeenCalled();
    });

    test("should call withDb with correct parameters", () => {
      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
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

      markKitAsModified(mockDbDir, "A0");

      expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
    });

    test("should handle database errors gracefully", () => {
      vi.mocked(withDb).mockReturnValue({
        error: "Database connection failed",
        success: false,
      });

      const result = markKitAsModified(mockDbDir, "A0");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    test("should not add updated_at field (not in schema)", () => {
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
          update: mockUpdate,
        };
        return fn(mockDb);
      });

      markKitAsModified(mockDbDir, "A0");

      const callArgs = mockSet.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("updated_at");
      expect(callArgs.modified_since_sync).toBe(true);
    });
  });

  describe("markKitAsSynced", () => {
    test("should mark single kit as synced", () => {
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
          update: mockUpdate,
        };
        return fn(mockDb);
      });

      markKitAsSynced(mockDbDir, "A0");

      expect(mockSet).toHaveBeenCalledWith({
        modified_since_sync: false,
      });
      expect(mockRun).toHaveBeenCalled();
    });

    test("should call withDb with correct parameters", () => {
      vi.mocked(withDb).mockImplementation((dbDir, fn) => {
        const mockDb = {
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

      markKitAsSynced(mockDbDir, "A0");

      expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));
    });

    test("should handle database errors gracefully", () => {
      vi.mocked(withDb).mockReturnValue({
        error: "Database connection failed",
        success: false,
      });

      const result = markKitAsSynced(mockDbDir, "A0");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });
  });

  describe("markKitsAsSynced", () => {
    test("should mark multiple kits as synced", () => {
      const mockResult = { changes: 2 };
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

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

      const kitNames = ["A0", "A1"];
      markKitsAsSynced(mockDbDir, kitNames);

      expect(mockSet).toHaveBeenCalledWith({
        modified_since_sync: false,
      });
      expect(mockRun).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[markKitsAsSynced] Attempting to mark 2 kits as synced:",
        kitNames,
      );

      mockConsoleLog.mockRestore();
    });

    test("should warn when expected changes don't match actual changes", () => {
      const mockResult = { changes: 1 };
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const mockConsoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

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

      const kitNames = ["A0", "A1"];
      markKitsAsSynced(mockDbDir, kitNames);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "[markKitsAsSynced] Expected to update 2 kits but updated 1",
      );

      mockConsoleLog.mockRestore();
      mockConsoleWarn.mockRestore();
    });

    test("should handle database errors with logging", () => {
      const mockError = new Error("Database update failed");
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const mockConsoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const mockRun = vi.fn().mockImplementation(() => {
        throw mockError;
      });
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

      expect(() => markKitsAsSynced(mockDbDir, ["A0", "A1"])).toThrow(
        "Database update failed",
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[markKitsAsSynced] Failed to update kits:",
        mockError,
      );

      mockConsoleLog.mockRestore();
      mockConsoleError.mockRestore();
    });

    test("should handle empty kit names array", () => {
      const mockResult = { changes: 0 };
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

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

      markKitsAsSynced(mockDbDir, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[markKitsAsSynced] Attempting to mark 0 kits as synced:",
        [],
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[markKitsAsSynced] Successfully updated 0/0 kits",
      );

      mockConsoleLog.mockRestore();
    });

    test("should call withDb with correct parameters", () => {
      const mockResult = { changes: 1 };
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

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

      markKitsAsSynced(mockDbDir, ["A0"]);

      expect(withDb).toHaveBeenCalledWith(mockDbDir, expect.any(Function));

      mockConsoleLog.mockRestore();
    });

    test("should handle withDb errors gracefully", () => {
      vi.mocked(withDb).mockReturnValue({
        error: "Database connection failed",
        success: false,
      });

      const result = markKitsAsSynced(mockDbDir, ["A0", "A1"]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });
  });
});
