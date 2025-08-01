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

import { markKitsAsSynced } from "../../db/romperDbCoreORM.js";
import type { SyncExecutorService } from "../syncExecutorService.js";
import type {
  SyncChangeSummary,
  SyncPlannerService,
} from "../syncPlannerService.js";
import type { SyncProgressService } from "../syncProgressService.js";
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
    } as any;

    mockExecutorService = {
      calculateTotalSize: vi.fn(),
      executeFileOperation: vi.fn(),
      categorizeError: vi.fn(),
    } as any;

    mockProgressService = {
      initializeSyncJob: vi.fn(),
      updateProgress: vi.fn(),
      isCancelled: vi.fn(),
      completeSync: vi.fn(),
      getCurrentSyncJob: vi.fn(),
      cancelSync: vi.fn(),
    } as any;

    service = new SyncService(
      mockPlannerService,
      mockExecutorService,
      mockProgressService,
    );
  });

  describe("generateChangeSummary", () => {
    it("should delegate to planner service", async () => {
      const mockSummary: SyncChangeSummary = {
        filesToCopy: [],
        filesToConvert: [],
        totalSize: 1024,
        hasFormatWarnings: false,
        warnings: [],
        validationErrors: [],
      };

      mockPlannerService.generateChangeSummary = vi.fn().mockResolvedValue({
        success: true,
        data: mockSummary,
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
        success: false,
        error: "Planner error",
      });

      const result = await service.generateChangeSummary({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Planner error");
    });
  });

  describe("startKitSync", () => {
    const mockSyncData = {
      filesToCopy: [
        {
          filename: "copy.wav",
          sourcePath: "/source/copy.wav",
          destinationPath: "/dest/copy.wav",
          operation: "copy" as const,
          kitName: "Kit1",
        },
      ],
      filesToConvert: [
        {
          filename: "convert.wav",
          sourcePath: "/source/convert.wav",
          destinationPath: "/dest/convert.wav",
          operation: "convert" as const,
          kitName: "Kit2",
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
          success: true,
          data: { bytesTransferred: 1024 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { bytesTransferred: 1024 },
        });

      mockMarkKitsAsSynced.mockReturnValue({ success: true });

      const settings = {
        localStorePath: "/test/path",
        defaultToMonoSamples: true,
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
        success: false,
        error: "File operation failed",
      });

      mockExecutorService.categorizeError = vi.fn().mockReturnValue({
        type: "file_access",
        canRetry: false,
        userMessage: "File not found",
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await service.startKitSync(
        { localStorePath: "/test/path" },
        { filesToCopy: mockSyncData.filesToCopy, filesToConvert: [] },
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
        success: true,
        data: { bytesTransferred: 1024 },
      });

      mockMarkKitsAsSynced.mockReturnValue({ success: true });

      const settings = {
        localStorePath: "/test/path",
        defaultToMonoSamples: false,
      };

      await service.startKitSync(settings, {
        filesToCopy: mockSyncData.filesToCopy,
        filesToConvert: [],
      });

      expect(mockExecutorService.executeFileOperation).toHaveBeenCalledWith(
        mockSyncData.filesToCopy[0],
        false, // forceMonoConversion should be false
      );
    });

    it("should warn but not fail when marking kits as synced fails", async () => {
      mockExecutorService.executeFileOperation = vi.fn().mockResolvedValue({
        success: true,
        data: { bytesTransferred: 1024 },
      });

      mockMarkKitsAsSynced.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await service.startKitSync(
        { localStorePath: "/test/path" },
        { filesToCopy: mockSyncData.filesToCopy, filesToConvert: [] },
      );

      expect(result.success).toBe(true); // Should still succeed
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to mark kits as synced:",
        "Database error",
      );

      consoleSpy.mockRestore();
    });

    it("should not mark kits as synced when no files were synced", async () => {
      mockProgressService.isCancelled = vi.fn().mockReturnValue(true);

      await service.startKitSync(
        { localStorePath: "/test/path" },
        {
          filesToCopy: [],
          filesToConvert: [],
        },
      );

      expect(mockMarkKitsAsSynced).not.toHaveBeenCalled();
    });

    it("should handle sync job cleanup on error", async () => {
      mockExecutorService.executeFileOperation = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected error"));

      mockProgressService.getCurrentSyncJob = vi.fn().mockReturnValue({
        kitName: "TestKit",
        totalFiles: 1,
        completedFiles: 0,
        startTime: Date.now(),
        cancelled: false,
        totalBytes: 1024,
        bytesTransferred: 0,
        fileOperations: [],
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await service.startKitSync(
        { localStorePath: "/test/path" },
        { filesToCopy: mockSyncData.filesToCopy, filesToConvert: [] },
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
