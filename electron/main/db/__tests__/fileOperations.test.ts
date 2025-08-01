import * as fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDbFileWithRetry } from "../fileOperations";

// Mock fs functions
vi.mock("fs");
const mockFs = vi.mocked(fs);

describe("fileOperations", () => {
  const testDbPath = "/test/path/romper.sqlite";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.stubGlobal("console", {
      log: vi.fn(),
      error: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("deleteDbFileWithRetry", () => {
    it("should delete file successfully on first attempt", async () => {
      mockFs.unlinkSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false);

      await expect(deleteDbFileWithRetry(testDbPath)).resolves.toBeUndefined();
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(testDbPath);
      expect(mockFs.existsSync).toHaveBeenCalledWith(testDbPath);
    });

    it("should retry on failure and eventually succeed", async () => {
      mockFs.unlinkSync
        .mockImplementationOnce(() => {
          throw new Error("File in use");
        })
        .mockImplementationOnce(() => {});
      mockFs.existsSync.mockReturnValue(false);

      await expect(deleteDbFileWithRetry(testDbPath)).resolves.toBeUndefined();
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it("should attempt rename on Windows when deletion fails", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false);

      await expect(
        deleteDbFileWithRetry(testDbPath, 1),
      ).resolves.toBeUndefined();
      expect(mockFs.renameSync).toHaveBeenCalled();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should throw error after max retries", async () => {
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("Persistent error");
      });
      mockFs.existsSync.mockReturnValue(true);

      await expect(deleteDbFileWithRetry(testDbPath, 2)).rejects.toThrow();
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it("should handle file still existing after deletion", async () => {
      mockFs.unlinkSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValue(false);

      await expect(
        deleteDbFileWithRetry(testDbPath, 2),
      ).resolves.toBeUndefined();
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it("should handle Windows with delays between retries", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });
      vi.useFakeTimers();

      // Mock first deletion attempt to fail, then second deletion succeeds
      mockFs.unlinkSync
        .mockImplementationOnce(() => {
          throw new Error("File in use");
        })
        .mockImplementationOnce(() => {});

      // Mock rename to fail so it continues to retry logic
      mockFs.renameSync.mockImplementation(() => {
        throw new Error("Rename failed");
      });

      mockFs.existsSync.mockReturnValue(false);

      const deletePromise = deleteDbFileWithRetry(testDbPath, 2);

      // Fast-forward through all the Windows delays:
      // - First attempt fails immediately (i=0, no delay)
      // - Windows delay before retry: 200 * 1 = 200ms (line 22)
      // - Rename fails, so waits: 500 * (0+1) = 500ms (line 60)
      await vi.advanceTimersByTimeAsync(800);

      await expect(deletePromise).resolves.toBeUndefined();
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should handle rename failures on Windows", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });
      vi.useFakeTimers();

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      // Mock rename to fail during retry attempts, but succeed on final attempt
      mockFs.renameSync
        .mockImplementationOnce(() => {
          throw new Error("Rename failed");
        })
        .mockImplementationOnce(() => {
          throw new Error("Rename failed");
        })
        .mockImplementationOnce(() => {}); // Final rename succeeds
      mockFs.existsSync.mockReturnValue(false); // File gone after final rename

      const deletePromise = deleteDbFileWithRetry(testDbPath, 2);

      // Fast-forward through the retry delays:
      // - First attempt: unlink fails, rename fails, wait 500ms (i=0)
      // - Second attempt: delay 200ms, unlink fails, rename fails, wait 1000ms (i=1)
      // - Final rename attempt succeeds
      await vi.advanceTimersByTimeAsync(2000);

      await expect(deletePromise).resolves.toBeUndefined();

      vi.useRealTimers();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should handle rename failure with file still existing", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(true); // File still exists after rename

      await expect(deleteDbFileWithRetry(testDbPath, 1)).rejects.toThrow();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should handle final Windows rename as last resort", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync
        .mockImplementationOnce(() => {
          throw new Error("First rename failed");
        })
        .mockImplementationOnce(() => {}); // Final rename succeeds
      mockFs.existsSync.mockReturnValue(false);

      await expect(
        deleteDbFileWithRetry(testDbPath, 1),
      ).resolves.toBeUndefined();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should handle final Windows rename failure", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {
        throw new Error("Rename failed");
      });
      mockFs.existsSync.mockReturnValue(true);

      // The function should reach the final Windows rename logic after the retry loop
      // When the final rename also fails, it should resolve due to the catch block at line 81
      await expect(
        deleteDbFileWithRetry(testDbPath, 1),
      ).resolves.toBeUndefined();

      // Verify that final rename was attempted
      expect(mockFs.renameSync).toHaveBeenCalled();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should wait between retries on non-Windows platforms", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });
      vi.useFakeTimers();

      mockFs.unlinkSync
        .mockImplementationOnce(() => {
          throw new Error("File in use");
        })
        .mockImplementationOnce(() => {});
      mockFs.existsSync.mockReturnValue(false);

      const deletePromise = deleteDbFileWithRetry(testDbPath, 2);

      // Fast-forward through the non-Windows delay
      await vi.advanceTimersByTimeAsync(100);

      await expect(deletePromise).resolves.toBeUndefined();

      vi.useRealTimers();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });
});
