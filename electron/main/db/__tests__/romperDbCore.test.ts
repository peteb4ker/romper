import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import BetterSqlite3 from "better-sqlite3";

import {
  getDbPath,
  booleanToSqlite,
  isDbCorruptionError,
  getDbSchema,
  createDbConnection,
  setupDbSchema,
  ensureDbDirectory,
  forceCloseDbConnection,
  insertKitRecord,
  insertSampleRecord,
  DB_FILENAME,
  MAX_SLOT_NUMBER,
  MIN_SLOT_NUMBER,
  type KitRecord,
  type SampleRecord,
} from "../romperDbCore";

// Mock modules
vi.mock("fs");
vi.mock("better-sqlite3");

const mockFs = vi.mocked(fs);
const mockBetterSqlite3 = vi.mocked(BetterSqlite3);

describe("romperDbCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("utility functions", () => {
    describe("getDbPath", () => {
      it("constructs the correct database path", () => {
        const dbDir = "/test/dir";
        const result = getDbPath(dbDir);
        expect(result).toBe(path.join(dbDir, DB_FILENAME));
      });

      it("handles different directory separators", () => {
        const dbDir = "C:\\test\\dir";
        const result = getDbPath(dbDir);
        expect(result).toBe(path.join(dbDir, DB_FILENAME));
      });
    });

    describe("booleanToSqlite", () => {
      it("converts true to 1", () => {
        expect(booleanToSqlite(true)).toBe(1);
      });

      it("converts false to 0", () => {
        expect(booleanToSqlite(false)).toBe(0);
      });
    });

    describe("isDbCorruptionError", () => {
      it("detects 'file is not a database' error", () => {
        expect(isDbCorruptionError("file is not a database")).toBe(true);
      });

      it("detects 'file is encrypted' error", () => {
        expect(isDbCorruptionError("file is encrypted")).toBe(true);
      });

      it("detects 'malformed' error", () => {
        expect(isDbCorruptionError("malformed database")).toBe(true);
      });

      it("is case insensitive", () => {
        expect(isDbCorruptionError("FILE IS NOT A DATABASE")).toBe(true);
        expect(isDbCorruptionError("File Is Encrypted")).toBe(true);
        expect(isDbCorruptionError("MALFORMED")).toBe(true);
      });

      it("returns false for other errors", () => {
        expect(isDbCorruptionError("permission denied")).toBe(false);
        expect(isDbCorruptionError("disk full")).toBe(false);
        expect(isDbCorruptionError("")).toBe(false);
      });
    });

    describe("getDbSchema", () => {
      it("returns valid SQL schema", () => {
        const schema = getDbSchema();
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS kits");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS samples");
        expect(schema).toContain(`CHECK(slot_number BETWEEN ${MIN_SLOT_NUMBER} AND ${MAX_SLOT_NUMBER})`);
        expect(schema).toContain("FOREIGN KEY(kit_id) REFERENCES kits(id)");
      });

      it("includes all required kit columns", () => {
        const schema = getDbSchema();
        expect(schema).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
        expect(schema).toContain("name TEXT NOT NULL");
        expect(schema).toContain("alias TEXT");
        expect(schema).toContain("artist TEXT");
        expect(schema).toContain("plan_enabled BOOLEAN NOT NULL DEFAULT 0");
      });

      it("includes all required sample columns", () => {
        const schema = getDbSchema();
        expect(schema).toContain("kit_id INTEGER");
        expect(schema).toContain("filename TEXT NOT NULL");
        expect(schema).toContain("slot_number INTEGER NOT NULL");
        expect(schema).toContain("is_stereo BOOLEAN NOT NULL DEFAULT 0");
      });
    });
  });

  describe("database operations", () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        exec: vi.fn(),
        close: vi.fn(),
        prepare: vi.fn(),
      };
      mockBetterSqlite3.mockReturnValue(mockDb);
    });

    describe("createDbConnection", () => {
      it("creates a new database connection", () => {
        const dbPath = "/test/path/db.sqlite";
        const result = createDbConnection(dbPath);

        expect(mockBetterSqlite3).toHaveBeenCalledWith(dbPath);
        expect(result).toBe(mockDb);
      });
    });

    describe("setupDbSchema", () => {
      it("executes the database schema", () => {
        setupDbSchema(mockDb);

        expect(mockDb.exec).toHaveBeenCalledWith(getDbSchema());
      });
    });

    describe("ensureDbDirectory", () => {
      it("creates directory recursively", () => {
        const dbDir = "/test/dir";
        ensureDbDirectory(dbDir);

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(dbDir, { recursive: true });
      });
    });

    describe("forceCloseDbConnection", () => {
      it("creates and immediately closes a connection", async () => {
        const dbPath = "/test/path/db.sqlite";
        await forceCloseDbConnection(dbPath);

        expect(mockBetterSqlite3).toHaveBeenCalledWith(dbPath);
        expect(mockDb.close).toHaveBeenCalled();
      });

      it("ignores errors from closing connection", async () => {
        mockDb.close.mockImplementation(() => {
          throw new Error("Connection already closed");
        });

        const dbPath = "/test/path/db.sqlite";
        await expect(forceCloseDbConnection(dbPath)).resolves.not.toThrow();
      });

      it("ignores errors from creating connection", async () => {
        mockBetterSqlite3.mockImplementation(() => {
          throw new Error("Cannot create connection");
        });

        const dbPath = "/test/path/db.sqlite";
        await expect(forceCloseDbConnection(dbPath)).resolves.not.toThrow();
      });

      it("waits longer on Windows platform", async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
          value: 'win32'
        });

        const start = Date.now();
        await forceCloseDbConnection("/test/path/db.sqlite");
        const duration = Date.now() - start;

        // Should wait at least 200ms on Windows
        expect(duration).toBeGreaterThanOrEqual(200);

        // Restore original platform
        Object.defineProperty(process, 'platform', {
          value: originalPlatform
        });
      });
    });
  });

  describe("insertKitRecord", () => {
    let mockDb: any;
    let mockStmt: any;

    beforeEach(() => {
      mockStmt = {
        run: vi.fn().mockReturnValue({ lastInsertRowid: 123 }),
      };
      mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
        close: vi.fn(),
      };
      mockBetterSqlite3.mockReturnValue(mockDb);

      // Mock console methods to avoid noise in tests
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("inserts a kit record successfully", () => {
      const dbDir = "/test/dir";
      const kit: KitRecord = {
        name: "Test Kit",
        alias: "TK",
        artist: "Test Artist",
        plan_enabled: true,
      };

      const result = insertKitRecord(dbDir, kit);

      expect(result.success).toBe(true);
      expect(result.kitId).toBe(123);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "INSERT INTO kits (name, alias, artist, plan_enabled) VALUES (?, ?, ?, ?)",
      );
      expect(mockStmt.run).toHaveBeenCalledWith("Test Kit", "TK", "Test Artist", 1);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles optional fields as null", () => {
      const dbDir = "/test/dir";
      const kit: KitRecord = {
        name: "Minimal Kit",
        plan_enabled: false,
      };

      insertKitRecord(dbDir, kit);

      expect(mockStmt.run).toHaveBeenCalledWith("Minimal Kit", null, null, 0);
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      const kit: KitRecord = {
        name: "Test Kit",
        plan_enabled: true,
      };

      mockStmt.run.mockImplementation(() => {
        throw new Error("Database constraint violation");
      });

      const result = insertKitRecord(dbDir, kit);

      expect(result.success).toBe(false);
      expect(result.kitId).toBeUndefined();
      expect(result.error).toBe("Database constraint violation");
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles non-Error exceptions", () => {
      const dbDir = "/test/dir";
      const kit: KitRecord = {
        name: "Test Kit",
        plan_enabled: true,
      };

      mockStmt.run.mockImplementation(() => {
        throw "String error";
      });

      const result = insertKitRecord(dbDir, kit);

      expect(result.success).toBe(false);
      expect(result.error).toBe("String error");
    });
  });

  describe("insertSampleRecord", () => {
    let mockDb: any;
    let mockStmt: any;

    beforeEach(() => {
      mockStmt = {
        run: vi.fn().mockReturnValue({ lastInsertRowid: 456 }),
      };
      mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
        close: vi.fn(),
      };
      mockBetterSqlite3.mockReturnValue(mockDb);
    });

    it("inserts a sample record successfully", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_id: 123,
        filename: "kick.wav",
        slot_number: 1,
        is_stereo: true,
      };

      const result = insertSampleRecord(dbDir, sample);

      expect(result.success).toBe(true);
      expect(result.sampleId).toBe(456);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "INSERT INTO samples (kit_id, filename, slot_number, is_stereo) VALUES (?, ?, ?, ?)",
      );
      expect(mockStmt.run).toHaveBeenCalledWith(123, "kick.wav", 1, 1);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("converts boolean to sqlite format", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_id: 123,
        filename: "mono.wav",
        slot_number: 2,
        is_stereo: false,
      };

      insertSampleRecord(dbDir, sample);

      expect(mockStmt.run).toHaveBeenCalledWith(123, "mono.wav", 2, 0);
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_id: 999,
        filename: "invalid.wav",
        slot_number: 1,
        is_stereo: false,
      };

      mockStmt.run.mockImplementation(() => {
        throw new Error("FOREIGN KEY constraint failed");
      });

      const result = insertSampleRecord(dbDir, sample);

      expect(result.success).toBe(false);
      expect(result.sampleId).toBeUndefined();
      expect(result.error).toBe("FOREIGN KEY constraint failed");
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles non-Error exceptions", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_id: 123,
        filename: "test.wav",
        slot_number: 1,
        is_stereo: false,
      };

      mockStmt.run.mockImplementation(() => {
        throw { code: "CONSTRAINT_FAILED" };
      });

      const result = insertSampleRecord(dbDir, sample);

      expect(result.success).toBe(false);
      expect(result.error).toBe("[object Object]");
    });
  });

  describe("constants", () => {
    it("has correct database filename", () => {
      expect(DB_FILENAME).toBe("romper.sqlite");
    });

    it("has correct slot number constraints", () => {
      expect(MIN_SLOT_NUMBER).toBe(1);
      expect(MAX_SLOT_NUMBER).toBe(12);
    });
  });
});
