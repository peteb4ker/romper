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
    vi.stubGlobal("console", {
      log: vi.fn(),
      error: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
  });
});
