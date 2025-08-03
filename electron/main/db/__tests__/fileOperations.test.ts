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
    it("should successfully remove file when deletion works", async () => {
      // Setup: file exists, can be deleted, and is gone after deletion
      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValue(false);
      mockFs.unlinkSync.mockImplementation(() => {});

      // Act & Assert: function completes without error
      await expect(deleteDbFileWithRetry(testDbPath)).resolves.toBeUndefined();

      // Verify outcome: file removal was attempted
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(testDbPath);
    });

    it("should eventually succeed after transient failures", async () => {
      // Setup: first attempts fail, then succeeds
      let attempts = 0;
      mockFs.unlinkSync.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error("File in use");
        }
      });
      mockFs.existsSync.mockReturnValue(false);

      // Act & Assert: function eventually succeeds
      await expect(deleteDbFileWithRetry(testDbPath)).resolves.toBeUndefined();

      // Verify outcome: multiple attempts were made
      expect(attempts).toBeGreaterThan(1);
    });

    it("should remove file using fallback strategies on Windows", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      // Setup: deletion always fails, but rename works
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false); // File gone after rename

      // Act & Assert: function succeeds despite delete failure
      await expect(
        deleteDbFileWithRetry(testDbPath, 2),
      ).resolves.toBeUndefined();

      // Verify outcome: some method was used to remove the file
      expect(mockFs.existsSync).toHaveBeenCalled();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should fail when file cannot be removed after all attempts", async () => {
      // Setup: all operations fail persistently
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("Persistent error");
      });
      mockFs.renameSync.mockImplementation(() => {
        throw new Error("Rename also fails");
      });
      mockFs.existsSync.mockReturnValue(true); // File always exists

      // Act & Assert: function throws after exhausting retries
      await expect(deleteDbFileWithRetry(testDbPath, 2)).rejects.toThrow();
    });

    it("should retry when file persists after deletion attempt", async () => {
      // Setup: deletion appears to work but file still exists first time
      let checkCount = 0;
      mockFs.unlinkSync.mockImplementation(() => {});
      mockFs.existsSync.mockImplementation(() => {
        checkCount++;
        return checkCount === 1; // File exists on first check only
      });

      // Act & Assert: function eventually succeeds
      await expect(
        deleteDbFileWithRetry(testDbPath, 3),
      ).resolves.toBeUndefined();

      // Verify outcome: multiple checks were made
      expect(checkCount).toBeGreaterThan(1);
    });

    it("should succeed with appropriate delays on Windows", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });
      vi.useFakeTimers();

      // Setup: first attempt fails, second succeeds
      let deleteAttempts = 0;
      mockFs.unlinkSync.mockImplementation(() => {
        deleteAttempts++;
        if (deleteAttempts === 1) {
          throw new Error("File in use");
        }
      });
      mockFs.renameSync.mockImplementation(() => {
        throw new Error("Rename failed");
      });
      mockFs.existsSync.mockReturnValue(false);

      // Act: start the operation
      const deletePromise = deleteDbFileWithRetry(testDbPath, 3);

      // Assert: should not complete immediately (verifies delays are used)
      let completed = false;
      deletePromise.then(() => {
        completed = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(completed).toBe(false);

      // Fast-forward enough time for retries with delays
      await vi.advanceTimersByTimeAsync(5000);

      // Verify: operation eventually succeeds
      await expect(deletePromise).resolves.toBeUndefined();
      expect(deleteAttempts).toBeGreaterThan(1);

      vi.useRealTimers();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should eventually succeed on Windows despite multiple rename failures", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });
      vi.useFakeTimers();

      // Setup: delete always fails, rename fails twice then succeeds
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      let renameAttempts = 0;
      mockFs.renameSync.mockImplementation(() => {
        renameAttempts++;
        if (renameAttempts < 3) {
          throw new Error("Rename failed");
        }
        // Third attempt succeeds
      });
      mockFs.existsSync.mockReturnValue(false);

      // Act: run with enough retries
      const deletePromise = deleteDbFileWithRetry(testDbPath, 3);

      // Allow time for retries
      await vi.advanceTimersByTimeAsync(10000);

      // Assert: eventually succeeds
      await expect(deletePromise).resolves.toBeUndefined();
      expect(renameAttempts).toBeGreaterThanOrEqual(3);

      vi.useRealTimers();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should complete on Windows even when file persists after rename", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      // Setup: delete fails, rename appears to work but file persists
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {}); // No error
      mockFs.existsSync.mockReturnValue(true); // But file still exists

      // Act & Assert: Windows implementation returns even if file persists
      // This is the actual behavior - it logs an error but doesn't throw
      await expect(
        deleteDbFileWithRetry(testDbPath, 2),
      ).resolves.toBeUndefined();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should succeed using final fallback strategy on Windows", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      // Setup: all regular attempts fail, but final strategy works
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      let totalRenameAttempts = 0;
      mockFs.renameSync.mockImplementation(() => {
        totalRenameAttempts++;
        if (totalRenameAttempts === 1) {
          throw new Error("First rename failed");
        }
        // Last rename succeeds
      });
      mockFs.existsSync.mockReturnValue(false);

      // Act & Assert: should succeed via fallback
      await expect(
        deleteDbFileWithRetry(testDbPath, 1),
      ).resolves.toBeUndefined();

      // Verify: at least one rename strategy was attempted
      expect(totalRenameAttempts).toBeGreaterThanOrEqual(1);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should gracefully handle total failure on Windows", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      // Setup: everything fails
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File in use");
      });
      mockFs.renameSync.mockImplementation(() => {
        throw new Error("All rename attempts failed");
      });
      mockFs.existsSync.mockReturnValue(true);

      // Act: run with minimal retries
      const result = deleteDbFileWithRetry(testDbPath, 1);

      // Assert: behavior depends on implementation
      // Current implementation resolves even on total failure (line 83)
      // This test documents that behavior
      await expect(result).resolves.toBeUndefined();

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should succeed with delays on non-Windows platforms", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });
      vi.useFakeTimers();

      // Setup: first fails, second succeeds
      let attempts = 0;
      mockFs.unlinkSync.mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error("File in use");
        }
      });
      mockFs.existsSync.mockReturnValue(false);

      // Act: start operation
      const deletePromise = deleteDbFileWithRetry(testDbPath, 2);

      // Assert: doesn't complete instantly (has delays)
      let completed = false;
      deletePromise.then(() => {
        completed = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(completed).toBe(false);

      // Allow time for delays
      await vi.advanceTimersByTimeAsync(1000);

      // Verify: eventually succeeds
      await expect(deletePromise).resolves.toBeUndefined();
      expect(attempts).toBe(2);

      vi.useRealTimers();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });
});
