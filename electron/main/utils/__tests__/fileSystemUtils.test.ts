import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkDiskSpace,
  checkDiskSpaceSufficient,
  checkPathWritable,
  ServicePathManager,
} from "../fileSystemUtils";

// Mock fs module
vi.mock("node:fs", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:fs")>()),
);
vi.mock("node:path", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:path")>()),
);

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

      describe("with ROMPER_LOCAL_PATH set", () => {
        afterEach(() => {
          vi.unstubAllEnvs();
        });

        it("prefers the override over the saved path", () => {
          vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");

          const result = ServicePathManager.getLocalStorePath({
            localStorePath: "/home/user/music",
          });

          expect(result).toBe("/env/store");
        });

        it("uses the override when no path is saved", () => {
          vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");

          const result = ServicePathManager.getLocalStorePath({
            localStorePath: null,
          });

          expect(result).toBe("/env/store");
        });

        it("ignores a blank override", () => {
          vi.stubEnv("ROMPER_LOCAL_PATH", "  ");

          const result = ServicePathManager.getLocalStorePath({
            localStorePath: "/home/user/music",
          });

          expect(result).toBe("/home/user/music");
        });
      });
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
