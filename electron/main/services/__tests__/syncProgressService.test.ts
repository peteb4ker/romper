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
          filename: "test1.wav",
          sourcePath: "/source/test1.wav",
          destinationPath: "/dest/test1.wav",
          operation: "copy",
          kitName: "Kit1",
        },
        {
          filename: "test2.wav",
          sourcePath: "/source/test2.wav",
          destinationPath: "/dest/test2.wav",
          operation: "convert",
          kitName: "Kit2",
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
          filename: "test.wav",
          sourcePath: "/source/test.wav",
          destinationPath: "/dest/test.wav",
          operation: "copy",
          kitName: "Kit1",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);
    });

    it("should update progress and emit to renderer", () => {
      service.updateProgress("test.wav", 512, "copying", 50);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          currentFile: "test.wav",
          filesCompleted: 0,
          totalFiles: 1,
          bytesTransferred: 512,
          totalBytes: 1024,
          status: "copying",
          currentFileProgress: 50,
          elapsedTime: expect.any(Number),
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
        fileName: "test.wav",
        operation: "copy",
        error: "File not found",
        canRetry: false,
      });

      const currentJob = service.getCurrentSyncJob();
      expect(currentJob?.bytesTransferred).toBe(0);
      expect(currentJob?.completedFiles).toBe(0);
    });

    it("should include error details in progress update", () => {
      const errorDetails = {
        fileName: "test.wav",
        operation: "copy" as const,
        error: "File not found",
        canRetry: false,
      };

      service.updateProgress("test.wav", 0, "error", undefined, errorDetails);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        expect.objectContaining({
          status: "error",
          errorDetails,
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
          filename: "test.wav",
          sourcePath: "/source/test.wav",
          destinationPath: "/dest/test.wav",
          operation: "copy",
          kitName: "Kit1",
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
          filename: "test.wav",
          sourcePath: "/source/test.wav",
          destinationPath: "/dest/test.wav",
          operation: "copy",
          kitName: "Kit1",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);

      expect(service.isCancelled()).toBe(false);
    });

    it("should return true when job is cancelled", () => {
      const fileOperations: SyncFileOperation[] = [
        {
          filename: "test.wav",
          sourcePath: "/source/test.wav",
          destinationPath: "/dest/test.wav",
          operation: "copy",
          kitName: "Kit1",
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
          filename: "test.wav",
          sourcePath: "/source/test.wav",
          destinationPath: "/dest/test.wav",
          operation: "copy",
          kitName: "Kit1",
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
          filesCompleted: 1,
          totalFiles: 1,
          status: "complete",
          currentFileProgress: 100,
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
          filename: "test.wav",
          sourcePath: "/source/test.wav",
          destinationPath: "/dest/test.wav",
          operation: "copy",
          kitName: "Kit1",
        },
      ];
      service.initializeSyncJob("TestKit", fileOperations, 1024);

      const job = service.getCurrentSyncJob();
      expect(job).toBeDefined();
      expect(job?.kitName).toBe("TestKit");
    });
  });
});
