import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureDirectoryExists,
  getFileSize,
  ServicePathManager,
  validateFileExists,
} from "../fileSystemUtils";

// Mock fs module
vi.mock("fs");
vi.mock("path");

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

describe("fileSystemUtils", () => {
  describe("ServicePathManager", () => {
    describe("getDbPath", () => {
      it("should return correct database path", () => {
        const localStorePath = "/home/user/music";
        mockPath.join.mockReturnValue("/home/user/music/.romperdb");

        const result = ServicePathManager.getDbPath(localStorePath);

        expect(mockPath.join).toHaveBeenCalledWith(localStorePath, ".romperdb");
        expect(result).toBe("/home/user/music/.romperdb");
      });

      it("should handle Windows paths", () => {
        const localStorePath = "C:\\Users\\User\\Music";
        mockPath.join.mockReturnValue("C:\\Users\\User\\Music\\.romperdb");

        const result = ServicePathManager.getDbPath(localStorePath);

        expect(mockPath.join).toHaveBeenCalledWith(localStorePath, ".romperdb");
        expect(result).toBe("C:\\Users\\User\\Music\\.romperdb");
      });
    });

    describe("getLocalStorePath", () => {
      it("should return localStorePath from settings", () => {
        const settings = { localStorePath: "/home/user/music" };

        const result = ServicePathManager.getLocalStorePath(settings);

        expect(result).toBe("/home/user/music");
      });

      it("should return null when localStorePath is not set", () => {
        const settings = {};

        const result = ServicePathManager.getLocalStorePath(settings);

        expect(result).toBeNull();
      });

      it("should return null when localStorePath is empty string", () => {
        const settings = { localStorePath: "" };

        const result = ServicePathManager.getLocalStorePath(settings);

        expect(result).toBeNull();
      });

      it("should return null when localStorePath is null", () => {
        const settings = { localStorePath: null };

        const result = ServicePathManager.getLocalStorePath(settings);

        expect(result).toBeNull();
      });

      it("should handle other properties in settings", () => {
        const settings = {
          anotherSetting: 123,
          localStorePath: "/home/user/music",
          otherSetting: "value",
        };

        const result = ServicePathManager.getLocalStorePath(settings);

        expect(result).toBe("/home/user/music");
      });
    });

    describe("validateAndGetPaths", () => {
      it("should return valid result when localStorePath is configured", () => {
        const settings = { localStorePath: "/home/user/music" };
        mockPath.join.mockReturnValue("/home/user/music/.romperdb");

        const result = ServicePathManager.validateAndGetPaths(settings);

        expect(result.isValid).toBe(true);
        expect(result.localStorePath).toBe("/home/user/music");
        expect(result.dbPath).toBe("/home/user/music/.romperdb");
        expect(result.error).toBeUndefined();
      });

      it("should return error when localStorePath is not configured", () => {
        const settings = {};

        const result = ServicePathManager.validateAndGetPaths(settings);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("No local store path configured");
        expect(result.localStorePath).toBeUndefined();
        expect(result.dbPath).toBeUndefined();
      });

      it("should return error when localStorePath is empty", () => {
        const settings = { localStorePath: "" };

        const result = ServicePathManager.validateAndGetPaths(settings);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("No local store path configured");
      });

      it("should return error when localStorePath is null", () => {
        const settings = { localStorePath: null };

        const result = ServicePathManager.validateAndGetPaths(settings);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("No local store path configured");
      });
    });
  });

  describe("ensureDirectoryExists", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create directory if it doesn't exist", () => {
      const dirPath = "/home/user/music";
      mockFs.existsSync.mockReturnValue(false);

      ensureDirectoryExists(dirPath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(dirPath);
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(dirPath, {
        recursive: true,
      });
    });

    it("should not create directory if it already exists", () => {
      const dirPath = "/home/user/music";
      mockFs.existsSync.mockReturnValue(true);

      ensureDirectoryExists(dirPath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(dirPath);
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it("should handle nested directory creation", () => {
      const dirPath = "/home/user/music/samples/drums";
      mockFs.existsSync.mockReturnValue(false);

      ensureDirectoryExists(dirPath);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(dirPath, {
        recursive: true,
      });
    });
  });

  describe("getFileSize", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Clear console.warn mock
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return file size when file exists", () => {
      const filePath = "/path/to/file.wav";
      const mockStats = { size: 1024 };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as unknown);

      const result = getFileSize(filePath);

      expect(result).toBe(1024);
      expect(mockFs.existsSync).toHaveBeenCalledWith(filePath);
      expect(mockFs.statSync).toHaveBeenCalledWith(filePath);
    });

    it("should return 0 when file doesn't exist", () => {
      const filePath = "/path/to/nonexistent.wav";
      mockFs.existsSync.mockReturnValue(false);

      const result = getFileSize(filePath);

      expect(result).toBe(0);
      expect(mockFs.existsSync).toHaveBeenCalledWith(filePath);
      expect(mockFs.statSync).not.toHaveBeenCalled();
    });

    it("should return 0 when existsSync throws error", () => {
      const filePath = "/path/to/file.wav";
      mockFs.existsSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = getFileSize(filePath);

      expect(result).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        `Failed to get file size for ${filePath}:`,
        expect.any(Error),
      );
    });

    it("should return 0 when statSync throws error", () => {
      const filePath = "/path/to/file.wav";
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        throw new Error("IO error");
      });

      const result = getFileSize(filePath);

      expect(result).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        `Failed to get file size for ${filePath}:`,
        expect.any(Error),
      );
    });

    it("should handle large file sizes", () => {
      const filePath = "/path/to/largefile.wav";
      const mockStats = { size: 2147483648 }; // 2GB

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as unknown);

      const result = getFileSize(filePath);

      expect(result).toBe(2147483648);
    });

    it("should handle zero-sized files", () => {
      const filePath = "/path/to/empty.wav";
      const mockStats = { size: 0 };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as unknown);

      const result = getFileSize(filePath);

      expect(result).toBe(0);
    });
  });

  describe("validateFileExists", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return success when file exists and is valid", () => {
      const filePath = "/path/to/file.wav";
      const mockStats = { isFile: () => true };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as unknown);

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockFs.existsSync).toHaveBeenCalledWith(filePath);
      expect(mockFs.statSync).toHaveBeenCalledWith(filePath);
    });

    it("should return error when file doesn't exist", () => {
      const filePath = "/path/to/nonexistent.wav";
      mockFs.existsSync.mockReturnValue(false);

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(false);
      expect(result.error).toBe("File not found");
      expect(mockFs.existsSync).toHaveBeenCalledWith(filePath);
      expect(mockFs.statSync).not.toHaveBeenCalled();
    });

    it("should return error when path is not a file (directory)", () => {
      const filePath = "/path/to/directory";
      const mockStats = { isFile: () => false };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as unknown);

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(false);
      expect(result.error).toBe("Path is not a file");
    });

    it("should return error when existsSync throws error", () => {
      const filePath = "/path/to/file.wav";
      const error = new Error("Permission denied");
      mockFs.existsSync.mockImplementation(() => {
        throw error;
      });

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(false);
      expect(result.error).toBe("File validation failed: Permission denied");
    });

    it("should return error when statSync throws error", () => {
      const filePath = "/path/to/file.wav";
      const error = new Error("IO error");
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        throw error;
      });

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(false);
      expect(result.error).toBe("File validation failed: IO error");
    });

    it("should handle non-Error exceptions", () => {
      const filePath = "/path/to/file.wav";
      mockFs.existsSync.mockImplementation(() => {
        throw "String error";
      });

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(false);
      expect(result.error).toBe("File validation failed: String error");
    });

    it("should handle special characters in file path", () => {
      const filePath = "/path/to/file with spaces & symbols.wav";
      const mockStats = { isFile: () => true };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as unknown);

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
