import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchKits, searchKitsMultiTerm } from "../searchOperations";

// Mock the database utilities
vi.mock("../utils/dbUtilities", () => ({
  withDb: vi.fn((dbDir: string, callback: (db: unknown) => unknown) => {
    // Return error for invalid paths
    if (dbDir.includes("/invalid/path") || dbDir.includes("/nonexistent")) {
      return { error: "Database not found", success: false };
    }
    try {
      const mockDb = {
        all: vi.fn(() => []),
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      const result = callback(mockDb);
      return { data: result, success: true };
    } catch {
      return { error: "Database error", success: false };
    }
  }),
}));

describe("searchOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchKits", () => {
    describe("basic functionality", () => {
      it("should return success for valid database paths", () => {
        const result = searchKits("/test/db", { query: "" });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBeDefined();
        }
      });

      it("should handle non-existent database directory", () => {
        const result = searchKits("/nonexistent", { query: "test" });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("searchKitsMultiTerm", () => {
    describe("multi-term matching", () => {
      it("should handle multi-term queries", () => {
        // Testing that the function exists and can be called
        const result = searchKitsMultiTerm("/test/db", {
          query: "electronic dance",
        });
        expect(typeof result).toBe("object");
        expect(result).toHaveProperty("success");
      });
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", () => {
      const result = searchKits("/invalid/path", { query: "test" });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
    });
  });
});
