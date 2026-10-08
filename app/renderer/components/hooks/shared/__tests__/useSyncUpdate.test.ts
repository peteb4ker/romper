import type { DbResult } from "@romper/shared/db/schema";
import type {
  ElectronAPI,
  SyncChangeSummary,
  SyncOutcome,
  SyncProgress,
} from "@romper/shared/electronApi";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useSyncUpdate } from "../useSyncUpdate";

/** An electronAPI for the hook's dependency; overrides can leave a method out */
const createAPI = (overrides: Partial<ElectronAPI> = {}): ElectronAPI =>
  createElectronAPIMock(overrides);

/** What a write reports when it finishes */
const syncOutcome = (overrides: Partial<SyncOutcome> = {}): SyncOutcome => ({
  cancelled: false,
  skippedFiles: [],
  syncedFiles: 0,
  warnings: [],
  ...overrides,
});

describe("useSyncUpdate", () => {
  let mockElectronAPI = vi.mocked(createAPI());

  const mockChangeSummary: SyncChangeSummary = {
    banks: [{ bank: "A", fileCount: 1, hasConversions: false, kitCount: 1 }],
    fileCount: 1,
    kitCount: 1,
    removals: [],
    stereo: { autoLinks: [], mixdowns: [], quarantined: [] },
    validationErrors: [],
    warnings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI = vi.mocked(createAPI());
  });

  describe("initialization", () => {
    it("should initialize with correct default state", () => {
      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      expect(result.current.syncProgressStore.get()).toBeNull();
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
        data: mockChangeSummary,
        success: true,
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let summary: null | SyncChangeSummary = null;
      await act(async () => {
        summary = await result.current.generateChangeSummary();
      });

      expect(mockElectronAPI.generateSyncChangeSummary).toHaveBeenCalledWith(
        undefined,
      );
      expect(summary).toEqual(mockChangeSummary);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle API errors", async () => {
      mockElectronAPI.generateSyncChangeSummary.mockResolvedValue({
        error: "Failed to read kit files",
        success: false,
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let summary: null | SyncChangeSummary = null;
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

      let summary: null | SyncChangeSummary = null;
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
      const incompleteAPI = createAPI({ generateSyncChangeSummary: undefined });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: incompleteAPI }),
      );

      let summary: null | SyncChangeSummary = null;
      await act(async () => {
        summary = await result.current.generateChangeSummary();
      });

      expect(summary).toBeNull();
      expect(result.current.error).toBe("Sync functionality not available");
    });

    it("should set loading state during operation", async () => {
      let resolvePromise: (
        value: DbResult<SyncChangeSummary>,
      ) => void = () => {};
      const promise = new Promise<DbResult<SyncChangeSummary>>((resolve) => {
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
        resolvePromise({ data: mockChangeSummary, success: true });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("startSync", () => {
    it("should start sync successfully", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        data: syncOutcome({ syncedFiles: 1 }),
        success: true,
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let success = false;
      await act(async () => {
        success = await result.current.startSync({
          sdCardPath: "/path/to/sd",
        });
      });

      expect(mockElectronAPI.startKitSync).toHaveBeenCalledWith({
        sdCardPath: "/path/to/sd",
      });
      expect(success).toBe(true);
      expect(result.current.syncProgressStore.get()?.status).toBe("completed");
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle sync failure", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        error: "SD card not found",
        success: false,
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let success = true;
      await act(async () => {
        success = await result.current.startSync({ sdCardPath: "/path/to/sd" });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("SD card not found");
      expect(result.current.syncProgressStore.get()?.status).toBe("error");
    });

    it("should initialize sync progress", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        data: syncOutcome(),
        success: true,
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      await act(async () => {
        await result.current.startSync({
          sdCardPath: "/path/to/sd",
        });
      });

      expect(result.current.syncProgressStore.get()).toMatchObject({
        bytesCompleted: 0,
        currentFile: "",
        filesCompleted: 0,
        status: "completed",
        totalBytes: 0,
        totalFiles: 0,
      });
    });

    it("should set up progress listener if available", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        data: syncOutcome(),
        success: true,
      });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      await act(async () => {
        await result.current.startSync({ sdCardPath: "/path/to/sd" });
      });

      expect(mockElectronAPI.onSyncProgress).toHaveBeenCalled();
    });

    it("should handle missing API method", async () => {
      const incompleteAPI = createAPI({ startKitSync: undefined });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: incompleteAPI }),
      );

      let success = true;
      await act(async () => {
        success = await result.current.startSync({ sdCardPath: "/path/to/sd" });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Sync functionality not available");
    });
  });

  describe("[UC-34] cancelSync", () => {
    it("asks main to stop and leaves the result to the running write (RE-07)", () => {
      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      act(() => {
        result.current.cancelSync();
      });

      expect(mockElectronAPI.cancelKitSync).toHaveBeenCalled();
      expect(result.current.syncProgressStore.get()).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("ignores progress events delivered after the write's result", async () => {
      let onProgress: ((progress: SyncProgress) => void) | undefined;
      mockElectronAPI.onSyncProgress.mockImplementation((callback) => {
        onProgress = callback;
      });
      mockElectronAPI.startKitSync.mockResolvedValue({
        data: syncOutcome({ cancelled: true, syncedFiles: 2 }),
        success: true,
      });
      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      await act(async () => {
        await result.current.startSync({ sdCardPath: "/sd" });
      });
      act(() => {
        onProgress?.({
          bytesCompleted: 0,
          currentFile: "late.wav",
          filesCompleted: 2,
          status: "copying",
          totalBytes: 0,
          totalFiles: 4,
        });
      });

      expect(result.current.syncProgressStore.get()?.status).toBe("cancelled");
      expect(result.current.syncProgressStore.get()?.filesCompleted).toBe(2);
    });

    it("delivers progress through the store without re-rendering the hook's owner (RE-61)", async () => {
      let onProgress: ((progress: SyncProgress) => void) | undefined;
      mockElectronAPI.onSyncProgress.mockImplementation((callback) => {
        onProgress = callback;
      });
      let finishWrite: (value: DbResult<SyncOutcome>) => void = () => {};
      mockElectronAPI.startKitSync.mockReturnValue(
        new Promise<DbResult<SyncOutcome>>((resolve) => {
          finishWrite = resolve;
        }),
      );
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useSyncUpdate({ electronAPI: mockElectronAPI });
      });

      let write: Promise<boolean> = Promise.resolve(false);
      act(() => {
        write = result.current.startSync({ sdCardPath: "/sd" });
      });
      const rendersBeforeProgress = renders;
      act(() => {
        for (let filesCompleted = 1; filesCompleted <= 100; filesCompleted++) {
          onProgress?.({
            bytesCompleted: 0,
            currentFile: `s${filesCompleted}.wav`,
            filesCompleted,
            status: "copying",
            totalBytes: 0,
            totalFiles: 100,
          });
        }
      });

      expect(renders).toBe(rendersBeforeProgress);
      expect(result.current.syncProgressStore.get()?.filesCompleted).toBe(100);

      await act(async () => {
        finishWrite({
          data: syncOutcome({ syncedFiles: 100 }),
          success: true,
        });
        await write;
      });
      expect(result.current.syncProgressStore.get()?.status).toBe("completed");
    });

    it("shows a cancelled write as cancelled, not failed or complete", async () => {
      mockElectronAPI.startKitSync.mockResolvedValue({
        data: syncOutcome({ cancelled: true, syncedFiles: 2 }),
        success: true,
      });
      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: mockElectronAPI }),
      );

      let success = false;
      await act(async () => {
        success = await result.current.startSync({ sdCardPath: "/sd" });
      });

      expect(success).toBe(true);
      expect(result.current.syncProgressStore.get()?.status).toBe("cancelled");
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle missing cancel method gracefully", () => {
      const incompleteAPI = createAPI({ cancelKitSync: undefined });

      const { result } = renderHook(() =>
        useSyncUpdate({ electronAPI: incompleteAPI }),
      );

      expect(() =>
        act(() => {
          result.current.cancelSync();
        }),
      ).not.toThrow();
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
    it("should use default globalThis.electronAPI when no deps provided", () => {
      // Mock the specific method we're testing
      vi.mocked(
        globalThis.electronAPI.generateSyncChangeSummary,
      ).mockResolvedValue({
        data: mockChangeSummary,
        success: true,
      });

      const { result } = renderHook(() => useSyncUpdate());

      act(() => {
        result.current.generateChangeSummary();
      });

      expect(
        globalThis.electronAPI.generateSyncChangeSummary,
      ).toHaveBeenCalledWith(undefined);
    });
  });
});
