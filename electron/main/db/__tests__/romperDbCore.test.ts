import BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  booleanToSqlite,
  createDbConnection,
  DB_FILENAME,
  decodeStepPatternFromBlob,
  encodeStepPatternToBlob,
  ensureDbDirectory,
  forceCloseDbConnection,
  getDbPath,
  getDbSchema,
  insertKitRecord,
  insertSampleRecord,
  isDbCorruptionError,
  type KitRecord,
  MAX_SLOT_NUMBER,
  MIN_SLOT_NUMBER,
  type SampleRecord,
  setupDbSchema,
  updateStepPattern,
  updateVoiceAlias,
  type VoiceRecord,
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
        expect(schema).toContain(
          `CHECK(slot_number BETWEEN ${MIN_SLOT_NUMBER} AND ${MAX_SLOT_NUMBER})`,
        );
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

    describe("step pattern encoding/decoding", () => {
      describe("encodeStepPatternToBlob", () => {
        it("encodes a 4-voice x 16-step pattern to 64-byte BLOB", () => {
          const stepPattern: number[][] = [
            [127, 0, 64, 0, 96, 0, 80, 0, 127, 0, 64, 0, 96, 0, 80, 0], // Voice 1
            [0, 127, 0, 96, 0, 80, 0, 64, 0, 127, 0, 96, 0, 80, 0, 64], // Voice 2
            [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80], // Voice 3
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Voice 4
          ];

          const blob = encodeStepPatternToBlob(stepPattern);

          expect(blob).toBeInstanceOf(Uint8Array);
          expect(blob?.length).toBe(64);

          // Check a few specific positions (step 0 for each voice)
          expect(blob?.[0]).toBe(127); // Step 0, Voice 0
          expect(blob?.[1]).toBe(0); // Step 0, Voice 1
          expect(blob?.[2]).toBe(80); // Step 0, Voice 2
          expect(blob?.[3]).toBe(0); // Step 0, Voice 3
        });

        it("handles null/undefined input", () => {
          expect(encodeStepPatternToBlob(null)).toBe(null);
          expect(encodeStepPatternToBlob(undefined)).toBe(null);
          expect(encodeStepPatternToBlob([])).toBe(null);
        });

        it("clamps velocity values to 0-127 range", () => {
          const stepPattern: number[][] = [
            [200, 0, 0, 0], // Voice 0: step 0 = 200 (will be clamped to 127)
            [-10, 0, 0, 0], // Voice 1: step 0 = -10 (will be clamped to 0)
            [64, 0, 0, 0], // Voice 2: step 0 = 64 (unchanged)
            [128, 0, 0, 0], // Voice 3: step 0 = 128 (will be clamped to 127)
          ];

          const blob = encodeStepPatternToBlob(stepPattern);

          expect(blob?.[0]).toBe(127); // 200 clamped to 127
          expect(blob?.[1]).toBe(0); // -10 clamped to 0
          expect(blob?.[2]).toBe(64); // 64 unchanged
          expect(blob?.[3]).toBe(127); // 128 clamped to 127
        });
      });

      describe("decodeStepPatternFromBlob", () => {
        it("decodes a 64-byte BLOB to 4-voice x 16-step pattern", () => {
          // Create a test BLOB with known values
          const blob = new Uint8Array(64);
          blob[0] = 127; // Step 0, Voice 0
          blob[1] = 0; // Step 0, Voice 1
          blob[2] = 80; // Step 0, Voice 2
          blob[3] = 0; // Step 0, Voice 3
          blob[4] = 0; // Step 1, Voice 0
          blob[5] = 127; // Step 1, Voice 1

          const stepPattern = decodeStepPatternFromBlob(blob);

          expect(stepPattern).toHaveLength(4); // 4 voices
          expect(stepPattern?.[0]).toHaveLength(16); // 16 steps
          expect(stepPattern?.[0][0]).toBe(127); // Voice 0, Step 0
          expect(stepPattern?.[1][0]).toBe(0); // Voice 1, Step 0
          expect(stepPattern?.[2][0]).toBe(80); // Voice 2, Step 0
          expect(stepPattern?.[3][0]).toBe(0); // Voice 3, Step 0
          expect(stepPattern?.[0][1]).toBe(0); // Voice 0, Step 1
          expect(stepPattern?.[1][1]).toBe(127); // Voice 1, Step 1
        });

        it("handles null input", () => {
          expect(decodeStepPatternFromBlob(null)).toBe(null);
        });

        it("handles invalid BLOB size", () => {
          const smallBlob = new Uint8Array(32); // Wrong size
          expect(decodeStepPatternFromBlob(smallBlob)).toBe(null);

          const largeBlob = new Uint8Array(128); // Wrong size
          expect(decodeStepPatternFromBlob(largeBlob)).toBe(null);
        });
      });

      describe("round-trip encoding/decoding", () => {
        it("preserves data through encode/decode cycle", () => {
          const originalPattern: number[][] = [
            [127, 0, 64, 32, 96, 16, 80, 48, 127, 0, 64, 32, 96, 16, 80, 48],
            [0, 127, 32, 96, 16, 80, 48, 64, 0, 127, 32, 96, 16, 80, 48, 64],
            [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
            [32, 16, 8, 4, 2, 1, 0, 127, 64, 32, 16, 8, 4, 2, 1, 0],
          ];

          const blob = encodeStepPatternToBlob(originalPattern);
          const decodedPattern = decodeStepPatternFromBlob(blob!);

          expect(decodedPattern).toEqual(originalPattern);
        });
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

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(dbDir, {
          recursive: true,
        });
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
        Object.defineProperty(process, "platform", {
          value: "win32",
        });

        const start = Date.now();
        await forceCloseDbConnection("/test/path/db.sqlite");
        const duration = Date.now() - start;

        // Should wait at least 200ms on Windows
        expect(duration).toBeGreaterThanOrEqual(200);

        // Restore original platform
        Object.defineProperty(process, "platform", {
          value: originalPlatform,
        });
      });
    });
  });

  describe("insertKitRecord", () => {
    let mockDb: any;
    let mockKitStmt: any;
    let mockVoiceStmt: any;

    beforeEach(() => {
      mockKitStmt = {
        run: vi.fn().mockReturnValue({ lastInsertRowid: 123 }),
      };
      mockVoiceStmt = {
        run: vi.fn(),
      };
      mockDb = {
        prepare: vi
          .fn()
          .mockReturnValueOnce(mockKitStmt) // First call for kit INSERT
          .mockReturnValueOnce(mockVoiceStmt), // Second call for voice INSERT
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

      // Check kit insertion
      expect(mockDb.prepare).toHaveBeenNthCalledWith(
        1,
        "INSERT INTO kits (name, alias, artist, plan_enabled, locked, step_pattern) VALUES (?, ?, ?, ?, ?, ?)",
      );
      expect(mockKitStmt.run).toHaveBeenCalledWith(
        "Test Kit",
        "TK",
        "Test Artist",
        1,
        0,
        null,
      );

      // Check voice creation
      expect(mockDb.prepare).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO voices (kit_id, voice_number, voice_alias) VALUES (?, ?, ?)",
      );
      expect(mockVoiceStmt.run).toHaveBeenCalledTimes(4);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(1, 123, 1, null);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(2, 123, 2, null);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(3, 123, 3, null);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(4, 123, 4, null);

      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles optional fields as null", () => {
      const dbDir = "/test/dir";
      const kit: KitRecord = {
        name: "Minimal Kit",
        plan_enabled: false,
      };

      insertKitRecord(dbDir, kit);

      expect(mockKitStmt.run).toHaveBeenCalledWith(
        "Minimal Kit",
        null,
        null,
        0,
        0,
        null,
      );
      expect(mockVoiceStmt.run).toHaveBeenCalledTimes(4); // Still creates 4 voices
    });

    it("handles locked field when provided", () => {
      const dbDir = "/test/dir";
      const kit: KitRecord = {
        name: "Locked Kit",
        plan_enabled: true,
        locked: true,
      };

      insertKitRecord(dbDir, kit);

      expect(mockKitStmt.run).toHaveBeenCalledWith(
        "Locked Kit",
        null,
        null,
        1,
        1,
        null,
      );
      expect(mockVoiceStmt.run).toHaveBeenCalledTimes(4); // Still creates 4 voices
    });

    it("handles step_pattern when provided", () => {
      const dbDir = "/test/dir";
      const stepPattern: number[][] = [
        [127, 0, 64, 0], // Voice 1: step pattern with velocities
        [0, 127, 0, 96], // Voice 2: different pattern
        [80, 80, 80, 80], // Voice 3: consistent velocity
        [0, 0, 0, 0], // Voice 4: all off
      ];
      const kit: KitRecord = {
        name: "Pattern Kit",
        plan_enabled: true,
        step_pattern: stepPattern,
      };

      insertKitRecord(dbDir, kit);

      // Expect the encoded BLOB instead of JSON
      const expectedBlob = encodeStepPatternToBlob(stepPattern);
      expect(mockKitStmt.run).toHaveBeenCalledWith(
        "Pattern Kit",
        null,
        null,
        1,
        0,
        expectedBlob,
      );
      expect(mockVoiceStmt.run).toHaveBeenCalledTimes(4); // Still creates 4 voices
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      const kit: KitRecord = {
        name: "Test Kit",
        plan_enabled: true,
      };

      mockKitStmt.run.mockImplementation(() => {
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

      mockKitStmt.run.mockImplementation(() => {
        throw "String error";
      });

      const result = insertKitRecord(dbDir, kit);

      expect(result.success).toBe(false);
      expect(result.error).toBe("String error");
    });
  });

  describe("updateVoiceAlias", () => {
    let mockDb: any;
    let mockStmt: any;

    beforeEach(() => {
      mockStmt = {
        run: vi.fn().mockReturnValue({ changes: 1 }),
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

    it("updates voice alias successfully", () => {
      const dbDir = "/test/dir";
      const result = updateVoiceAlias(dbDir, 1, 2, "Kick");

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "UPDATE voices SET voice_alias = ? WHERE kit_id = ? AND voice_number = ?",
      );
      expect(mockStmt.run).toHaveBeenCalledWith("Kick", 1, 2);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles null voice alias", () => {
      const dbDir = "/test/dir";
      updateVoiceAlias(dbDir, 1, 3, null);

      expect(mockStmt.run).toHaveBeenCalledWith(null, 1, 3);
    });

    it("handles voice not found", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = updateVoiceAlias(dbDir, 1, 1, "Snare");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice not found");
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = updateVoiceAlias(dbDir, 1, 1, "Hat");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  describe("updateStepPattern", () => {
    let mockDb: any;
    let mockStmt: any;

    beforeEach(() => {
      mockStmt = {
        run: vi.fn().mockReturnValue({ changes: 1 }),
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

    it("updates step pattern successfully", () => {
      const dbDir = "/test/dir";
      const stepPattern: number[][] = [
        [127, 0, 64, 0, 96, 0, 80, 0, 127, 0, 64, 0, 96, 0, 80, 0], // 16 steps
        [0, 127, 0, 96, 0, 80, 0, 64, 0, 127, 0, 96, 0, 80, 0, 64],
        [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const result = updateStepPattern(dbDir, 1, stepPattern);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "UPDATE kits SET step_pattern = ? WHERE id = ?",
      );
      // Expect the encoded BLOB instead of JSON
      const expectedBlob = encodeStepPatternToBlob(stepPattern);
      expect(mockStmt.run).toHaveBeenCalledWith(expectedBlob, 1);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles null step pattern (clears pattern)", () => {
      const dbDir = "/test/dir";
      const result = updateStepPattern(dbDir, 1, null);

      expect(result.success).toBe(true);
      expect(mockStmt.run).toHaveBeenCalledWith(null, 1);
    });

    it("handles kit not found", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = updateStepPattern(dbDir, 999, [[127, 0, 64, 0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kit not found");
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = updateStepPattern(dbDir, 1, [[127, 0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(mockDb.close).toHaveBeenCalled();
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
        voice_number: 1,
        slot_number: 1,
        is_stereo: true,
      };

      const result = insertSampleRecord(dbDir, sample);

      expect(result.success).toBe(true);
      expect(result.sampleId).toBe(456);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "INSERT INTO samples (kit_id, filename, voice_number, slot_number, is_stereo) VALUES (?, ?, ?, ?, ?)",
      );
      expect(mockStmt.run).toHaveBeenCalledWith(123, "kick.wav", 1, 1, 1);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("converts boolean to sqlite format", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_id: 123,
        filename: "mono.wav",
        voice_number: 2,
        slot_number: 2,
        is_stereo: false,
      };

      insertSampleRecord(dbDir, sample);

      expect(mockStmt.run).toHaveBeenCalledWith(123, "mono.wav", 2, 2, 0);
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_id: 999,
        filename: "invalid.wav",
        voice_number: 1,
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
        voice_number: 3,
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
