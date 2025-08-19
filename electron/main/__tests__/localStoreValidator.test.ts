import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as romperDbCore from "../db/romperDbCoreORM.js";
import {
  getRomperDbPath,
  validateLocalStoreAgainstDb,
  validateLocalStoreAndDb,
} from "../localStoreValidator";

// Mock the romperDbCoreORM functions for validation tests
vi.mock("../db/romperDbCoreORM.js", () => {
  return {
    getKits: vi.fn(),
    getKitSamples: vi.fn(),
    validateDatabaseSchema: vi.fn(() => ({ data: true, success: true })),
  };
});

describe("localStoreValidator", () => {
  const testDir = "/tmp/romper-test-validation";
  const localStorePath = path.join(testDir, "local-store");
  const romperDbDir = path.join(localStorePath, ".romperdb");
  const romperDbPath = path.join(romperDbDir, "romper.sqlite");

  beforeEach(() => {
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { force: true, recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { force: true, recursive: true });
    }
  });

  describe("getRomperDbPath", () => {
    it("should derive the correct DB path from local store path", () => {
      const result = getRomperDbPath("/path/to/store");
      expect(result).toBe("/path/to/store/.romperdb/romper.sqlite");
    });
  });

  describe("validateLocalStoreAndDb", () => {
    it("should return invalid if local store path does not exist", () => {
      const result = validateLocalStoreAndDb("/nonexistent/path");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Local store path does not exist");
    });

    it("should return invalid if local store path is not a directory", () => {
      // Create a file instead of directory
      fs.mkdirSync(testDir, { recursive: true });
      const filePath = path.join(testDir, "not-a-dir");
      fs.writeFileSync(filePath, "test");

      const result = validateLocalStoreAndDb(filePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Local store path is not a directory");
    });

    it("should return invalid if .romperdb directory does not exist", () => {
      // Create local store directory but no .romperdb
      fs.mkdirSync(localStorePath, { recursive: true });

      const result = validateLocalStoreAndDb(localStorePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "This directory does not contain a valid Romper database (.romperdb folder)."
      );
    });

    it("should return invalid if romper.sqlite file does not exist", () => {
      // Create local store and .romperdb directory but no DB file
      fs.mkdirSync(romperDbDir, { recursive: true });

      const result = validateLocalStoreAndDb(localStorePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Romper DB file not found");
    });

    it("should return valid if all paths exist", () => {
      // Create complete directory structure
      fs.mkdirSync(romperDbDir, { recursive: true });
      fs.writeFileSync(romperDbPath, "fake db");

      const result = validateLocalStoreAndDb(localStorePath);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.romperDbPath).toBe(romperDbPath);
    });

    it("should handle errors gracefully", () => {
      // Mock fs.existsSync to throw an error
      const originalExistsSync = fs.existsSync;
      fs.existsSync = () => {
        throw new Error("Permission denied");
      };

      const result = validateLocalStoreAndDb(localStorePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Permission denied");

      // Restore original function
      fs.existsSync = originalExistsSync;
    });
  });

  describe("validateLocalStoreAgainstDb", () => {
    beforeEach(() => {
      // Setup mock directory structure
      fs.mkdirSync(testDir, { recursive: true });
      fs.mkdirSync(localStorePath, { recursive: true });
      fs.mkdirSync(romperDbDir, { recursive: true });
      fs.writeFileSync(romperDbPath, "mock-db-content");

      // Create kit folders
      const kitA0Path = path.join(localStorePath, "A0");
      const kitB1Path = path.join(localStorePath, "B1");
      fs.mkdirSync(kitA0Path);
      fs.mkdirSync(kitB1Path);

      // Create sample files
      fs.writeFileSync(path.join(kitA0Path, "1 Kick.wav"), "mock-wav");
      fs.writeFileSync(path.join(kitA0Path, "2 Snare.wav"), "mock-wav");
      fs.writeFileSync(path.join(kitA0Path, "extra.wav"), "mock-wav");
      fs.writeFileSync(path.join(kitB1Path, "3 Hat.wav"), "mock-wav");

      // Mock DB functions
      vi.mocked(romperDbCore.getKits).mockReturnValue({
        data: [
          { editable: false, name: "A0" },
          { editable: false, name: "B1" },
        ],
        success: true,
      });

      vi.mocked(romperDbCore.getKitSamples).mockImplementation(
        (dbDir, kitName) => {
          if (kitName === "A0") {
            return {
              data: [
                {
                  filename: "1 Kick.wav",
                  is_stereo: false,
                  kit_name: "A0",
                  slot_number: 100,
                  source_path: path.join(localStorePath, "A0", "1 Kick.wav"),
                  voice_number: 1,
                },
                {
                  filename: "2 Snare.wav",
                  is_stereo: false,
                  kit_name: "A0",
                  slot_number: 200,
                  source_path: path.join(localStorePath, "A0", "2 Snare.wav"),
                  voice_number: 1,
                },
                {
                  filename: "missing.wav",
                  is_stereo: false,
                  kit_name: "A0",
                  slot_number: 300,
                  source_path: path.join(localStorePath, "A0", "missing.wav"),
                  voice_number: 1,
                },
              ],
              success: true,
            };
          }
          if (kitName === "B1") {
            return {
              data: [
                {
                  filename: "3 Hat.wav",
                  is_stereo: false,
                  kit_name: "B1",
                  slot_number: 100,
                  source_path: path.join(localStorePath, "B1", "3 Hat.wav"),
                  voice_number: 1,
                },
              ],
              success: true,
            };
          }
          return { error: "Kit not found", success: false };
        }
      );
    });

    it("should detect missing files and extra files", () => {
      const result = validateLocalStoreAgainstDb(localStorePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1); // Only A0 (missing/extra file)

      // Check A0 errors
      const a0Error = result.errors!.find((e) => e.kitName === "A0");
      expect(a0Error).toBeDefined();
      expect(a0Error!.missingFiles).toContain("missing.wav");
      expect(a0Error!.extraFiles).toContain("extra.wav");
    });

    it("should return valid when all files match DB records", () => {
      // Mock B1 correctly (no missing or extra files)
      vi.mocked(romperDbCore.getKits).mockReturnValue({
        data: [{ editable: false, name: "B1" }],
        success: true,
      });

      const result = validateLocalStoreAgainstDb(localStorePath);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.errorSummary).toBeUndefined();
    });

    it("should return error when basic validation fails", () => {
      // Remove DB file to make basic validation fail
      fs.rmSync(romperDbPath);

      const result = validateLocalStoreAgainstDb(localStorePath);

      expect(result.isValid).toBe(false);
      expect(result.errorSummary).toBeDefined();
      expect(result.errorSummary).toContain("Romper DB file not found");
    });

    it("should return error when getKits fails", () => {
      vi.mocked(romperDbCore.getKits).mockReturnValue({
        error: "Database query failed",
        success: false,
      });

      const result = validateLocalStoreAgainstDb(localStorePath);

      expect(result.isValid).toBe(false);
      expect(result.errorSummary).toContain("Failed to retrieve kits");
    });
  });
});
