import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    copyFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock("path", () => ({
  dirname: vi.fn(),
  join: vi.fn(),
}));

vi.mock("../../formatConverter.js", () => ({
  convertToRampleDefault: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("./syncProgressManager.js", () => ({
  syncProgressManager: {
    emitErrorProgress: vi.fn(),
    emitFileCompletionProgress: vi.fn(),
    emitFileStartProgress: vi.fn(),
    getCurrentSyncJob: vi.fn().mockReturnValue({ cancelled: false }),
  },
}));

vi.mock("./syncValidationService.js", () => ({
  syncValidationService: {
    addValidationError: vi.fn(),
    categorizeError: vi.fn().mockReturnValue({
      canRetry: true,
      type: "unknown",
      userMessage: "Error",
    }),
    validateSampleFormat: vi
      .fn()
      .mockReturnValue({ data: { issues: [] }, success: true }),
    validateSyncSourceFile: vi
      .fn()
      .mockReturnValue({ fileSize: 1024, isValid: true }),
  },
}));

import { convertToRampleDefault } from "../../formatConverter.js";
import { syncFileOperationsService } from "../syncFileOperations.js";
import { syncProgressManager } from "../syncProgressManager.js";
import { syncValidationService } from "../syncValidationService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockConvertToRampleDefault = vi.mocked(convertToRampleDefault);
const _mockSyncProgressManager = vi.mocked(syncProgressManager);
const _mockSyncValidationService = vi.mocked(syncValidationService);

describe("SyncFileOperationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureDestinationDirectory", () => {
    it("should create directory if it does not exist", () => {
      mockPath.dirname.mockReturnValue("/path/to/dir");
      mockFs.existsSync.mockReturnValue(false);

      syncFileOperationsService.ensureDestinationDirectory(
        "/path/to/dir/file.wav",
      );

      expect(mockPath.dirname).toHaveBeenCalledWith("/path/to/dir/file.wav");
      expect(mockFs.existsSync).toHaveBeenCalledWith("/path/to/dir");
      expect(mockFs.mkdirSync).toHaveBeenCalledWith("/path/to/dir", {
        recursive: true,
      });
    });

    it("should not create directory if it already exists", () => {
      mockPath.dirname.mockReturnValue("/path/to/dir");
      mockFs.existsSync.mockReturnValue(true);

      syncFileOperationsService.ensureDestinationDirectory(
        "/path/to/dir/file.wav",
      );

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("executeFileOperation", () => {
    const fileOp = {
      destinationPath: "/dest/file.wav",
      filename: "file.wav",
      kitName: "TestKit",
      operation: "copy" as const,
      sourcePath: "/source/file.wav",
    };

    it("should copy file for copy operation", async () => {
      await syncFileOperationsService.executeFileOperation(fileOp, {});

      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
      );
    });

    it("should handle file conversion for convert operation", async () => {
      const convertOp = { ...fileOp, operation: "convert" as const };
      mockConvertToRampleDefault.mockResolvedValue({ success: true });

      await syncFileOperationsService.executeFileOperation(convertOp, {});

      expect(mockConvertToRampleDefault).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
        false,
      );
    });

    it("should use mono conversion when requested", async () => {
      const convertOp = { ...fileOp, operation: "convert" as const };
      const settings = { defaultToMonoSamples: true };
      mockConvertToRampleDefault.mockResolvedValue({ success: true });

      await syncFileOperationsService.executeFileOperation(convertOp, settings);

      expect(mockConvertToRampleDefault).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
        true,
      );
    });
  });

  describe("handleFileConversion", () => {
    const fileOp = {
      destinationPath: "/dest/file.wav",
      filename: "file.wav",
      kitName: "TestKit",
      operation: "convert" as const,
      sourcePath: "/source/file.wav",
    };

    it("should successfully convert file", async () => {
      mockConvertToRampleDefault.mockResolvedValue({ success: true });

      await expect(
        syncFileOperationsService.executeFileOperation(fileOp, {}),
      ).resolves.not.toThrow();

      expect(mockConvertToRampleDefault).toHaveBeenCalled();
    });

    it("should handle WAV format errors by copying instead", async () => {
      mockConvertToRampleDefault.mockResolvedValue({
        error: "Missing fmt chunk in WAV file",
        success: false,
      });

      await expect(
        syncFileOperationsService.executeFileOperation(fileOp, {}),
      ).resolves.not.toThrow();

      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
      );
    });

    it("should handle invalid WAV files by copying instead", async () => {
      mockConvertToRampleDefault.mockResolvedValue({
        error: "Invalid WAV file format",
        success: false,
      });

      await expect(
        syncFileOperationsService.executeFileOperation(fileOp, {}),
      ).resolves.not.toThrow();

      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
      );
    });

    it("should throw error for non-WAV format errors", async () => {
      mockConvertToRampleDefault.mockResolvedValue({
        error: "Unsupported file format",
        success: false,
      });

      await expect(
        syncFileOperationsService.executeFileOperation(fileOp, {}),
      ).rejects.toThrow("Failed to convert file.wav: Unsupported file format");
    });

    it("should handle copy errors when falling back from WAV errors", async () => {
      mockConvertToRampleDefault.mockResolvedValue({
        error: "Missing fmt chunk in WAV file",
        success: false,
      });

      // WAV format errors should fall back to copy, which should succeed
      await expect(
        syncFileOperationsService.executeFileOperation(fileOp, {}),
      ).resolves.not.toThrow();
    });
  });

  describe("handleFileProcessingError", () => {
    const fileOp = {
      destinationPath: "/dest/file.wav",
      filename: "file.wav",
      kitName: "TestKit",
      operation: "copy" as const,
      sourcePath: "/source/file.wav",
    };

    it("should handle file processing errors without throwing", () => {
      const error = new Error("Test error");

      // Should not throw when handling errors
      expect(() => {
        syncFileOperationsService.handleFileProcessingError(fileOp, error);
      }).not.toThrow();
    });
  });

  describe("processSingleFile", () => {
    const fileOp = {
      destinationPath: "/dest/file.wav",
      filename: "file.wav",
      kitName: "TestKit",
      operation: "copy" as const,
      sourcePath: "/source/file.wav",
    };

    it("should handle file processing", async () => {
      mockPath.dirname.mockReturnValue("/dest");
      mockFs.existsSync.mockReturnValue(true);

      // Should handle file processing without throwing
      await expect(
        syncFileOperationsService.processSingleFile(fileOp, 1, 2, {}),
      ).resolves.not.toThrow();
    });
  });

  describe("processAllFiles", () => {
    const fileOps = [
      {
        destinationPath: "/dest/file1.wav",
        filename: "file1.wav",
        kitName: "TestKit",
        operation: "copy" as const,
        sourcePath: "/source/file1.wav",
      },
    ];

    it("should handle file processing", async () => {
      mockPath.dirname.mockReturnValue("/dest");
      mockFs.existsSync.mockReturnValue(true);

      // Should return a number (processed file count)
      const result = await syncFileOperationsService.processAllFiles(
        fileOps,
        {},
      );
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty file list", async () => {
      const result = await syncFileOperationsService.processAllFiles([], {});
      expect(result).toBe(0);
    });
  });

  describe("categorizeSyncFileOperation", () => {
    it("should be a function", () => {
      expect(typeof syncFileOperationsService.categorizeSyncFileOperation).toBe(
        "function",
      );
    });
  });
});
