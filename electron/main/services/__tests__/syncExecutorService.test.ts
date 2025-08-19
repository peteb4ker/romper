import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("fs", () => ({
  copyFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  dirname: vi.fn(),
  join: vi.fn((...args) => args.join("/")),
}));

// Mock format converter
vi.mock("../../formatConverter.js", () => ({
  convertToRampleDefault: vi.fn(),
}));

import { convertToRampleDefault } from "../../formatConverter.js";
import {
  SyncExecutorService,
  type SyncFileOperation,
} from "../syncExecutorService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockConvertToRampleDefault = vi.mocked(convertToRampleDefault);

describe("SyncExecutorService", () => {
  let service: SyncExecutorService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncExecutorService();
  });

  describe("executeFileOperation", () => {
    const mockCopyOperation: SyncFileOperation = {
      destinationPath: "/dest/kit/1/test.wav",
      filename: "test.wav",
      kitName: "TestKit",
      operation: "copy",
      sourcePath: "/source/test.wav",
    };

    const mockConvertOperation: SyncFileOperation = {
      destinationPath: "/dest/kit/1/test.wav",
      filename: "test.wav",
      kitName: "TestKit",
      operation: "convert",
      originalFormat: "24bit/48000Hz",
      reason: "Format conversion required",
      sourcePath: "/source/test.wav",
      targetFormat: "16bit/44100Hz WAV",
    };

    it("should successfully execute copy operation", async () => {
      mockPath.dirname.mockReturnValue("/dest/kit/1");
      mockFs.existsSync.mockReturnValueOnce(true); // dest dir exists
      mockFs.existsSync.mockReturnValueOnce(true); // source file exists
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const result = await service.executeFileOperation(mockCopyOperation);

      expect(result.success).toBe(true);
      expect(result.data?.bytesTransferred).toBe(1024);
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        "/source/test.wav",
        "/dest/kit/1/test.wav"
      );
    });

    it("should create destination directory if it doesn't exist", async () => {
      mockPath.dirname.mockReturnValue("/dest/kit/1");
      mockFs.existsSync.mockReturnValueOnce(false); // dest dir doesn't exist
      mockFs.existsSync.mockReturnValueOnce(true); // source file exists
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const result = await service.executeFileOperation(mockCopyOperation);

      expect(result.success).toBe(true);
      expect(mockFs.mkdirSync).toHaveBeenCalledWith("/dest/kit/1", {
        recursive: true,
      });
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    it("should successfully execute convert operation", async () => {
      mockPath.dirname.mockReturnValue("/dest/kit/1");
      mockFs.existsSync.mockReturnValueOnce(true); // dest dir exists
      mockFs.existsSync.mockReturnValueOnce(true); // converted file exists
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      mockConvertToRampleDefault.mockResolvedValue({
        data: { outputPath: "/dest/kit/1/test.wav" },
        success: true,
      });

      const result = await service.executeFileOperation(
        mockConvertOperation,
        false
      );

      expect(result.success).toBe(true);
      expect(result.data?.bytesTransferred).toBe(2048);
      expect(mockConvertToRampleDefault).toHaveBeenCalledWith(
        "/source/test.wav",
        "/dest/kit/1/test.wav",
        false
      );
    });

    it("should pass mono conversion flag correctly", async () => {
      mockPath.dirname.mockReturnValue("/dest/kit/1");
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      mockConvertToRampleDefault.mockResolvedValue({
        data: { outputPath: "/dest/kit/1/test.wav" },
        success: true,
      });

      await service.executeFileOperation(mockConvertOperation, true);

      expect(mockConvertToRampleDefault).toHaveBeenCalledWith(
        "/source/test.wav",
        "/dest/kit/1/test.wav",
        true
      );
    });

    it("should handle conversion failure", async () => {
      mockPath.dirname.mockReturnValue("/dest/kit/1");
      mockFs.existsSync.mockReturnValue(true);

      mockConvertToRampleDefault.mockResolvedValue({
        error: "Invalid audio format",
        success: false,
      });

      const result = await service.executeFileOperation(mockConvertOperation);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to convert test.wav");
      expect(result.error).toContain("Invalid audio format");
    });

    it("should handle file system errors", async () => {
      mockPath.dirname.mockReturnValue("/dest/kit/1");
      mockFs.existsSync.mockReturnValue(true);
      mockFs.copyFileSync.mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const result = await service.executeFileOperation(mockCopyOperation);

      expect(result.success).toBe(false);
      expect(result.error).toContain("test.wav");
      expect(result.error).toContain("Permission denied");
    });
  });

  describe("getFileSize", () => {
    it("should return file size when file exists", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const size = service.getFileSize("/test/file.wav");

      expect(size).toBe(1024);
      expect(mockFs.existsSync).toHaveBeenCalledWith("/test/file.wav");
      expect(mockFs.statSync).toHaveBeenCalledWith("/test/file.wav");
    });

    it("should return 0 when file doesn't exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const size = service.getFileSize("/test/missing.wav");

      expect(size).toBe(0);
      expect(mockFs.statSync).not.toHaveBeenCalled();
    });

    it("should return 0 and warn on error", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const size = service.getFileSize("/test/error.wav");

      expect(size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to get file size for /test/error.wav:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("calculateTotalSize", () => {
    it("should calculate total size for multiple files", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/file1.wav",
          filename: "file1.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/file1.wav",
        },
        {
          destinationPath: "/dest/file2.wav",
          filename: "file2.wav",
          kitName: "Kit2",
          operation: "convert",
          sourcePath: "/source/file2.wav",
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync
        .mockReturnValueOnce({ size: 1024 } as any)
        .mockReturnValueOnce({ size: 2048 } as any);

      const totalSize = service.calculateTotalSize(fileOperations);

      expect(totalSize).toBe(3072);
    });

    it("should handle missing files in calculation", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/existing.wav",
          filename: "existing.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/existing.wav",
        },
        {
          destinationPath: "/dest/missing.wav",
          filename: "missing.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/missing.wav",
        },
      ];

      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const totalSize = service.calculateTotalSize(fileOperations);

      expect(totalSize).toBe(1024); // Only existing file counted
    });
  });

  describe("categorizeError", () => {
    it("should categorize file not found errors", () => {
      const error = new Error("ENOENT: no such file or directory");
      const result = service.categorizeError(error, "/test/file.wav");

      expect(result.type).toBe("file_access");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toBe("Source file not found: /test/file.wav");
    });

    it("should categorize permission errors", () => {
      const error = new Error("EACCES: permission denied");
      const result = service.categorizeError(error);

      expect(result.type).toBe("permission");
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toBe(
        "Permission denied. Check file/folder permissions."
      );
    });

    it("should categorize disk space errors", () => {
      const error = new Error("ENOSPC: no space left on device");
      const result = service.categorizeError(error);

      expect(result.type).toBe("disk_space");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toBe(
        "Not enough disk space on destination drive."
      );
    });

    it("should categorize format errors", () => {
      const error = new Error("Invalid WAV format header");
      const result = service.categorizeError(error);

      expect(result.type).toBe("format_error");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toBe(
        "Audio format error: Invalid WAV format header"
      );
    });

    it("should categorize network errors", () => {
      const error = new Error("Network connection timeout");
      const result = service.categorizeError(error);

      expect(result.type).toBe("network");
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toBe(
        "Network error. Check connection and try again."
      );
    });

    it("should categorize unknown errors", () => {
      const error = new Error("Something unexpected happened");
      const result = service.categorizeError(error);

      expect(result.type).toBe("unknown");
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toBe(
        "Unexpected error: Something unexpected happened"
      );
    });

    it("should handle non-Error objects", () => {
      const error = "String error message";
      const result = service.categorizeError(error);

      expect(result.type).toBe("unknown");
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toBe("Unexpected error: String error message");
    });
  });
});
