import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDbFileWithRetry } from "../fileOperations";

// Mock fs functions
vi.mock("node:fs", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:fs")>()),
);
const mockFs = vi.mocked(fs);

describe("fileOperations unit tests", () => {
  const testDbPath = "/test/path/romper.sqlite";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.stubGlobal("console", {
      error: vi.fn(),
      log: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("deleteDbFileWithRetry", () => {
    it("should call unlinkSync with correct path", async () => {
      mockFs.unlinkSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false);

      await deleteDbFileWithRetry(testDbPath);

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(testDbPath);
    });

    it("should verify file deletion with existsSync", async () => {
      mockFs.unlinkSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false);

      await deleteDbFileWithRetry(testDbPath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(testDbPath);
    });

    it("should throw error when all attempts fail on non-Windows", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(deleteDbFileWithRetry(testDbPath, 2)).rejects.toThrow();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should attempt rename on Windows when deletion fails", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false);

      await deleteDbFileWithRetry(testDbPath, 1);

      expect(mockFs.renameSync).toHaveBeenCalled();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should resolve on Windows even when all operations fail", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {
        throw new Error("Rename failed");
      });

      // Windows implementation should not throw
      await expect(
        deleteDbFileWithRetry(testDbPath, 1),
      ).resolves.toBeUndefined();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("waits between retries on non-Windows before giving up", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });
      vi.useFakeTimers();

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });

      const promise = deleteDbFileWithRetry(testDbPath, 1);
      let settled = false;
      const markSettled = () => {
        settled = true;
      };
      promise.then(markSettled, markSettled);
      const rejected = expect(promise).rejects.toThrow("File in use");

      // Still waiting on the retry delay
      await vi.advanceTimersByTimeAsync(99);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await rejected;

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });
});
