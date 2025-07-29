import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncChangeSummary } from "../../dialogs/SyncUpdateDialog";
import { useSyncUpdate } from "../useSyncUpdate";

describe("useSyncUpdate", () => {
  const mockElectronAPI = {
    generateSyncChangeSummary: vi.fn(),
    startKitSync: vi.fn(),
    cancelKitSync: vi.fn(),
    onSyncProgress: vi.fn(),
  };

  const mockChangeSummary: SyncChangeSummary = {
    filesToCopy: [
      {
        filename: "kick.wav",
        sourcePath: "/path/to/kick.wav",
        destinationPath: "/sd/A0/kick.wav",
        operation: "copy",
      },
    ],
    filesToConvert: [],
    estimatedTime: 10,
    estimatedSize: 1024000,
    hasFormatWarnings: false,
    warnings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with correct default state", () => {
      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      expect(result.current.syncProgress).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.generateChangeSummary).toBe("function");
      expect(typeof result.current.startSync).toBe("function");
      expect(typeof result.current.cancelSync).toBe("function");
      expect(typeof result.current.clearError).toBe("function");
    });
  });

  describe("generateChangeSummary", () => {
    it("should generate change summary successfully", async () => {
      mockElectronAPI.generateSyncChangeSummary.mockResolvedValue({
        success: true,
        data: mockChangeSummary,
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let summary: SyncChangeSummary | null = null;
      await act(async () => {
        summary = await result.current.generateChangeSummary();
      });

      expect(mockElectronAPI.generateSyncChangeSummary).toHaveBeenCalledWith();
      expect(summary).toEqual(mockChangeSummary);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle API errors", async () => {
      mockElectronAPI.generateSyncChangeSummary.mockResolvedValue({
        success: false,
        error: "Failed to read kit files",
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let summary: SyncChangeSummary | null = null;
      await act(async () => {
        summary = await result.current.generateChangeSummary();
      });

      expect(summary).toBeNull();
      expect(result.current.error).toBe("Failed to read kit files");
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle thrown exceptions", async () => {
      mockElectronAPI.generateSyncChangeSummary.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let summary: SyncChangeSummary | null = null;
      await act(async () => {
        summary = await result.current.generateChangeSummary();
      });

      expect(summary).toBeNull();
      expect(result.current.error).toBe(
        "Failed to generate sync summary: Network error",
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle missing API method", async () => {
      const incompleteAPI = { ...mockElectronAPI };
      delete incompleteAPI.generateSyncChangeSummary;

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: incompleteAPI }),
      );

      let summary: SyncChangeSummary | null = null;
      await act(async () => {
        summary = await result.current.generateChangeSummary();
      });

      expect(summary).toBeNull();
      expect(result.current.error).toBe("Sync functionality not available");
    });

    it("should set loading state during operation", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockElectronAPI.generateSyncChangeSummary.mockReturnValue(promise);

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      act(() => {
        result.current.generateChangeSummary();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolvePromise({ success: true, data: mockChangeSummary });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("startSync", () => {
    it("should start sync successfully", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        success: true,
        data: { syncedFiles: 1 },
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let success = false;
      await act(async () => {
        success = await result.current.startSync(mockChangeSummary);
      });

      expect(mockElectronAPI.startKitSync).toHaveBeenCalledWith({
        filesToCopy: mockChangeSummary.filesToCopy,
        filesToConvert: mockChangeSummary.filesToConvert,
      });
      expect(success).toBe(true);
      expect(result.current.syncProgress?.status).toBe("completed");
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle sync failure", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        success: false,
        error: "SD card not found",
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let success = true;
      await act(async () => {
        success = await result.current.startSync(mockChangeSummary);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("SD card not found");
      expect(result.current.syncProgress?.status).toBe("error");
    });

    it("should initialize sync progress", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        success: true,
        data: {},
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      await act(async () => {
        await result.current.startSync(mockChangeSummary);
      });

      expect(result.current.syncProgress).toMatchObject({
        currentFile: "",
        filesCompleted: 0,
        totalFiles: 1,
        bytesCompleted: 0,
        totalBytes: 1024000,
        status: "completed",
      });
    });

    it("should set up progress listener if available", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        success: true,
        data: {},
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      await act(async () => {
        await result.current.startSync(mockChangeSummary);
      });

      expect(mockElectronAPI.onSyncProgress).toHaveBeenCalled();
    });

    it("should handle missing API method", async () => {
      const incompleteAPI = { ...mockElectronAPI };
      delete incompleteAPI.startKitSync;

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: incompleteAPI }),
      );

      let success = true;
      await act(async () => {
        success = await result.current.startSync(mockChangeSummary);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Sync functionality not available");
    });
  });

  describe("cancelSync", () => {
    it("should cancel sync and reset state", () => {
      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      act(() => {
        result.current.cancelSync();
      });

      expect(mockElectronAPI.cancelKitSync).toHaveBeenCalled();
      expect(result.current.syncProgress).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle missing cancel method gracefully", () => {
      const incompleteAPI = { ...mockElectronAPI };
      delete incompleteAPI.cancelKitSync;

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: incompleteAPI }),
      );

      act(() => {
        result.current.cancelSync();
      });

      expect(result.current.syncProgress).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("clearError", () => {
    it("should clear error state", () => {
      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      // Set error first
      act(() => {
        result.current.generateChangeSummary("A0").catch(() => {});
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("dependency injection", () => {
    it("should use default window.electronAPI when no deps provided", () => {
      // Mock global window.electronAPI
      const globalAPI = {
        generateSyncChangeSummary: vi.fn().mockResolvedValue({
          success: true,
          data: mockChangeSummary,
        }),
      };

      Object.defineProperty(window, "electronAPI", {
        value: globalAPI,
        writable: true,
      });

      const { result } = renderHook(() => useSyncUpdate());

      act(() => {
        result.current.generateChangeSummary();
      });

      expect(globalAPI.generateSyncChangeSummary).toHaveBeenCalledWith();
    });
  });
});
