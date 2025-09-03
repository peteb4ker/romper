import { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

import { syncProgressManager } from "../syncProgressManager.js";

const mockBrowserWindow = vi.mocked(BrowserWindow);

describe("SyncProgressManager", () => {
  const mockWebContents = {
    send: vi.fn(),
  };

  const mockWindow = {
    webContents: mockWebContents,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow as unknown]);
  });

  describe("initializeSyncJob", () => {
    it("should initialize sync job with provided files", () => {
      const mockFiles = [
        { filename: "test1.wav", kitName: "kit1" },
        { filename: "test2.wav", kitName: "kit1" },
      ] as unknown[];

      syncProgressManager.initializeSyncJob(mockFiles);

      const currentJob = syncProgressManager.getCurrentSyncJob();
      expect(currentJob).toBeDefined();
      expect(currentJob?.totalFiles).toBe(2);
      expect(currentJob?.kitName).toBe("kit1");
      expect(currentJob?.cancelled).toBe(false);
      expect(currentJob?.completedFiles).toBe(0);
    });

    it("should handle empty files array", () => {
      syncProgressManager.initializeSyncJob([]);

      const currentJob = syncProgressManager.getCurrentSyncJob();
      expect(currentJob).toBeDefined();
      expect(currentJob?.totalFiles).toBe(0);
      expect(currentJob?.kitName).toBe("Unknown Kit");
    });
  });

  describe("cancelCurrentSync", () => {
    it("should mark current sync job as cancelled", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);

      syncProgressManager.cancelCurrentSync();

      const currentJob = syncProgressManager.getCurrentSyncJob();
      expect(currentJob?.cancelled).toBe(true);
    });

    it("should handle no current sync job", () => {
      // Ensure no current job exists
      syncProgressManager.finalizeSyncJob();

      // Should not throw error when trying to cancel non-existent job
      expect(() => syncProgressManager.cancelCurrentSync()).not.toThrow();
      expect(syncProgressManager.getCurrentSyncJob()).toBeNull();
    });
  });

  describe("finalizeSyncJob", () => {
    it("should return cancelled status and clear job", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);
      syncProgressManager.cancelCurrentSync();

      const wasCancelled = syncProgressManager.finalizeSyncJob();

      expect(wasCancelled).toBe(true);
      expect(syncProgressManager.getCurrentSyncJob()).toBeNull();
    });

    it("should return false when job was not cancelled", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const wasCancelled = syncProgressManager.finalizeSyncJob();

      expect(wasCancelled).toBe(false);
      expect(syncProgressManager.getCurrentSyncJob()).toBeNull();
    });
  });

  describe("calculateTimeRemaining", () => {
    it("should return 0 when no current job", () => {
      const timeRemaining = syncProgressManager.calculateTimeRemaining();
      expect(timeRemaining).toBe(0);
    });

    it("should calculate time remaining based on progress", () => {
      vi.useFakeTimers();
      const mockFiles = [
        { filename: "test1.wav", kitName: "kit1" },
        { filename: "test2.wav", kitName: "kit1" },
      ] as unknown[];

      syncProgressManager.initializeSyncJob(mockFiles);

      // Simulate some time passing and progress
      vi.advanceTimersByTime(1000); // 1 second
      const currentJob = syncProgressManager.getCurrentSyncJob();
      if (currentJob) {
        currentJob.completedFiles = 1; // 50% complete
      }

      const timeRemaining = syncProgressManager.calculateTimeRemaining();

      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBe(1); // Should be approximately 1 second remaining

      vi.useRealTimers();
    });

    it("should return 0 when no progress made", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const timeRemaining = syncProgressManager.calculateTimeRemaining();
      expect(timeRemaining).toBe(0);
    });
  });

  describe("emitProgress", () => {
    it("should send progress to main window", () => {
      const progress = {
        currentFile: "test.wav",
        elapsedTime: 1000,
        estimatedTimeRemaining: 500,
        filesCompleted: 1,
        status: "copying" as const,
        totalFiles: 2,
      };

      syncProgressManager.emitProgress(progress);

      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sync-progress",
        progress,
      );
    });

    it("should handle no main window", () => {
      mockBrowserWindow.getAllWindows.mockReturnValue([]);

      const progress = {
        currentFile: "test.wav",
        elapsedTime: 1000,
        estimatedTimeRemaining: 500,
        filesCompleted: 1,
        status: "copying" as const,
        totalFiles: 2,
      };

      // Should not throw error
      syncProgressManager.emitProgress(progress);
      expect(mockWebContents.send).not.toHaveBeenCalled();
    });
  });

  describe("emitFileStartProgress", () => {
    it("should emit file start progress", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const fileOp = { filename: "test.wav", operation: "copy" } as unknown;
      syncProgressManager.emitFileStartProgress(fileOp);

      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          currentFile: "test.wav",
          currentFileProgress: 0,
          filesCompleted: 0,
          status: "copying",
          totalFiles: 1,
        }),
      );
    });
  });

  describe("emitFileCompletionProgress", () => {
    it("should emit file completion progress and increment completed files", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const fileOp = { filename: "test.wav", operation: "convert" } as unknown;
      syncProgressManager.emitFileCompletionProgress(fileOp);

      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          currentFile: "test.wav",
          currentFileProgress: 100,
          filesCompleted: 1,
          status: "converting",
          totalFiles: 1,
        }),
      );

      const currentJob = syncProgressManager.getCurrentSyncJob();
      expect(currentJob?.completedFiles).toBe(1);
    });
  });

  describe("emitCompletionProgress", () => {
    it("should emit completion progress", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);

      syncProgressManager.emitCompletionProgress(5, 5);

      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          currentFile: "",
          currentFileProgress: 100,
          estimatedTimeRemaining: 0,
          filesCompleted: 5,
          status: "complete",
          totalFiles: 5,
        }),
      );
    });
  });

  describe("emitErrorProgress", () => {
    it("should emit error progress with retry information", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as unknown[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const fileOp = { filename: "test.wav", operation: "copy" } as unknown;
      const errorDetails = { canRetry: true, error: "Test error" };

      syncProgressManager.emitErrorProgress(fileOp, errorDetails);

      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          currentFile: "test.wav",
          errorDetails: {
            canRetry: true,
            error: "Test error",
            fileName: "test.wav",
            operation: "copy",
          },
          estimatedTimeRemaining: 0,
          status: "error",
        }),
      );
    });
  });
});
