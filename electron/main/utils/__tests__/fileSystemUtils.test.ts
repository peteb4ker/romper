import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkDiskSpace,
  checkDiskSpaceSufficient,
  checkPathWritable,
  ensureDirectoryExists,
  getFileSize,
  removeDirectorySafe,
  ServicePathManager,
  validateFileExists,
} from "../fileSystemUtils";

// Mock fs module
vi.mock("node:fs");
vi.mock("node:path");

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

  describe("checkDiskSpace", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return available bytes when path exists", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statfsSync.mockReturnValue({
        bavail: 1000000,
        bsize: 4096,
      } as unknown as fs.StatsFs);

      const result = checkDiskSpace("/some/path");

      expect(result.sufficient).toBe(true);
      expect(result.availableBytes).toBe(1000000 * 4096);
    });

    it("should return error when path does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);
      mockPath.dirname.mockReturnValue("/some");

      const result = checkDiskSpace("/some/nonexistent");

      expect(result.sufficient).toBe(false);
      expect(result.error).toBe("Path does not exist");
    });

    it("should return error when statfsSync throws", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statfsSync.mockImplementation(() => {
        throw new Error("I/O error");
      });

      const result = checkDiskSpace("/some/path");

      expect(result.sufficient).toBe(false);
      expect(result.error).toContain("Disk space check failed");
    });
  });

  describe("checkDiskSpaceSufficient", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return sufficient when enough space", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statfsSync.mockReturnValue({
        bavail: 1000000,
        bsize: 4096,
      } as unknown as fs.StatsFs);

      const result = checkDiskSpaceSufficient("/path", 1024);

      expect(result.sufficient).toBe(true);
      expect(result.requiredBytes).toBe(1024);
    });

    it("should return insufficient when not enough space", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statfsSync.mockReturnValue({
        bavail: 1,
        bsize: 1,
      } as unknown as fs.StatsFs);

      const result = checkDiskSpaceSufficient("/path", 1024 * 1024 * 1024);

      expect(result.sufficient).toBe(false);
      expect(result.availableBytes).toBe(1);
      expect(result.requiredBytes).toBe(1024 * 1024 * 1024);
    });
  });

  describe("removeDirectorySafe", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should remove directory within .romperdb scope", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.rmSync.mockImplementation(() => {});

      const result = removeDirectorySafe("/path/.romperdb");

      expect(result.removed).toBe(true);
      expect(mockFs.rmSync).toHaveBeenCalledWith("/path/.romperdb", {
        force: true,
        recursive: true,
      });
    });

    it("should refuse to remove directory outside .romperdb scope", () => {
      const result = removeDirectorySafe("/path/to/other");

      expect(result.removed).toBe(false);
      expect(result.error).toContain("Refusing to remove");
      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });

    it("should return success if directory already gone", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = removeDirectorySafe("/path/.romperdb");

      expect(result.removed).toBe(true);
      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });

    it("should handle rmSync errors", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.rmSync.mockImplementation(() => {
        throw new Error("EACCES");
      });

      const result = removeDirectorySafe("/path/.romperdb");

      expect(result.removed).toBe(false);
      expect(result.error).toContain("Failed to remove");
    });
  });

  describe("checkPathWritable", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return writable when write and delete succeed", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: () => true,
      } as unknown as fs.Stats);
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.unlinkSync.mockImplementation(() => {});
      mockPath.join.mockReturnValue("/path/.romper-write-test-123");

      const result = checkPathWritable("/path");

      expect(result.writable).toBe(true);
    });

    it("should return not writable when write fails", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: () => true,
      } as unknown as fs.Stats);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });
      mockPath.join.mockReturnValue("/path/.romper-write-test-123");

      const result = checkPathWritable("/path");

      expect(result.writable).toBe(false);
      expect(result.error).toContain("Cannot write to path");
    });

    it("should return not writable when directory does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);
      mockPath.dirname.mockReturnValue("/nonexistent");

      const result = checkPathWritable("/nonexistent/sub");

      expect(result.writable).toBe(false);
      expect(result.error).toContain("Directory does not exist");
    });
  });
});
