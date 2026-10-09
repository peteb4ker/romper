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

vi.mock("../sdCardSafety.js", () => ({
  reachesDeviceSaveFolder: vi.fn().mockReturnValue(false),
  removeAppleDoubleCompanion: vi.fn().mockResolvedValue(undefined),
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
    // A native file: 16-bit, 44.1 kHz mono, 0.1 s
    validateSampleFormat: vi.fn().mockResolvedValue({
      data: {
        issues: [],
        metadata: {
          bitDepth: 16,
          channels: 1,
          encoding: "pcm",
          extensible: false,
          frames: 4410,
          sampleRate: 44100,
        },
      },
      success: true,
    }),
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
  reachesDeviceSaveFolder,
  removeAppleDoubleCompanion,
} from "../sdCardSafety.js";
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

    it("[UC-34] removes the ._ file macOS makes beside each written file (#653)", async () => {
      mockPath.dirname.mockReturnValue("/dest");

      await syncFileOperationsService.processSingleFile(fileOp, 1, 2, {});

      expect(removeAppleDoubleCompanion).toHaveBeenCalledWith("/dest/file.wav");
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

    it("[Q-04] [UC-34] refuses to write anything when a file would land in _save (#787)", async () => {
      mockPath.dirname.mockReturnValue("/card/_save");
      vi.mocked(reachesDeviceSaveFolder).mockImplementation(
        (_card, destination) => destination.startsWith("/card/_save/"),
      );
      const intoSave = [
        { ...fileOps[0], destinationPath: "/card/A0/1-01 kick.wav" },
        { ...fileOps[0], destinationPath: "/card/_save/A0.rpl" },
      ];

      try {
        await expect(
          syncFileOperationsService.processAllFiles(intoSave, {}, "/card"),
        ).rejects.toThrow(/_save folder belongs to the device/);
        expect(reachesDeviceSaveFolder).toHaveBeenCalledWith(
          "/card",
          "/card/_save/A0.rpl",
        );
        // Not even the allowed file is written
        expect(mockFs.promises.copyFile).not.toHaveBeenCalled();
        expect(mockFs.promises.mkdir).not.toHaveBeenCalled();
      } finally {
        vi.mocked(reachesDeviceSaveFolder).mockReturnValue(false);
      }
    });

    it("checks every destination against _save when writing to a card", async () => {
      mockPath.dirname.mockReturnValue("/card/A0");
      const toCard = [
        { ...fileOps[0], destinationPath: "/card/A0/1-01 kick.wav" },
      ];

      const synced = await syncFileOperationsService.processAllFiles(
        toCard,
        {},
        "/card",
      );

      expect(synced).toBe(1);
      expect(reachesDeviceSaveFolder).toHaveBeenCalledWith(
        "/card",
        "/card/A0/1-01 kick.wav",
      );
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
          metadata: {
            bitDepth: 16,
            channels: 1,
            encoding: "pcm",
            extensible: true,
            frames: 4410,
            sampleRate: 44100,
          },
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
      expect(results.filesToConvert[0]).toMatchObject({
        conversion: "format",
        operation: "convert",
      });
    });

    describe("[UC-34] [Q-08] the shared format rule (#576)", () => {
      const emptyResults = () => ({
        filesToConvert: [] as SyncFileOperation[],
        filesToCopy: [] as SyncFileOperation[],
        hasFormatWarnings: false,
        validationErrors: [],
        warnings: [],
      });
      const plan = async (
        sample: Record<string, unknown>,
        metadata?: Record<string, unknown>,
      ) => {
        if (metadata) {
          vi.mocked(
            syncValidationService.validateSampleFormat,
          ).mockResolvedValueOnce({
            data: { issues: [], isValid: true, metadata },
            success: true,
          });
        }
        const results = emptyResults();
        await syncFileOperationsService.categorizeSyncFileOperation(
          { filename: "s.wav", voice_number: 1, ...sample } as never,
          "s.wav",
          "/src/s.wav",
          "/dest/1-01 s.wav",
          results,
        );
        return results;
      };
      const native = {
        bitDepth: 16,
        channels: 1,
        encoding: "pcm",
        extensible: false,
        sampleRate: 44100,
      };

      it("copies a native file as it is", async () => {
        const results = await plan({ gain_db: 0 });
        expect(results.filesToCopy).toEqual([
          expect.objectContaining({ conversion: null, operation: "copy" }),
        ]);
      });

      it("converts a native file with a gain adjustment, for gain", async () => {
        const results = await plan({ gain_db: -6 });
        expect(results.filesToCopy).toEqual([]);
        expect(results.filesToConvert).toEqual([
          expect.objectContaining({
            conversion: "gain",
            gainDb: -6,
            operation: "convert",
          }),
        ]);
      });

      it("counts a file needing both as a format conversion", async () => {
        const results = await plan(
          { gain_db: 3 },
          { ...native, frames: 4800, sampleRate: 48000 },
        );
        expect(results.filesToConvert).toEqual([
          expect.objectContaining({ conversion: "format" }),
        ]);
      });

      it("marks a file shorter than 50 ms, but not one of exactly 50 ms", async () => {
        // 20 ms, 50 ms and 49.98 ms at 44.1 kHz
        const short = await plan({}, { ...native, frames: 882 });
        const exact = await plan({}, { ...native, frames: 2205 });
        const justUnder = await plan({}, { ...native, frames: 2204 });
        expect(short.filesToCopy[0].tooShort).toBe(true);
        expect(exact.filesToCopy[0].tooShort).toBe(false);
        expect(justUnder.filesToCopy[0].tooShort).toBe(true);
      });
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
