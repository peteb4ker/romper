import BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
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
  mapToKitWithVoices,
  mapToSampleRecord,
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
        expect(schema).toContain("FOREIGN KEY(kit_name) REFERENCES kits(name)");
      });

      it("includes all required kit columns", () => {
        const schema = getDbSchema();
        expect(schema).toContain("name TEXT PRIMARY KEY");
        expect(schema).toContain("alias TEXT");
        expect(schema).toContain("artist TEXT");
        expect(schema).toContain("plan_enabled BOOLEAN NOT NULL DEFAULT 0");
      });

      it("includes all required sample columns", () => {
        const schema = getDbSchema();
        expect(schema).toContain("kit_name TEXT");
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
        1, // true converted to 1 for SQLite
        0, // false converted to 0 for SQLite
        null,
      );

      // Check voice creation
      expect(mockDb.prepare).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO voices (kit_name, voice_number, voice_alias) VALUES (?, ?, ?)",
      );
      expect(mockVoiceStmt.run).toHaveBeenCalledTimes(4);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(1, "Test Kit", 1, null);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(2, "Test Kit", 2, null);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(3, "Test Kit", 3, null);
      expect(mockVoiceStmt.run).toHaveBeenNthCalledWith(4, "Test Kit", 4, null);

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
        0, // false converted to 0 for SQLite
        0, // false converted to 0 for SQLite
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
        1, // true converted to 1 for SQLite
        1, // true converted to 1 for SQLite
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
        1, // true converted to 1 for SQLite
        0, // false converted to 0 for SQLite
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
      const result = updateVoiceAlias(dbDir, "TestKit", 2, "Kick");

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "UPDATE voices SET voice_alias = ? WHERE kit_name = ? AND voice_number = ?",
      );
      expect(mockStmt.run).toHaveBeenCalledWith("Kick", "TestKit", 2);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles null voice alias", () => {
      const dbDir = "/test/dir";
      updateVoiceAlias(dbDir, "TestKit", 3, null);

      expect(mockStmt.run).toHaveBeenCalledWith(null, "TestKit", 3);
    });

    it("handles voice not found", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = updateVoiceAlias(dbDir, "TestKit", 1, "Snare");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice not found");
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = updateVoiceAlias(dbDir, "TestKit", 1, "Hat");

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

      const result = updateStepPattern(dbDir, "TestKit", stepPattern);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "UPDATE kits SET step_pattern = ? WHERE name = ?",
      );
      // Expect the encoded BLOB instead of JSON
      const expectedBlob = encodeStepPatternToBlob(stepPattern);
      expect(mockStmt.run).toHaveBeenCalledWith(expectedBlob, "TestKit");
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles null step pattern (clears pattern)", () => {
      const dbDir = "/test/dir";
      const result = updateStepPattern(dbDir, "TestKit", null);

      expect(result.success).toBe(true);
      expect(mockStmt.run).toHaveBeenCalledWith(null, "TestKit");
    });

    it("handles kit not found", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = updateStepPattern(dbDir, "NonexistentKit", [
        [127, 0, 64, 0],
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kit not found");
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      mockStmt.run.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = updateStepPattern(dbDir, "TestKit", [[127, 0]]);

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
        kit_name: "TestKit",
        filename: "kick.wav",
        voice_number: 1,
        slot_number: 1,
        is_stereo: true,
      };

      const result = insertSampleRecord(dbDir, sample);

      expect(result.success).toBe(true);
      expect(result.data?.sampleId).toBe(456);
      expect(result.error).toBeUndefined();

      expect(mockBetterSqlite3).toHaveBeenCalledWith(getDbPath(dbDir));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "INSERT INTO samples (kit_name, filename, voice_number, slot_number, is_stereo, wav_bitrate, wav_sample_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      expect(mockStmt.run).toHaveBeenCalledWith(
        "TestKit",
        "kick.wav",
        1,
        1,
        1, // true converted to 1 for SQLite
        null,
        null,
      );
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles boolean values in sqlite format", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_name: "TestKit",
        filename: "mono.wav",
        voice_number: 2,
        slot_number: 2,
        is_stereo: false,
      };

      insertSampleRecord(dbDir, sample);

      expect(mockStmt.run).toHaveBeenCalledWith(
        "TestKit",
        "mono.wav",
        2,
        2,
        0, // false converted to 0 for SQLite
        null,
        null,
      );
    });

    it("handles wav metadata fields", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_name: "TestKit",
        filename: "hd_sample.wav",
        voice_number: 3,
        slot_number: 5,
        is_stereo: true,
        wav_bitrate: 1411200, // 44.1kHz * 16-bit * 2 channels
        wav_sample_rate: 44100,
      };

      const result = insertSampleRecord(dbDir, sample);

      expect(result.success).toBe(true);
      expect(mockStmt.run).toHaveBeenCalledWith(
        "TestKit",
        "hd_sample.wav",
        3,
        5,
        1, // true converted to 1 for SQLite
        1411200,
        44100,
      );
    });

    it("handles database errors", () => {
      const dbDir = "/test/dir";
      const sample: SampleRecord = {
        kit_name: "TestKit",
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
        kit_name: "test_kit",
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

  describe("mapping functions", () => {
    describe("mapToSampleRecord", () => {
      it("maps a database row to a SampleRecord", () => {
        const dbRow = {
          kit_name: "test-kit",
          filename: "test.wav",
          voice_number: 1,
          slot_number: 2,
          is_stereo: 1, // SQLite boolean as integer
          wav_bitrate: 16,
          wav_sample_rate: 44100,
        };

        const result = mapToSampleRecord(dbRow);

        expect(result).toEqual({
          kit_name: "test-kit",
          filename: "test.wav",
          voice_number: 1,
          slot_number: 2,
          is_stereo: true, // Should convert SQLite integer to boolean
          wav_bitrate: 16,
          wav_sample_rate: 44100,
        });
      });

      it("handles missing optional fields correctly", () => {
        const dbRow = {
          kit_name: "test-kit",
          filename: "test.wav",
          voice_number: 1,
          slot_number: 2,
          is_stereo: 0,
          // wav_bitrate and wav_sample_rate are omitted
        };

        const result = mapToSampleRecord(dbRow);

        expect(result).toEqual({
          kit_name: "test-kit",
          filename: "test.wav",
          voice_number: 1,
          slot_number: 2,
          is_stereo: false,
          wav_bitrate: undefined, // Should be undefined, not null
          wav_sample_rate: undefined, // Should be undefined, not null
        });
      });
    });

    describe("mapToKitWithVoices", () => {
      it("maps a kit row and voice rows to a KitWithVoices object", () => {
        const kitRow = {
          name: "test-kit",
          alias: "Test Kit",
          artist: "Test Artist",
          plan_enabled: 1,
          locked: 0,
          step_pattern: null,
        };

        const voiceRows = [
          { voice_number: 1, voice_alias: "Kicks" },
          { voice_number: 3, voice_alias: "Hats" },
        ];

        const result = mapToKitWithVoices(kitRow, voiceRows);

        expect(result).toEqual({
          name: "test-kit",
          alias: "Test Kit",
          artist: "Test Artist",
          plan_enabled: true,
          locked: false,
          step_pattern: undefined,
          voices: {
            1: "Kicks",
            3: "Hats",
          },
        });
      });

      it("handles empty voice rows correctly", () => {
        const kitRow = {
          name: "test-kit",
          plan_enabled: 0,
          locked: 1,
        };

        const voiceRows: any[] = [];

        const result = mapToKitWithVoices(kitRow, voiceRows);

        expect(result).toEqual({
          name: "test-kit",
          alias: undefined,
          artist: undefined,
          plan_enabled: false,
          locked: true,
          step_pattern: undefined,
          voices: {},
        });
      });

      it("skips voice entries with missing voice_alias", () => {
        const kitRow = {
          name: "test-kit",
          plan_enabled: 1,
          locked: 0,
        };

        const voiceRows = [
          { voice_number: 1, voice_alias: "Kicks" },
          { voice_number: 2 }, // Missing voice_alias
          { voice_number: 3, voice_alias: "" }, // Empty voice_alias
        ];

        const result = mapToKitWithVoices(kitRow, voiceRows);

        expect(result.voices).toEqual({
          1: "Kicks",
          // 2 and 3 should be excluded due to missing/empty voice_alias
        });
      });
    });
  });
});
