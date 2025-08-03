import { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

import {
  type SyncFileOperation,
  SyncProgressService,
} from "../syncProgressService.js";

const mockBrowserWindow = vi.mocked(BrowserWindow);

describe("SyncProgressService", () => {
  let service: SyncProgressService;
  let mockWindow: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncProgressService();

    // Mock window with webContents
    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
  });

  describe("initializeSyncJob", () => {
    it("should initialize sync job correctly", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/test1.wav",
          filename: "test1.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/test1.wav",
        },
        {
          destinationPath: "/dest/test2.wav",
          filename: "test2.wav",
          kitName: "Kit2",
          operation: "convert",
          sourcePath: "/source/test2.wav",
        },
      ];

      service.initializeSyncJob("TestKit", fileOperations, 2048);

      const currentJob = service.getCurrentSyncJob();
      expect(currentJob).toBeDefined();
      expect(currentJob?.kitName).toBe("TestKit");
      expect(currentJob?.totalFiles).toBe(2);
      expect(currentJob?.completedFiles).toBe(0);
      expect(currentJob?.cancelled).toBe(false);
      expect(currentJob?.totalBytes).toBe(2048);
      expect(currentJob?.bytesTransferred).toBe(0);
      expect(currentJob?.fileOperations).toEqual(fileOperations);
      expect(currentJob?.startTime).toBeGreaterThan(0);
    });
  });

  describe("updateProgress", () => {
    beforeEach(() => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/test.wav",
          filename: "test.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/test.wav",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);
    });

    it("should update progress and emit to renderer", () => {
      service.updateProgress("test.wav", 512, "copying", 50);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          bytesTransferred: 512,
          currentFile: "test.wav",
          currentFileProgress: 50,
          elapsedTime: expect.any(Number),
          filesCompleted: 0,
          status: "copying",
          totalBytes: 1024,
          totalFiles: 1,
        }),
      );
    });

    it("should increment completed files when progress is 100%", () => {
      service.updateProgress("test.wav", 1024, "copying", 100);

      const currentJob = service.getCurrentSyncJob();
      expect(currentJob?.completedFiles).toBe(1);
      expect(currentJob?.bytesTransferred).toBe(1024);
    });

    it("should not increment completed files for partial progress", () => {
      service.updateProgress("test.wav", 512, "copying", 50);

      const currentJob = service.getCurrentSyncJob();
      expect(currentJob?.completedFiles).toBe(0);
      expect(currentJob?.bytesTransferred).toBe(512);
    });

    it("should not update bytes on error", () => {
      service.updateProgress("test.wav", 0, "error", undefined, {
        canRetry: false,
        error: "File not found",
        fileName: "test.wav",
        operation: "copy",
      });

      const currentJob = service.getCurrentSyncJob();
      expect(currentJob?.bytesTransferred).toBe(0);
      expect(currentJob?.completedFiles).toBe(0);
    });

    it("should include error details in progress update", () => {
      const errorDetails = {
        canRetry: false,
        error: "File not found",
        fileName: "test.wav",
        operation: "copy" as const,
      };

      service.updateProgress("test.wav", 0, "error", undefined, errorDetails);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          errorDetails,
          status: "error",
        }),
      );
    });

    it("should handle no active window gracefully", () => {
      mockBrowserWindow.getAllWindows.mockReturnValue([]);

      expect(() => {
        service.updateProgress("test.wav", 512, "copying", 50);
      }).not.toThrow();
    });

    it("should do nothing when no sync job is active", () => {
      service.completeSync(); // Clear the job
      vi.clearAllMocks(); // Clear the mock calls from completeSync

      service.updateProgress("test.wav", 512, "copying", 50);

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe("cancelSync", () => {
    it("should cancel active sync job", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/test.wav",
          filename: "test.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/test.wav",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);

      const result = service.cancelSync();

      expect(result).toBe(true);
      expect(service.isCancelled()).toBe(true);
    });

    it("should return false when no sync job is active", () => {
      const result = service.cancelSync();

      expect(result).toBe(false);
      expect(service.isCancelled()).toBe(false);
    });
  });

  describe("isCancelled", () => {
    it("should return false when no job is active", () => {
      expect(service.isCancelled()).toBe(false);
    });

    it("should return false when job is not cancelled", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/test.wav",
          filename: "test.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/test.wav",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);

      expect(service.isCancelled()).toBe(false);
    });

    it("should return true when job is cancelled", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/test.wav",
          filename: "test.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/test.wav",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);
      service.cancelSync();

      expect(service.isCancelled()).toBe(true);
    });
  });

  describe("completeSync", () => {
    beforeEach(() => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/test.wav",
          filename: "test.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/test.wav",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);
    });

    it("should emit completion progress and clear job", () => {
      service.updateProgress("test.wav", 1024, "copying", 100);
      service.completeSync();

      expect(mockWindow.webContents.send).toHaveBeenLastCalledWith(
        "sync-progress",
        expect.objectContaining({
          currentFile: "",
          currentFileProgress: 100,
          filesCompleted: 1,
          status: "complete",
          totalFiles: 1,
        }),
      );

      expect(service.getCurrentSyncJob()).toBeNull();
    });

    it("should emit error status for cancelled jobs", () => {
      service.cancelSync();
      service.completeSync();

      expect(mockWindow.webContents.send).toHaveBeenLastCalledWith(
        "sync-progress",
        expect.objectContaining({
          status: "error",
        }),
      );
    });

    it("should handle completion when no job is active", () => {
      service.completeSync(); // Clear job
      service.completeSync(); // Try again

      // Should not throw or send updates
      expect(() => service.completeSync()).not.toThrow();
    });
  });

  describe("getCurrentSyncJob", () => {
    it("should return null when no job is active", () => {
      expect(service.getCurrentSyncJob()).toBeNull();
    });

    it("should return current job when active", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          destinationPath: "/dest/test.wav",
          filename: "test.wav",
          kitName: "Kit1",
          operation: "copy",
          sourcePath: "/source/test.wav",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);

      const job = service.getCurrentSyncJob();
      expect(job).toBeDefined();
      expect(job?.kitName).toBe("TestKit");
    });
  });
});
