import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  markKitsAsSynced: vi.fn(),
}));

import type { SyncExecutorService } from "../syncExecutorService.js";
import type {
  SyncChangeSummary,
  SyncPlannerService,
} from "../syncPlannerService.js";
import type { SyncProgressService } from "../syncProgressService.js";

import { markKitsAsSynced } from "../../db/romperDbCoreORM.js";
import { SyncService } from "../syncServiceRefactored.js";

const _mockPath = vi.mocked(path);
const mockMarkKitsAsSynced = vi.mocked(markKitsAsSynced);

describe("SyncService", () => {
  let service: SyncService;
  let mockPlannerService: SyncPlannerService;
  let mockExecutorService: SyncExecutorService;
  let mockProgressService: SyncProgressService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock services
    mockPlannerService = {
      generateChangeSummary: vi.fn(),
    } as unknown;

    mockExecutorService = {
      calculateTotalSize: vi.fn(),
      categorizeError: vi.fn(),
      executeFileOperation: vi.fn(),
    } as unknown;

    mockProgressService = {
      cancelSync: vi.fn(),
      completeSync: vi.fn(),
      getCurrentSyncJob: vi.fn(),
      initializeSyncJob: vi.fn(),
      isCancelled: vi.fn(),
      updateProgress: vi.fn(),
    } as unknown;

    service = new SyncService(
      mockPlannerService,
      mockExecutorService,
      mockProgressService,
    );
  });

  describe("generateChangeSummary", () => {
    it("should delegate to planner service", async () => {
      const mockSummary: SyncChangeSummary = {
        filesToConvert: [],
        filesToCopy: [],
        hasFormatWarnings: false,
        totalSize: 1024,
        validationErrors: [],
        warnings: [],
      };

      mockPlannerService.generateChangeSummary = vi.fn().mockResolvedValue({
        data: mockSummary,
        success: true,
      });

      const settings = { localStorePath: "/test/path" };
      const result = await service.generateChangeSummary(settings);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSummary);
      expect(mockPlannerService.generateChangeSummary).toHaveBeenCalledWith(
        settings,
      );
    });

    it("should return error from planner service", async () => {
      mockPlannerService.generateChangeSummary = vi.fn().mockResolvedValue({
        error: "Planner error",
        success: false,
      });

      const result = await service.generateChangeSummary({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Planner error");
    });
  });

  describe("startKitSync", () => {
    const mockSyncData = {
      filesToConvert: [
        {
          destinationPath: "/dest/convert.wav",
          filename: "convert.wav",
          kitName: "Kit2",
          operation: "convert" as const,
          sourcePath: "/source/convert.wav",
        },
      ],
      filesToCopy: [
        {
          destinationPath: "/dest/copy.wav",
          filename: "copy.wav",
          kitName: "Kit1",
          operation: "copy" as const,
          sourcePath: "/source/copy.wav",
        },
      ],
    };

    beforeEach(() => {
      mockExecutorService.calculateTotalSize = vi.fn().mockReturnValue(2048);
      mockProgressService.isCancelled = vi.fn().mockReturnValue(false);
      mockProgressService.getCurrentSyncJob = vi.fn().mockReturnValue(null);
    });

    it("should successfully sync all files", async () => {
      mockExecutorService.executeFileOperation = vi
        .fn()
        .mockResolvedValueOnce({
          data: { bytesTransferred: 1024 },
          success: true,
        })
        .mockResolvedValueOnce({
          data: { bytesTransferred: 1024 },
          success: true,
        });

      mockMarkKitsAsSynced.mockReturnValue({ success: true });

      const settings = {
        defaultToMonoSamples: true,
        localStorePath: "/test/path",
      };

      const result = await service.startKitSync(settings, mockSyncData);

      expect(result.success).toBe(true);
      expect(result.data?.syncedFiles).toBe(2);

      // Verify initialization
      expect(mockProgressService.initializeSyncJob).toHaveBeenCalledWith(
        "All Kits",
        expect.any(Array),
        2048,
      );

      // Verify file operations
      expect(mockExecutorService.executeFileOperation).toHaveBeenCalledTimes(2);
      expect(mockExecutorService.executeFileOperation).toHaveBeenCalledWith(
        mockSyncData.filesToCopy[0],
        true, // forceMonoConversion from settings
      );
      expect(mockExecutorService.executeFileOperation).toHaveBeenCalledWith(
        mockSyncData.filesToConvert[0],
        true,
      );

      // Verify progress updates
      expect(mockProgressService.updateProgress).toHaveBeenCalledTimes(4); // Start and end for each file

      // Verify completion
      expect(mockProgressService.completeSync).toHaveBeenCalled();

      // Verify kits marked as synced
      expect(mockMarkKitsAsSynced).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        ["Kit1", "Kit2"],
      );
    });

    it("should handle file operation failure", async () => {
      mockExecutorService.executeFileOperation = vi.fn().mockResolvedValueOnce({
        error: "File operation failed",
        success: false,
      });

      mockExecutorService.categorizeError = vi.fn().mockReturnValue({
        canRetry: false,
        type: "file_access",
        userMessage: "File not found",
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await service.startKitSync(
        { localStorePath: "/test/path" },
        { filesToConvert: [], filesToCopy: mockSyncData.filesToCopy },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("copy.wav: File not found");
      expect(mockProgressService.completeSync).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to process file copy.wav:",
        "File not found",
      );

      consoleSpy.mockRestore();
    });

    it("should handle cancellation", async () => {
      mockProgressService.isCancelled = vi.fn().mockReturnValue(true);

      const result = await service.startKitSync(
        { localStorePath: "/test/path" },
        mockSyncData,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sync operation was cancelled");
      expect(mockExecutorService.executeFileOperation).not.toHaveBeenCalled();
    });

    it("should handle mono conversion setting", async () => {
      mockExecutorService.executeFileOperation = vi.fn().mockResolvedValue({
        data: { bytesTransferred: 1024 },
        success: true,
      });

      mockMarkKitsAsSynced.mockReturnValue({ success: true });

      const settings = {
        defaultToMonoSamples: false,
        localStorePath: "/test/path",
      };

      await service.startKitSync(settings, {
        filesToConvert: [],
        filesToCopy: mockSyncData.filesToCopy,
      });

      expect(mockExecutorService.executeFileOperation).toHaveBeenCalledWith(
        mockSyncData.filesToCopy[0],
        false, // forceMonoConversion should be false
      );
    });

    it("should warn but not fail when marking kits as synced fails", async () => {
      mockExecutorService.executeFileOperation = vi.fn().mockResolvedValue({
        data: { bytesTransferred: 1024 },
        success: true,
      });

      mockMarkKitsAsSynced.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await service.startKitSync(
        { localStorePath: "/test/path" },
        { filesToConvert: [], filesToCopy: mockSyncData.filesToCopy },
      );

      expect(result.success).toBe(true); // Should still succeed
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SyncService] Failed to mark kits as synced:",
        "Database error",
      );

      consoleSpy.mockRestore();
    });

    it("should not mark kits as synced when no files were synced", async () => {
      mockProgressService.isCancelled = vi.fn().mockReturnValue(true);

      await service.startKitSync(
        { localStorePath: "/test/path" },
        {
          filesToConvert: [],
          filesToCopy: [],
        },
      );

      expect(mockMarkKitsAsSynced).not.toHaveBeenCalled();
    });

    it("should handle sync job cleanup on error", async () => {
      mockExecutorService.executeFileOperation = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected error"));

      mockProgressService.getCurrentSyncJob = vi.fn().mockReturnValue({
        bytesTransferred: 0,
        cancelled: false,
        completedFiles: 0,
        fileOperations: [],
        kitName: "TestKit",
        startTime: Date.now(),
        totalBytes: 1024,
        totalFiles: 1,
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await service.startKitSync(
        { localStorePath: "/test/path" },
        { filesToConvert: [], filesToCopy: mockSyncData.filesToCopy },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to sync kit");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Sync failed, attempting cleanup...",
      );
      expect(mockProgressService.completeSync).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("cancelSync", () => {
    it("should delegate to progress service", () => {
      service.cancelSync();

      expect(mockProgressService.cancelSync).toHaveBeenCalled();
    });
  });
});
