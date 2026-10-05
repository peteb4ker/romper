import * as fs from "node:fs";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      copyFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock("node:path", () => ({
  dirname: vi.fn(),
  join: vi.fn(),
}));

// What the card already holds has its own tests (cardFileMatch)
vi.mock("../../cardFileMatch.js", () => ({
  cardFileMatches: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../formatConverter.js", () => ({
  convertToRampleDefault: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../syncProgressManager.js", () => ({
  syncProgressManager: {
    emitErrorProgress: vi.fn(),
    emitFileCompletionProgress: vi.fn(),
    emitFileStartProgress: vi.fn(),
    getCurrentSyncJob: vi.fn().mockReturnValue({ cancelled: false }),
  },
}));

vi.mock("../syncValidationService.js", () => ({
  syncValidationService: {
    addValidationError: vi.fn(),
    categorizeError: vi.fn().mockReturnValue({
      canRetry: true,
      type: "unknown",
      userMessage: "Error",
    }),
    validateSampleFormat: vi
      .fn()
      .mockResolvedValue({ data: { issues: [] }, success: true }),
    validateSyncSourceFile: vi
      .fn()
      .mockResolvedValue({ fileSize: 1024, isValid: true }),
  },
}));

import { cardFileMatches } from "../../cardFileMatch.js";
import { convertToRampleDefault } from "../../formatConverter.js";
import {
  CARD_OPERATION_TIMEOUT_MS,
  CardNotRespondingError,
  cardWatchdogSettings,
} from "../cardWatchdog.js";
import {
  type SyncFileOperation,
  syncFileOperationsService,
} from "../syncFileOperations.js";
import { syncProgressManager } from "../syncProgressManager.js";
import { syncValidationService } from "../syncValidationService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockConvertToRampleDefault = vi.mocked(convertToRampleDefault);
const mockCardFileMatches = vi.mocked(cardFileMatches);
const _mockSyncProgressManager = vi.mocked(syncProgressManager);
const _mockSyncValidationService = vi.mocked(syncValidationService);

