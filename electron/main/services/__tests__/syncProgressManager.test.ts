import { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncFileOperation } from "../syncFileOperations.js";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

import {
  PROGRESS_THROTTLE_MS,
  syncProgressManager,
} from "../syncProgressManager.js";

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
    mockBrowserWindow.getAllWindows.mockReturnValue([
      mockWindow as unknown as BrowserWindow,
    ]);
  });

  describe("initializeSyncJob", () => {
    it("should initialize sync job with provided files", () => {
      const mockFiles = [
        { filename: "test1.wav", kitName: "kit1" },
        { filename: "test2.wav", kitName: "kit1" },
      ] as SyncFileOperation[];

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
      ] as SyncFileOperation[];
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
      ] as SyncFileOperation[];
      syncProgressManager.initializeSyncJob(mockFiles);
      syncProgressManager.cancelCurrentSync();

      const wasCancelled = syncProgressManager.finalizeSyncJob();

      expect(wasCancelled).toBe(true);
      expect(syncProgressManager.getCurrentSyncJob()).toBeNull();
    });

    it("should return false when job was not cancelled", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as SyncFileOperation[];
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
      ] as SyncFileOperation[];

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
      ] as SyncFileOperation[];
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
      ] as SyncFileOperation[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const fileOp = {
        filename: "test.wav",
        operation: "copy",
      } as SyncFileOperation;
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
      ] as SyncFileOperation[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const fileOp = {
        filename: "test.wav",
        operation: "convert",
      } as SyncFileOperation;
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
      ] as SyncFileOperation[];
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

  describe("emitFinalizingProgress", () => {
    it("[UC-34] says the write is finishing, with every file counted (#653)", () => {
      const mockFiles = [
        { filename: "a.wav", kitName: "kit1" },
        { filename: "b.wav", kitName: "kit1" },
      ] as SyncFileOperation[];
      syncProgressManager.initializeSyncJob(mockFiles);
      syncProgressManager.emitFileCompletionProgress(mockFiles[0]);
      syncProgressManager.emitFileCompletionProgress(mockFiles[1]);
      mockWebContents.send.mockClear();

      syncProgressManager.emitFinalizingProgress();

      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          filesCompleted: 2,
          status: "finalizing",
          totalFiles: 2,
        }),
      );
    });
  });

  describe("emitErrorProgress", () => {
    it("should emit error progress with retry information", () => {
      const mockFiles = [
        { filename: "test.wav", kitName: "kit1" },
      ] as SyncFileOperation[];
      syncProgressManager.initializeSyncJob(mockFiles);

      const fileOp = {
        filename: "test.wav",
        operation: "copy",
      } as SyncFileOperation;
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

  describe("progress throttling", () => {
    const makeFiles = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        filename: `s${i}.wav`,
        kitName: "A0",
        operation: "copy",
      })) as SyncFileOperation[];

    const sentProgress = () =>
      mockWebContents.send.mock.calls.map(
        ([, progress]) =>
          progress as { filesCompleted: number; status: string },
      );

    const syncFile = (fileOp: SyncFileOperation) => {
      syncProgressManager.emitFileStartProgress(fileOp);
      syncProgressManager.emitFileCompletionProgress(fileOp);
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      syncProgressManager.finalizeSyncJob();
      vi.useRealTimers();
    });

    it("sends the first event immediately", () => {
      const files = makeFiles(10);
      syncProgressManager.initializeSyncJob(files);

      syncProgressManager.emitFileStartProgress(files[0]);

      expect(mockWebContents.send).toHaveBeenCalledTimes(1);
    });

    it("coalesces a burst of file events into a few sends", () => {
      const files = makeFiles(2395);
      syncProgressManager.initializeSyncJob(files);

      // Every file in one instant, as a fast copy loop does
      files.slice(0, 2000).forEach(syncFile);

      // The first event went out; the rest are held as one pending update
      expect(mockWebContents.send).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(PROGRESS_THROTTLE_MS);

      const sent = sentProgress();
      expect(sent).toHaveLength(2);
      expect(sent[1].filesCompleted).toBe(2000);
    });

    it("sends at most one event per interval while files keep completing", () => {
      const files = makeFiles(1000);
      syncProgressManager.initializeSyncJob(files);

      // One file per millisecond for 500 ms
      for (const file of files.slice(0, 500)) {
        syncFile(file);
        vi.advanceTimersByTime(1);
      }
      vi.advanceTimersByTime(PROGRESS_THROTTLE_MS);

      const sent = sentProgress();
      expect(sent.length).toBeLessThanOrEqual(500 / PROGRESS_THROTTLE_MS + 2);
      expect(sent.at(-1)?.filesCompleted).toBe(500);
      // Counts only ever move forward
      const counts = sent.map((p) => p.filesCompleted);
      expect(counts).toEqual([...counts].sort((a, b) => a - b));
    });

    it("sends the last file's completion immediately with the exact count", () => {
      const files = makeFiles(300);
      syncProgressManager.initializeSyncJob(files);

      files.forEach(syncFile);

      const sent = sentProgress();
      expect(sent.at(-1)?.filesCompleted).toBe(300);
      // Nothing stale is left to arrive after the final count
      vi.advanceTimersByTime(PROGRESS_THROTTLE_MS * 2);
      expect(sentProgress()).toHaveLength(sent.length);
    });

    it("sends completion immediately and drops any pending update", () => {
      const files = makeFiles(100);
      syncProgressManager.initializeSyncJob(files);
      files.slice(0, 50).forEach(syncFile);

      syncProgressManager.emitCompletionProgress(50, 100);
      vi.advanceTimersByTime(PROGRESS_THROTTLE_MS * 2);

      const sent = sentProgress();
      expect(sent).toHaveLength(2);
      expect(sent[1]).toMatchObject({ filesCompleted: 50, status: "complete" });
    });

    it("sends errors immediately and drops any pending update", () => {
      const files = makeFiles(100);
      syncProgressManager.initializeSyncJob(files);
      files.slice(0, 50).forEach(syncFile);

      syncProgressManager.emitErrorProgress(files[50], {
        canRetry: false,
        error: "Disk full",
      });
      vi.advanceTimersByTime(PROGRESS_THROTTLE_MS * 2);

      const sent = sentProgress();
      expect(sent).toHaveLength(2);
      expect(sent[1]).toMatchObject({ filesCompleted: 50, status: "error" });
    });

    it("drops a pending update when the job is finalized (cancel)", () => {
      const files = makeFiles(100);
      syncProgressManager.initializeSyncJob(files);
      files.slice(0, 50).forEach(syncFile);

      syncProgressManager.cancelCurrentSync();
      syncProgressManager.finalizeSyncJob();
      vi.advanceTimersByTime(PROGRESS_THROTTLE_MS * 2);

      expect(mockWebContents.send).toHaveBeenCalledTimes(1);
    });

    it("sends the first event of a new job immediately", () => {
      const files = makeFiles(10);
      syncProgressManager.initializeSyncJob(files);
      syncFile(files[0]);
      syncProgressManager.finalizeSyncJob();

      syncProgressManager.initializeSyncJob(files);
      syncProgressManager.emitFileStartProgress(files[0]);

      expect(sentProgress().at(-1)).toMatchObject({ filesCompleted: 0 });
      expect(mockWebContents.send).toHaveBeenCalledTimes(2);
    });
  });
});
