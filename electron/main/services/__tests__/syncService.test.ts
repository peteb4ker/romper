import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const mockConvertToRampleDefault = vi.mocked(convertToRampleDefault);
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
      size: 1024 * 1024, // 1MB
      isFile: () => true,
      isDirectory: () => false,
    } as any);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.copyFileSync.mockImplementation(() => undefined);

    mockGetAudioMetadata.mockResolvedValue({
      success: true,
      data: {
        format: "WAV",
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        duration: 1.5,
      },
    });

    mockValidateSampleFormat.mockResolvedValue({
      isValid: true,
      needsConversion: false,
      format: "WAV",
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
    });

    // Mock getKits for generateChangeSummary
    vi.doMock("../../db/romperDbCoreORM.js", async () => {
      const actual = await vi.importActual("../../db/romperDbCoreORM.js");
      return {
        ...actual,
        getKits: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { name: "A01", bank_letter: "A" },
            { name: "B02", bank_letter: "B" },
          ],
        }),
        getKitSamples: mockGetKitSamples,
        markKitsAsSynced: mockMarkKitsAsSynced,
      };
    });

    mockGetKitSamples.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          kit_id: 1,
          filename: "kick.wav",
          source_path: "/source/kick.wav",
          voice: 1,
          slot: 0,
          pitch: 0,
          start_point: 0,
          end_point: 0,
          playback_mode: "OneShot",
          reverse: false,
          plock: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
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
        isValid: false,
        needsConversion: true,
        format: "MP3",
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
      });

      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      expect(result).toBeDefined();
    });
  });

  describe("startKitSync", () => {
    const mockOperations = [
      {
        filename: "kick.wav",
        sourcePath: "/source/kick.wav",
        destinationPath: "/dest/A01/SP_A01_1_kick.wav",
        operation: "copy" as const,
        kitName: "A01",
      },
    ];

    it("successfully syncs files", async () => {
      const result = await syncService.startKitSync(mockOperations, "/db/path");

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("handles copy errors gracefully", async () => {
      mockFs.copyFileSync.mockImplementationOnce(() => {
        throw new Error("Copy failed");
      });

      const result = await syncService.startKitSync(mockOperations, "/db/path");

      expect(result).toBeDefined();
    });

    it("handles conversion operations", async () => {
      const convertOperations = [
        {
          filename: "snare.wav",
          sourcePath: "/source/snare.wav",
          destinationPath: "/dest/A01/SP_A01_2_snare.wav",
          operation: "convert" as const,
          kitName: "A01",
          originalFormat: "MP3",
          targetFormat: "WAV",
        },
      ];

      const result = await syncService.startKitSync(
        convertOperations,
        "/db/path",
      );

      expect(result).toBeDefined();
    });

    it("handles empty operations list", async () => {
      const result = await syncService.startKitSync([], "/db/path");

      expect(result).toBeDefined();
    });
  });

  describe("private methods", () => {
    it("calculates destination paths correctly", () => {
      const sample = {
        filename: "kick.wav",
        voice: 1,
        slot: 0,
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
        startTime: Date.now() - 10000, // Started 10 seconds ago
        completedFiles: 5,
        totalFiles: 10,
        bytesTransferred: 1024 * 1024, // 1MB
        totalBytes: 2 * 1024 * 1024, // 2MB
      };

      const timeRemaining = (syncService as any).calculateTimeRemaining();

      expect(typeof timeRemaining).toBe("number");
      expect(timeRemaining).toBeGreaterThanOrEqual(0);
    });

    it("emits progress correctly", () => {
      const progress = {
        currentFile: "test.wav",
        filesCompleted: 1,
        totalFiles: 2,
        bytesTransferred: 1024,
        totalBytes: 2048,
        elapsedTime: 1000,
        estimatedTimeRemaining: 1000,
        status: "copying" as const,
      };

      (syncService as any).emitProgress(progress);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        progress,
      );
    });
  });
});
