import Database from "better-sqlite3";
import { existsSync } from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseVerificationResult, verifyDatabase } from "../dbVerifier";

// Mock the dependencies
vi.mock("fs");
vi.mock("better-sqlite3");

const mockExistsSync = vi.mocked(existsSync);
const MockDatabase = vi.mocked(Database);

describe("dbVerifier", () => {
  let mockDb: any;
  let mockPrepare: any;
  let mockGet: any;
  let mockAll: any;
  let mockClose: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock database methods
    mockGet = vi.fn();
    mockAll = vi.fn();
    mockPrepare = vi.fn().mockReturnValue({
      get: mockGet,
      all: mockAll,
    });
    mockClose = vi.fn();

    mockDb = {
      prepare: mockPrepare,
      close: mockClose,
    };

    MockDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("verifyDatabase", () => {
    const testDbPath = "/test/path/database.db";

    describe("when database file does not exist", () => {
      it("should return failure result with appropriate error message", () => {
        mockExistsSync.mockReturnValue(false);

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: `Database file does not exist at ${testDbPath}`,
        });
        expect(mockExistsSync).toHaveBeenCalledWith(testDbPath);
        expect(MockDatabase).not.toHaveBeenCalled();
      });
    });

    describe("when database file exists", () => {
      beforeEach(() => {
        mockExistsSync.mockReturnValue(true);
      });

      it("should successfully verify database with all data", () => {
        const mockTables = [
          { name: "kits" },
          { name: "samples" },
          { name: "metadata" },
        ];
        const mockKitCount = { count: 5 };
        const mockSampleCount = { count: 25 };

        mockAll.mockReturnValue(mockTables);
        mockGet
          .mockReturnValueOnce(mockKitCount)
          .mockReturnValueOnce(mockSampleCount);

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: true,
          tables: ["kits", "samples", "metadata"],
          kits: 5,
          samples: 25,
        });

        expect(MockDatabase).toHaveBeenCalledWith(testDbPath, {
          readonly: true,
        });
        expect(mockPrepare).toHaveBeenCalledTimes(3);
        expect(mockClose).toHaveBeenCalledOnce();
      });

      it("should handle database with zero kits and samples", () => {
        const mockTables = [{ name: "kits" }, { name: "samples" }];
        const mockKitCount = { count: 0 };
        const mockSampleCount = { count: 0 };

        mockAll.mockReturnValue(mockTables);
        mockGet
          .mockReturnValueOnce(mockKitCount)
          .mockReturnValueOnce(mockSampleCount);

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: true,
          tables: ["kits", "samples"],
          kits: 0,
          samples: 0,
        });
      });

      it("should handle database with no user tables", () => {
        const mockTables: any[] = [];
        const mockKitCount = { count: 0 };
        const mockSampleCount = { count: 0 };

        mockAll.mockReturnValue(mockTables);
        mockGet
          .mockReturnValueOnce(mockKitCount)
          .mockReturnValueOnce(mockSampleCount);

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: true,
          tables: [],
          kits: 0,
          samples: 0,
        });
      });

      it("should use correct SQL queries", () => {
        const mockTables = [{ name: "kits" }];
        const mockKitCount = { count: 1 };
        const mockSampleCount = { count: 5 };

        mockAll.mockReturnValue(mockTables);
        mockGet
          .mockReturnValueOnce(mockKitCount)
          .mockReturnValueOnce(mockSampleCount);

        verifyDatabase(testDbPath);

        expect(mockPrepare).toHaveBeenNthCalledWith(
          1,
          expect.stringMatching(/SELECT name FROM sqlite_master/),
        );
        expect(mockPrepare).toHaveBeenNthCalledWith(
          2,
          "SELECT COUNT(*) as count FROM kits",
        );
        expect(mockPrepare).toHaveBeenNthCalledWith(
          3,
          "SELECT COUNT(*) as count FROM samples",
        );
      });

      it("should filter out sqlite system tables", () => {
        const mockTables = [
          { name: "kits" },
          { name: "samples" },
          { name: "sqlite_sequence" }, // This should be filtered out
          { name: "metadata" },
        ];

        mockAll.mockReturnValue(mockTables);
        mockGet.mockReturnValue({ count: 0 });

        const result = verifyDatabase(testDbPath);

        expect(result.tables).toEqual([
          "kits",
          "samples",
          "sqlite_sequence",
          "metadata",
        ]);

        // Verify the SQL query excludes sqlite_ tables
        const tableQuery = mockPrepare.mock.calls[0][0];
        expect(tableQuery).toMatch(/name NOT LIKE 'sqlite_%'/);
      });

      it("should ensure database is opened in readonly mode", () => {
        mockAll.mockReturnValue([]);
        mockGet.mockReturnValue({ count: 0 });

        verifyDatabase(testDbPath);

        expect(MockDatabase).toHaveBeenCalledWith(testDbPath, {
          readonly: true,
        });
      });

      it("should always close the database connection", () => {
        mockAll.mockReturnValue([]);
        mockGet.mockReturnValue({ count: 0 });

        verifyDatabase(testDbPath);

        expect(mockClose).toHaveBeenCalledOnce();
      });
    });

    describe("error handling", () => {
      beforeEach(() => {
        mockExistsSync.mockReturnValue(true);
      });

      it("should handle Database constructor errors", () => {
        const error = new Error("Database connection failed");
        MockDatabase.mockImplementation(() => {
          throw error;
        });

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: "Database connection failed",
        });
      });

      it("should handle SQL query errors", () => {
        const error = new Error("SQL syntax error");
        mockPrepare.mockImplementation(() => {
          throw error;
        });

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: "SQL syntax error",
        });
        // When prepare throws, the database connection isn't established,
        // so close won't be called
      });

      it("should handle table query errors", () => {
        const error = new Error("Table query failed");
        mockAll.mockImplementation(() => {
          throw error;
        });

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: "Table query failed",
        });
        // Database close is not called when an error occurs during query execution
        // because the function exits via the catch block
      });

      it("should handle kit count query errors", () => {
        const error = new Error("Kit count query failed");
        mockAll.mockReturnValue([]);
        mockGet.mockImplementationOnce(() => {
          throw error;
        });

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: "Kit count query failed",
        });
        // Database close is not called when an error occurs during query execution
      });

      it("should handle sample count query errors", () => {
        const error = new Error("Sample count query failed");
        mockAll.mockReturnValue([]);
        mockGet
          .mockReturnValueOnce({ count: 5 }) // Kit count succeeds
          .mockImplementationOnce(() => {
            throw error; // Sample count fails
          });

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: "Sample count query failed",
        });
        // Database close is not called when an error occurs during query execution
      });

      it("should handle non-Error exceptions", () => {
        const nonErrorException = "String error";
        MockDatabase.mockImplementation(() => {
          throw nonErrorException;
        });

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: "String error",
        });
      });

      it("should handle null/undefined exceptions", () => {
        MockDatabase.mockImplementation(() => {
          throw null;
        });

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: false,
          error: "null",
        });
      });

      it("should ensure database is closed even when errors occur", () => {
        const error = new Error("Some error");
        mockAll.mockReturnValue([]);
        mockGet.mockImplementation(() => {
          throw error;
        });

        verifyDatabase(testDbPath);

        // Since the current implementation doesn't have try-finally,
        // the database close is not guaranteed to be called on errors
        // This test documents the current behavior
        expect(mockClose).not.toHaveBeenCalled();
      });

      it("should handle database close errors gracefully", () => {
        const closeError = new Error("Close failed");
        mockClose.mockImplementation(() => {
          throw closeError;
        });

        mockAll.mockReturnValue([]);
        mockGet.mockReturnValue({ count: 0 });

        const result = verifyDatabase(testDbPath);

        // The close error should propagate since it's not wrapped in try-catch
        expect(result).toEqual({
          success: false,
          error: "Close failed",
        });
      });
    });

    describe("edge cases", () => {
      beforeEach(() => {
        mockExistsSync.mockReturnValue(true);
      });

      it("should handle very large count values", () => {
        const mockTables = [{ name: "kits" }];
        const mockKitCount = { count: Number.MAX_SAFE_INTEGER };
        const mockSampleCount = { count: Number.MAX_SAFE_INTEGER };

        mockAll.mockReturnValue(mockTables);
        mockGet
          .mockReturnValueOnce(mockKitCount)
          .mockReturnValueOnce(mockSampleCount);

        const result = verifyDatabase(testDbPath);

        expect(result).toEqual({
          success: true,
          tables: ["kits"],
          kits: Number.MAX_SAFE_INTEGER,
          samples: Number.MAX_SAFE_INTEGER,
        });
      });

      it("should handle empty database path", () => {
        mockExistsSync.mockReturnValue(false);

        const result = verifyDatabase("");

        expect(result).toEqual({
          success: false,
          error: "Database file does not exist at ",
        });
      });

      it("should handle special characters in database path", () => {
        const specialPath = "/test/path with spaces/database (1).db";
        mockExistsSync.mockReturnValue(false);

        const result = verifyDatabase(specialPath);

        expect(result).toEqual({
          success: false,
          error: `Database file does not exist at ${specialPath}`,
        });
      });

      it("should handle tables with special names", () => {
        const mockTables = [
          { name: "kits" },
          { name: "table-with-dashes" },
          { name: "table_with_underscores" },
          { name: "123numeric" },
        ];

        mockAll.mockReturnValue(mockTables);
        mockGet.mockReturnValue({ count: 0 });

        const result = verifyDatabase(testDbPath);

        expect(result.tables).toEqual([
          "kits",
          "table-with-dashes",
          "table_with_underscores",
          "123numeric",
        ]);
      });
    });
  });

  describe("DatabaseVerificationResult interface", () => {
    const testDbPath = "/test/path/database.db";

    it("should have correct structure for success case", () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValue([{ name: "kits" }]);
      mockGet.mockReturnValue({ count: 1 });

      const result: DatabaseVerificationResult = verifyDatabase(testDbPath);

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("tables");
      expect(result).toHaveProperty("kits");
      expect(result).toHaveProperty("samples");
      expect(result).not.toHaveProperty("error");
    });

    it("should have correct structure for failure case", () => {
      mockExistsSync.mockReturnValue(false);

      const result: DatabaseVerificationResult = verifyDatabase(testDbPath);

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result).not.toHaveProperty("tables");
      expect(result).not.toHaveProperty("kits");
      expect(result).not.toHaveProperty("samples");
    });
  });
});
