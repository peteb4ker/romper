import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CARD_NOT_RESPONDING_SETUP_MESSAGE,
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../../services/cardWatchdog";
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

const mockPath = vi.mocked(path);

const aDirectory = { isDirectory: () => true } as unknown as fs.Stats;

function enoent() {
  return Object.assign(new Error("ENOENT: no such file or directory"), {
    code: "ENOENT",
  });
}

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

    it("should return available bytes when path exists", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.statfs).mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as unknown as fs.StatsFs);

      const result = await checkDiskSpace("/some/path");

      expect(result.sufficient).toBe(true);
      expect(result.availableBytes).toBe(1000000 * 4096);
    });

    it("should return error when path does not exist", async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(enoent());
      mockPath.dirname.mockReturnValue("/some");

      const result = await checkDiskSpace("/some/nonexistent");

      expect(result.sufficient).toBe(false);
      expect(result.error).toBe("Path does not exist");
    });

    it("should return error when statfs fails", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.statfs).mockRejectedValue(new Error("I/O error"));

      const result = await checkDiskSpace("/some/path");

      expect(result.sufficient).toBe(false);
      expect(result.error).toContain("Disk space check failed");
    });
  });

  describe("checkDiskSpaceSufficient", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return sufficient when enough space", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.statfs).mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as unknown as fs.StatsFs);

      const result = await checkDiskSpaceSufficient("/path", 1024);

      expect(result.sufficient).toBe(true);
      expect(result.requiredBytes).toBe(1024);
    });

    it("should return insufficient when not enough space", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.statfs).mockResolvedValue({
        bavail: 1,
        bsize: 1,
      } as unknown as fs.StatsFs);

      const result = await checkDiskSpaceSufficient(
        "/path",
        1024 * 1024 * 1024,
      );

      expect(result.sufficient).toBe(false);
      expect(result.availableBytes).toBe(1);
      expect(result.requiredBytes).toBe(1024 * 1024 * 1024);
    });
  });

  describe("checkPathWritable", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return writable when write and delete succeed", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);
      mockPath.join.mockReturnValue("/path/.romper-write-test-123");

      const result = await checkPathWritable("/path");

      expect(result.writable).toBe(true);
      expect(fs.promises.unlink).toHaveBeenCalledWith(
        "/path/.romper-write-test-123",
      );
    });

    it("should return not writable when write fails", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.writeFile).mockRejectedValue(
        new Error("Permission denied"),
      );
      mockPath.join.mockReturnValue("/path/.romper-write-test-123");

      const result = await checkPathWritable("/path");

      expect(result.writable).toBe(false);
      expect(result.error).toContain("Cannot write to path");
    });

    it("should return not writable when directory does not exist", async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(enoent());
      mockPath.dirname.mockReturnValue("/nonexistent");

      const result = await checkPathWritable("/nonexistent/sub");

      expect(result.writable).toBe(false);
      expect(result.error).toContain("Directory does not exist");
    });
  });

  // #724: the setup wizard checks the folder it sets up in, which could be
  // on a card whose driver stopped responding (#653). A synchronous call
  // would block the main process, so each check is asynchronous and the
  // card watchdog gives up on one that never finishes.
  describe("[UC-01] [Q-01] a folder that stops responding (#724)", () => {
    const never = <T>() => new Promise<T>(() => undefined);

    beforeEach(() => {
      vi.clearAllMocks();
      cardWatchdogSettings.timeoutMs = 20;
    });

    afterEach(() => {
      cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    });

    it("the writable check says the card stopped responding", async () => {
      vi.mocked(fs.promises.stat).mockReturnValue(never());

      await expect(checkPathWritable("/card")).resolves.toEqual({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
        writable: false,
      });
    });

    it("the writable check gives up on a test file that's never written", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.writeFile).mockReturnValue(never());

      await expect(checkPathWritable("/card")).resolves.toEqual({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
        writable: false,
      });
    });

    it("the disk space check says the card stopped responding", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.statfs).mockReturnValue(never());

      await expect(
        checkDiskSpaceSufficient("/card", 1024),
      ).resolves.toMatchObject({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
        sufficient: false,
      });
    });

    it("touches the folder only through fs.promises", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue(aDirectory);
      vi.mocked(fs.promises.statfs).mockResolvedValue({
        bavail: 1,
        bsize: 1,
      } as unknown as fs.StatsFs);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

      await checkPathWritable("/card");
      await checkDiskSpaceSufficient("/card", 1);

      for (const sync of [
        fs.existsSync,
        fs.statSync,
        fs.statfsSync,
        fs.writeFileSync,
        fs.unlinkSync,
      ]) {
        expect(sync).not.toHaveBeenCalled();
      }
    });
  });
});