describe("[UC-34] SyncFileOperationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureDestinationDirectory", () => {
    it("creates the destination folder, with any missing parents", async () => {
      mockPath.dirname.mockReturnValue("/path/to/dir");

      await syncFileOperationsService.ensureDestinationDirectory(
        "/path/to/dir/file.wav",
      );

      expect(mockPath.dirname).toHaveBeenCalledWith("/path/to/dir/file.wav");
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith("/path/to/dir", {
        recursive: true,
      });
    });
  });

  describe("executeFileOperation", () => {
    const fileOp = {
      destinationPath: "/dest/file.wav",
      filename: "file.wav",
      kitName: "TestKit",
      operation: "copy" as const,
      sourcePath: "/source/file.wav",
    } as SyncFileOperation;

    it("should copy file for copy operation", async () => {
      await syncFileOperationsService.executeFileOperation(fileOp, {});

      expect(mockFs.promises.copyFile).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
      );
    });

    it("doesn't copy a file the card already holds byte for byte (#650)", async () => {
      mockCardFileMatches.mockResolvedValueOnce(true);

      await syncFileOperationsService.executeFileOperation(fileOp, {});

      expect(mockCardFileMatches).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
      );
      expect(mockFs.promises.copyFile).not.toHaveBeenCalled();
    });

    it("should handle file conversion for convert operation", async () => {
      const convertOp = { ...fileOp, operation: "convert" as const };
      mockConvertToRampleDefault.mockResolvedValue({ success: true });

      await syncFileOperationsService.executeFileOperation(convertOp, {});

      expect(mockConvertToRampleDefault).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
        false,
        undefined,
      );
    });

    it("should use mono conversion when forceMonoConversion is set on file operation", async () => {
      const convertOp = {
        ...fileOp,
        forceMonoConversion: true,
        operation: "convert" as const,
      };
      mockConvertToRampleDefault.mockResolvedValue({ success: true });

      await syncFileOperationsService.executeFileOperation(convertOp, {});

      expect(mockConvertToRampleDefault).toHaveBeenCalledWith(
        "/source/file.wav",
        "/dest/file.wav",
        true,
        undefined,
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
    } as SyncFileOperation;

    it("should successfully convert file", async () => {
      mockConvertToRampleDefault.mockResolvedValue({ success: true });

      await expect(
        syncFileOperationsService.executeFileOperation(fileOp, {}),
      ).resolves.not.toThrow();

      expect(mockConvertToRampleDefault).toHaveBeenCalled();
    });

    it("never copies a file it failed to convert (RE-08)", async () => {
      mockConvertToRampleDefault.mockResolvedValue({
        error: "Unsupported WAV encoding (format 0x0002)",
        success: false,
      });

      await expect(
        syncFileOperationsService.executeFileOperation(fileOp, {}),
      ).rejects.toThrow("Failed to convert file.wav");
      expect(mockFs.promises.copyFile).not.toHaveBeenCalled();
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
  });

  describe("handleFileProcessingError", () => {
    const fileOp = {
      destinationPath: "/dest/file.wav",
      filename: "file.wav",
      kitName: "TestKit",
      operation: "copy" as const,
      sourcePath: "/source/file.wav",
    } as SyncFileOperation;

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
    } as SyncFileOperation;

    it("should handle file processing", async () => {
      mockPath.dirname.mockReturnValue("/dest");

      // Should handle file processing without throwing
      await expect(
        syncFileOperationsService.processSingleFile(fileOp, 1, 2, {}),
      ).resolves.not.toThrow();
    });

    it("[UC-34] fails when the card stops responding (#653)", async () => {
      mockPath.dirname.mockReturnValue("/dest");
      vi.mocked(mockFs.promises.copyFile).mockReturnValueOnce(
        new Promise<void>(() => undefined),
      );
      cardWatchdogSettings.timeoutMs = 20;
      try {
        await expect(
          syncFileOperationsService.processSingleFile(fileOp, 1, 2, {}),
        ).rejects.toThrow(CardNotRespondingError);
        expect(
          syncProgressManager.emitFileCompletionProgress,
        ).not.toHaveBeenCalled();
      } finally {
        cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
      }
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
    ] as SyncFileOperation[];

    it("should handle file processing", async () => {
      mockPath.dirname.mockReturnValue("/dest");

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

    it("yields between files, so a Cancel sent mid-sync stops it (RE-07)", async () => {
      mockPath.dirname.mockReturnValue("/dest");
      const job = { cancelled: false };
      vi.mocked(syncProgressManager.getCurrentSyncJob).mockReturnValue(
        job as never,
      );
      const threeFiles = [1, 2, 3].map((n) => ({
        ...fileOps[0],
        destinationPath: `/dest/file${n}.wav`,
        filename: `file${n}.wav`,
      }));

      // Stands in for the cancelKitSync IPC message: it can only be handled
      // if the loop gives the event loop a turn.
      setImmediate(() => {
        job.cancelled = true;
      });
      const synced = await syncFileOperationsService.processAllFiles(
        threeFiles,
        {},
      );

      expect(synced).toBe(1);
      expect(mockFs.promises.copyFile).toHaveBeenCalledTimes(1);
      vi.mocked(syncProgressManager.getCurrentSyncJob).mockReturnValue({
        cancelled: false,
      } as never);
    });
  });

  describe("categorizeSyncFileOperation", () => {
    it("lists an unusable file as a sample that can't be written (RE-08)", async () => {
      vi.mocked(
        syncValidationService.validateSampleFormat,
      ).mockResolvedValueOnce({
        data: {
          issues: [
            {
              message:
                "Unable to read audio file: Unsupported WAV encoding (format 0x0002)",
              type: "fileAccess",
            },
          ],
          isValid: false,
        },
        success: true,
      });
      const results = {
        filesToConvert: [],
        filesToCopy: [],
        hasFormatWarnings: false,
        validationErrors: [],
        warnings: [],
      };

      await syncFileOperationsService.categorizeSyncFileOperation(
        { filename: "adpcm.wav", voice_number: 1 } as never,
        "adpcm.wav",
        "/src/adpcm.wav",
        "/dest/1-01 adpcm.wav",
        results,
      );

      expect(results.filesToConvert).toEqual([]);
      expect(results.filesToCopy).toEqual([]);
      expect(results.validationErrors).toEqual([
        {
          error:
            "Unable to read audio file: Unsupported WAV encoding (format 0x0002)",
          filename: "adpcm.wav",
          sourcePath: "/src/adpcm.wav",
          type: "invalid_format",
          // Its kit is quarantined rather than written without it (#537)
          unreadable: true,
        },
      ]);
    });

    it("converts a readable file with format issues", async () => {
      vi.mocked(
        syncValidationService.validateSampleFormat,
      ).mockResolvedValueOnce({
        data: {
          issues: [
            {
              message: "The file has an extended WAV header",
              type: "encoding",
            },
          ],
          isValid: false,
        },
        success: true,
      });
      const results = {
        filesToConvert: [],
        filesToCopy: [],
        hasFormatWarnings: false,
        validationErrors: [],
        warnings: [],
      };

      await syncFileOperationsService.categorizeSyncFileOperation(
        { filename: "ext.wav", voice_number: 1 } as never,
        "ext.wav",
        "/src/ext.wav",
        "/dest/1-01 ext.wav",
        results,
      );

      expect(results.validationErrors).toEqual([]);
      expect(results.filesToConvert).toHaveLength(1);
    });

    it("[Q-01] doesn't check the source again: planning already has", async () => {
      const results = {
        filesToConvert: [],
        filesToCopy: [],
        hasFormatWarnings: false,
        validationErrors: [],
        warnings: [],
      };

      await syncFileOperationsService.categorizeSyncFileOperation(
        { filename: "ok.wav", voice_number: 1 } as never,
        "ok.wav",
        "/src/ok.wav",
        "/dest/1-01 ok.wav",
        results,
      );

      expect(
        syncValidationService.validateSyncSourceFile,
      ).not.toHaveBeenCalled();
      expect(results.filesToCopy).toHaveLength(1);
    });

    it("should be a function", () => {
      expect(typeof syncFileOperationsService.categorizeSyncFileOperation).toBe(
        "function",
      );
    });
  });
});
