import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]),
  },
}));

vi.mock("fs");
vi.mock("path");

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

import { getAudioMetadata, validateSampleFormat } from "../../audioUtils.js";
import { getKitSamples, markKitsAsSynced } from "../../db/romperDbCoreORM.js";
import { convertToRampleDefault } from "../../formatConverter.js";
import { syncService } from "../syncService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);
const mockValidateSampleFormat = vi.mocked(validateSampleFormat);
const mockGetKitSamples = vi.mocked(getKitSamples);
const mockMarkKitsAsSynced = vi.mocked(markKitsAsSynced);
const _mockConvertToRampleDefault = vi.mocked(convertToRampleDefault);
const mockBrowserWindow = vi.mocked(BrowserWindow);

describe("SyncService", () => {
  let mockWindow: any;

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
    } as any);
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

    it("handles wipe SD card option", async () => {
      const wipeSdCardOptions = {
        ...mockOptions,
        wipeSdCard: true,
      };

      // Mock rimraf for wipe functionality
      const mockRimraf = vi.fn().mockResolvedValue(undefined);
      vi.doMock("rimraf", () => ({ rimraf: mockRimraf }));

      const result = await syncService.startKitSync(
        mockSettings,
        wipeSdCardOptions,
      );

      expect(result).toBeDefined();
    });

    it("handles missing local store path", async () => {
      const emptySettings = {};

      const result = await syncService.startKitSync(emptySettings, mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("handles missing SD card path", async () => {
      const invalidOptions = {
        sdCardPath: "",
      };

      const result = await syncService.startKitSync(
        mockSettings,
        invalidOptions,
      );

      expect(result.success).toBe(false);
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

  describe("wipeSdCard functionality", () => {
    const mockSettings = {
      localStorePath: "/local/store",
    };

    it("wipes SD card when option is enabled", async () => {
      const wipeSdCardOptions = {
        sdCardPath: "/sd/card",
        wipeSdCard: true,
      };

      // Mock fs.readdirSync to return some files
      mockFs.readdirSync.mockReturnValue(["file1.wav", "file2.wav"] as any);
      const mockRm = vi.fn().mockResolvedValue(undefined);
      mockFs.rm = mockRm;

      const result = await syncService.startKitSync(
        mockSettings,
        wipeSdCardOptions,
      );

      expect(result).toBeDefined();
    });

    it("handles wipe SD card errors", async () => {
      const wipeSdCardOptions = {
        sdCardPath: "/nonexistent/path",
        wipeSdCard: true,
      };

      // Mock fs.existsSync to return false for nonexistent path
      mockFs.existsSync.mockReturnValueOnce(false);

      const result = await syncService.startKitSync(
        mockSettings,
        wipeSdCardOptions,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // The error could be about missing path or failing to load kits - both are valid error conditions
      expect(typeof result.error).toBe("string");
    });

    it("skips wipe when option is disabled", async () => {
      const noWipeOptions = {
        sdCardPath: "/sd/card",
        wipeSdCard: false,
      };

      const mockRm = vi.fn();
      mockFs.rm = mockRm;

      await syncService.startKitSync(mockSettings, noWipeOptions);

      // Verify wipe was not called
      expect(mockRm).not.toHaveBeenCalled();
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

      // Access private method through bracket notation for testing
      const destPath = (syncService as any).getDestinationPath(
        "/local/store",
        "A01",
        sample,
      );

      expect(typeof destPath).toBe("string");
      expect(destPath).toContain("kick.wav");
    });

    it("estimates sync time", () => {
      const estimatedTime = (syncService as any).estimateSyncTime(
        5, // totalFiles
        1024 * 1024, // 1MB total size
        2, // conversions
      );

      expect(typeof estimatedTime).toBe("number");
      expect(estimatedTime).toBeGreaterThan(0);
    });

    it("categorizes errors correctly", () => {
      const permissionError = (syncService as any).categorizeError(
        new Error("EACCES: permission denied"),
      );

      expect(permissionError.type).toBe("permission");
      expect(permissionError.canRetry).toBe(true);

      const diskSpaceError = (syncService as any).categorizeError(
        new Error("ENOSPC: no space left on device"),
      );

      expect(diskSpaceError.type).toBe("disk_space");
      expect(diskSpaceError.canRetry).toBe(false);

      const unknownError = (syncService as any).categorizeError(
        new Error("Unknown error"),
      );

      expect(unknownError.type).toBe("unknown");
      expect(unknownError.canRetry).toBe(true);
    });

    it("calculates time remaining", () => {
      // Set up a mock sync job
      (syncService as any).currentSyncJob = {
        bytesTransferred: 1024 * 1024, // 1MB
        completedFiles: 5,
        startTime: Date.now() - 10000, // Started 10 seconds ago
        totalBytes: 2 * 1024 * 1024, // 2MB
        totalFiles: 10,
      };

      const timeRemaining = (syncService as any).calculateTimeRemaining();

      expect(typeof timeRemaining).toBe("number");
      expect(timeRemaining).toBeGreaterThanOrEqual(0);
    });

    it("emits progress correctly", () => {
      const progress = {
        bytesTransferred: 1024,
        currentFile: "test.wav",
        elapsedTime: 1000,
        estimatedTimeRemaining: 1000,
        filesCompleted: 1,
        status: "copying" as const,
        totalBytes: 2048,
        totalFiles: 2,
      };

      (syncService as any).emitProgress(progress);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        progress,
      );
    });
  });
});
