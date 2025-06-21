import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getRomperDbPath,
  validateLocalStoreAndDb,
} from "../localStoreValidator";

describe("localStoreValidator", () => {
  const testDir = "/tmp/romper-test-validation";
  const localStorePath = path.join(testDir, "local-store");
  const romperDbDir = path.join(localStorePath, ".romperdb");
  const romperDbPath = path.join(romperDbDir, "romper.sqlite");

  beforeEach(() => {
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
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
      expect(result.error).toBe("Romper DB directory not found");
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
});
