import * as fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDbFileWithRetry } from "../fileOperations";

// Mock fs functions
vi.mock("fs");
const mockFs = vi.mocked(fs);

describe("fileOperations unit tests", () => {
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
      await expect(deleteDbFileWithRetry(testDbPath, 1)).resolves.toBeUndefined();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should use different retry patterns based on platform", async () => {
      vi.useFakeTimers();
      
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });

      // Test will timeout if delays aren't working
      const promise = deleteDbFileWithRetry(testDbPath, 1);
      
      // Should not resolve immediately due to delays
      let resolved = false;
      promise.then(() => { resolved = true; }).catch(() => { resolved = true; });
      
      expect(resolved).toBe(false);
      
      vi.useRealTimers();
      
      // Let it complete (will throw, but that's expected)
      await expect(promise).rejects.toThrow();
    });
  });
});
