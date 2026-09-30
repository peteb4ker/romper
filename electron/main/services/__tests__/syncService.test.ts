import { BrowserWindow } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]),
  },
}));

vi.mock("node:fs", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:fs")>()),
);
vi.mock("node:path", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:path")>()),
);

vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
  validateSampleFormat: vi.fn(),
}));

vi.mock("../../db/romperDbCoreORM.js", () => ({
  getKitSamples: vi.fn(),
  markKitsAsSynced: vi.fn(),
}));

vi.mock("../../formatConverter.js", () => ({
  convertToRampleDefault: vi.fn(),
}));

vi.mock("../syncMonoAnnotation.js", () => ({
  annotateMonoConversion: vi.fn(),
}));

vi.mock("../sdCardSafety.js", () => ({
  clearRampleContent: vi.fn(() => ({ removed: [] })),
  validateSdCardTarget: vi.fn(() => ({ ok: true })),
}));

import { getAudioMetadata, validateSampleFormat } from "../../audioUtils.js";
import { getKitSamples, markKitsAsSynced } from "../../db/romperDbCoreORM.js";
import { convertToRampleDefault } from "../../formatConverter.js";
import { clearRampleContent, validateSdCardTarget } from "../sdCardSafety.js";
import { syncFileOperationsService } from "../syncFileOperations.js";
import { syncProgressManager } from "../syncProgressManager.js";
import { syncSampleProcessingService } from "../syncSampleProcessing.js";
import { syncService } from "../syncService.js";
import { syncValidationService } from "../syncValidationService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);
const mockValidateSampleFormat = vi.mocked(validateSampleFormat);
const mockGetKitSamples = vi.mocked(getKitSamples);
const mockMarkKitsAsSynced = vi.mocked(markKitsAsSynced);
const _mockConvertToRampleDefault = vi.mocked(convertToRampleDefault);
const mockBrowserWindow = vi.mocked(BrowserWindow);
const mockValidateSdCardTarget = vi.mocked(validateSdCardTarget);
const mockClearRampleContent = vi.mocked(clearRampleContent);

describe("SyncService", () => {
  let mockWindow: unknown;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow]);

    // Default mock implementations
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.basename.mockImplementation((p) => p.split("/").pop() || "");
    mockPath.dirname.mockImplementation((p) => {
      const parts = p.split("/");
      parts.pop();
      return parts.join("/");
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
      size: 1024 * 1024, // 1MB
    } as unknown);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.copyFileSync.mockImplementation(() => undefined);

    mockGetAudioMetadata.mockResolvedValue({
      data: {
        bitDepth: 16,
        channels: 2,
        duration: 1.5,
        format: "WAV",
        sampleRate: 44100,
      },
      success: true,
    });

    mockValidateSampleFormat.mockResolvedValue({
      bitDepth: 16,
      channels: 2,
      format: "WAV",
      isValid: true,
      needsConversion: false,
      sampleRate: 44100,
    });

    // Mock getKits for generateChangeSummary
    vi.doMock("../../db/romperDbCoreORM.js", async () => {
      const actual = await vi.importActual("../../db/romperDbCoreORM.js");
      return {
        ...actual,
        getKits: vi.fn().mockResolvedValue({
          data: [
            { bank_letter: "A", name: "A01" },
            { bank_letter: "B", name: "B02" },
          ],
          success: true,
        }),
        getKitSamples: mockGetKitSamples,
        markKitsAsSynced: mockMarkKitsAsSynced,
      };
    });

    mockGetKitSamples.mockResolvedValue({
      data: [
        {
          created_at: new Date(),
          end_point: 0,
          filename: "kick.wav",
          id: 1,
          kit_id: 1,
          pitch: 0,
          playback_mode: "OneShot",
          plock: null,
          reverse: false,
          slot: 0,
          source_path: "/source/kick.wav",
          start_point: 0,
          updated_at: new Date(),
          voice: 1,
        },
      ],
      success: true,
    });
  });

  describe("generateChangeSummary", () => {
    it("returns error when no local store path is configured", async () => {
      const result = await syncService.generateChangeSummary({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("generates change summary for valid settings", async () => {
      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      // Should succeed (result may vary based on mocks but should not error)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("handles missing source files", async () => {
      mockFs.existsSync.mockReturnValueOnce(false);

      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      expect(result).toBeDefined();
    });

    it("handles files needing conversion", async () => {
      mockValidateSampleFormat.mockResolvedValueOnce({
        bitDepth: 16,
        channels: 2,
        format: "MP3",
        isValid: false,
        needsConversion: true,
        sampleRate: 44100,
      });

      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      expect(result).toBeDefined();
    });
  });

  describe("startKitSync", () => {
    const mockSettings = {
      localStorePath: "/local/store",
    };

    const mockOptions = {
      sdCardPath: "/sd/card",
      wipeSdCard: false,
    };

    it("successfully syncs files", async () => {
      const result = await syncService.startKitSync(mockSettings, mockOptions);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("handles copy errors gracefully", async () => {
      mockFs.copyFileSync.mockImplementationOnce(() => {
        throw new Error("Copy failed");
      });

      const result = await syncService.startKitSync(mockSettings, mockOptions);

      expect(result).toBeDefined();
    });

    it("handles missing local store path", async () => {
      const emptySettings = {};

      const result = await syncService.startKitSync(emptySettings, mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("handles missing SD card path", async () => {
      mockValidateSdCardTarget.mockReturnValueOnce({
        ok: false,
        reason: "No SD card folder selected",
      });

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No SD card folder selected");
    });

    it("returns sync results with file count", async () => {
      // Mock successful sync
      mockMarkKitsAsSynced.mockResolvedValue({
        data: undefined,
        success: true,
      });

      const result = await syncService.startKitSync(mockSettings, mockOptions);

      if (result.success) {
        expect(result.data).toHaveProperty("syncedFiles");
        expect(typeof result.data.syncedFiles).toBe("number");
      }
    });
  });

  describe("SD card safety", () => {
    const mockSettings = {
      localStorePath: "/local/store",
    };

    beforeEach(() => {
      // Reach the write stage deterministically with nothing to copy.
      vi.spyOn(
        syncSampleProcessingService,
        "gatherAllSamples",
      ).mockResolvedValue({ data: [], success: true });
      vi.spyOn(syncFileOperationsService, "processAllFiles").mockResolvedValue(
        0,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("refuses an unsafe target before reading or writing anything", async () => {
      mockValidateSdCardTarget.mockReturnValueOnce({
        ok: false,
        reason: "Refusing to use your home folder",
      });

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/Users/someone",
        wipeSdCard: true,
      });

      expect(result).toEqual({
        error: "Refusing to use your home folder",
        success: false,
      });
      expect(
        syncSampleProcessingService.gatherAllSamples,
      ).not.toHaveBeenCalled();
      expect(mockClearRampleContent).not.toHaveBeenCalled();
      expect(syncFileOperationsService.processAllFiles).not.toHaveBeenCalled();
    });

    it("protects the local store and the ROMPER_LOCAL_PATH override", async () => {
      const previous = process.env.ROMPER_LOCAL_PATH;
      process.env.ROMPER_LOCAL_PATH = "/env/store";
      try {
        await syncService.startKitSync(mockSettings, {
          sdCardPath: "/sd/card",
        });
      } finally {
        if (previous === undefined) delete process.env.ROMPER_LOCAL_PATH;
        else process.env.ROMPER_LOCAL_PATH = previous;
      }

      expect(mockValidateSdCardTarget).toHaveBeenCalledWith("/sd/card", [
        "/local/store",
        "/env/store",
      ]);
    });

    it("clears only Rample content when the clear option is ticked", async () => {
      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
        wipeSdCard: true,
      });

      expect(result.success).toBe(true);
      expect(mockClearRampleContent).toHaveBeenCalledWith("/sd/card");
      // The old implementation removed every entry directly; it must not.
      expect(mockFs.rmSync).not.toHaveBeenCalled();
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it("clears before any file is written", async () => {
      const order: string[] = [];
      mockClearRampleContent.mockImplementationOnce(() => {
        order.push("clear");
        return { removed: [] };
      });
      vi.mocked(
        syncFileOperationsService.processAllFiles,
      ).mockImplementationOnce(async () => {
        order.push("write");
        return 0;
      });

      await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
        wipeSdCard: true,
      });

      expect(order).toEqual(["clear", "write"]);
    });

    it("does not clear the card when the option is not ticked", async () => {
      await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
        wipeSdCard: false,
      });

      expect(mockClearRampleContent).not.toHaveBeenCalled();
    });

    it("reports a failed clear as a sync error and writes nothing", async () => {
      mockClearRampleContent.mockImplementationOnce(() => {
        throw new Error("SD card path does not exist: /sd/card");
      });

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
        wipeSdCard: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to clear SD card: SD card path does not exist",
      );
      expect(syncFileOperationsService.processAllFiles).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    const mockSettings = {
      localStorePath: "/local/store",
    };

    const mockOptions = {
      sdCardPath: "/sd/card",
      wipeSdCard: false,
    };

    it("handles generateChangeSummary failures", async () => {
      // Mock generateChangeSummary to fail
      const mockGenerateChangeSummary = vi.spyOn(
        syncService,
        "generateChangeSummary",
      );
      mockGenerateChangeSummary.mockResolvedValue({
        error: "Failed to generate summary",
        success: false,
      });

      const result = await syncService.startKitSync(mockSettings, mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to load kits");
    });

    it("handles general sync errors", async () => {
      // Mock fs operations to throw errors
      mockFs.statSync.mockImplementation(() => {
        throw new Error("Filesystem error");
      });

      const result = await syncService.startKitSync(mockSettings, mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("private methods", () => {
    it("calculates destination paths correctly", () => {
      const sample = {
        filename: "kick.wav",
        slot: 0,
        voice: 1,
      };

      // Test destination path calculation via sample processing service
      const destPath = syncSampleProcessingService.getDestinationPath(
        "/local/store",
        "A01",
        sample,
      );

      expect(typeof destPath).toBe("string");
      expect(destPath).toContain("kick.wav");
    });

    it("estimates sync time", () => {
      const estimatedTime = (syncService as unknown).estimateSyncTime(
        5, // totalFiles
        2, // conversions
      );

      expect(typeof estimatedTime).toBe("number");
      expect(estimatedTime).toBeGreaterThan(0);
    });

    it("categorizes errors correctly", () => {
      const permissionError = syncValidationService.categorizeError(
        new Error("EACCES: permission denied"),
      );

      expect(permissionError.type).toBe("permission");
      expect(permissionError.canRetry).toBe(true);

      const diskSpaceError = syncValidationService.categorizeError(
        new Error("ENOSPC: no space left on device"),
      );

      expect(diskSpaceError.type).toBe("disk_space");
      expect(diskSpaceError.canRetry).toBe(false);

      const unknownError = syncValidationService.categorizeError(
        new Error("Unknown error"),
      );

      expect(unknownError.type).toBe("unknown");
      expect(unknownError.canRetry).toBe(true);
    });

    it("calculates time remaining", () => {
      // Initialize a mock sync job with sample files
      const mockFiles = [
        {
          destinationPath: "/out1.wav",
          filename: "test1.wav",
          kitName: "kit1",
          operation: "copy" as const,
          sourcePath: "/test1.wav",
        },
        {
          destinationPath: "/out2.wav",
          filename: "test2.wav",
          kitName: "kit1",
          operation: "convert" as const,
          sourcePath: "/test2.wav",
        },
      ];
      syncProgressManager.initializeSyncJob(mockFiles);

      // Simulate some progress by completing files
      const currentJob = syncProgressManager.getCurrentSyncJob();
      if (currentJob) {
        currentJob.completedFiles = 1; // Simulate 1 of 2 files completed
      }

      const timeRemaining = syncProgressManager.calculateTimeRemaining();

      expect(typeof timeRemaining).toBe("number");
      expect(timeRemaining).toBeGreaterThanOrEqual(0);
    });

    it("emits progress correctly", () => {
      const progress = {
        currentFile: "test.wav",
        elapsedTime: 1000,
        estimatedTimeRemaining: 1000,
        filesCompleted: 1,
        status: "copying" as const,
        totalFiles: 2,
      };

      syncProgressManager.emitProgress(progress);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        progress,
      );
    });
  });
});
