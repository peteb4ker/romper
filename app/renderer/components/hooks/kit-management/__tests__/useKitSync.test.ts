import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock functions - hoisted to ensure they're available during mocking
const mockClearError = vi.hoisted(() => vi.fn());
const mockGenerateChangeSummary = vi.hoisted(() => vi.fn());
const mockStartSync = vi.hoisted(() => vi.fn());

// Mock the useSyncUpdate hook
vi.mock("../../shared/useSyncUpdate", () => ({
  useSyncUpdate: vi.fn(() => ({
    cancelSync: vi.fn(),
    clearError: mockClearError,
    error: null,
    generateChangeSummary: mockGenerateChangeSummary,
    isLoading: false,
    startSync: mockStartSync,
    syncProgress: null,
  })),
}));

import { useKitSync } from "../useKitSync";

describe("useKitSync", () => {
  const mockOnMessage = vi.fn();
  const mockOnRefreshKits = vi.fn();

  const defaultProps = {
    onMessage: mockOnMessage,
    onRefreshKits: mockOnRefreshKits,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("initializes with correct default values", () => {
      const { result } = renderHook(() => useKitSync(defaultProps));

      expect(result.current.showSyncDialog).toBe(false);
      expect(result.current.currentSyncKit).toBe(null);
      expect(result.current.currentChangeSummary).toBe(null);
      expect(result.current.isSyncLoading).toBe(false);
    });
  });

  describe("handleSyncToSdCard", () => {
    it("successfully initiates sync process", async () => {
      const { result } = renderHook(() => useKitSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      expect(result.current.currentSyncKit).toBe("All Kits");
      // Change summary is not generated immediately anymore - it's generated when SD card is selected
      expect(result.current.currentChangeSummary).toBe(null);
      expect(result.current.showSyncDialog).toBe(true);
    });

    it("initiates sync dialog regardless of change summary", async () => {
      const { result } = renderHook(() => useKitSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      // Dialog should open even without a change summary (summary generated later)
      expect(result.current.showSyncDialog).toBe(true);
      expect(result.current.currentSyncKit).toBe("All Kits");
      expect(result.current.currentChangeSummary).toBe(null);
    });
  });

  describe("handleConfirmSync", () => {
    it("successfully completes sync", async () => {
      const mockChangeSummary = { totalChanges: 5 };
      mockGenerateChangeSummary.mockResolvedValue(mockChangeSummary);
      mockStartSync.mockResolvedValue(true);

      const { result } = renderHook(() => useKitSync(defaultProps));

      // Set up the state as if sync was initiated
      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      await act(async () => {
        await result.current.handleConfirmSync({
          sdCardPath: "/path/to/sd",
          wipeSdCard: false,
        });
      });

      expect(mockStartSync).toHaveBeenCalledWith({
        sdCardPath: "/path/to/sd",
        wipeSdCard: false,
      });
      expect(result.current.showSyncDialog).toBe(false);
      expect(result.current.currentSyncKit).toBe(null);
      expect(result.current.currentChangeSummary).toBe(null);
      expect(mockOnMessage).toHaveBeenCalledWith(
        "All kits synced successfully to /path/to/sd!",
        "success",
        3000,
      );
      expect(mockOnRefreshKits).toHaveBeenCalled();
    });

    it("handles sync failure", async () => {
      const mockChangeSummary = { totalChanges: 5 };
      mockGenerateChangeSummary.mockResolvedValue(mockChangeSummary);
      mockStartSync.mockResolvedValue(false);

      const { result } = renderHook(() => useKitSync(defaultProps));

      // Set up the state as if sync was initiated
      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      await act(async () => {
        await result.current.handleConfirmSync({
          sdCardPath: "/path/to/sd",
          wipeSdCard: false,
        });
      });

      expect(mockStartSync).toHaveBeenCalledWith({
        sdCardPath: "/path/to/sd",
        wipeSdCard: false,
      });
    });

    it("does nothing when no SD card path is provided", async () => {
      const { result } = renderHook(() => useKitSync(defaultProps));

      await act(async () => {
        await result.current.handleConfirmSync({
          sdCardPath: null,
          wipeSdCard: false,
        });
      });

      expect(mockStartSync).not.toHaveBeenCalled();
    });

    it("calls onRefreshKits after successful sync to update kit browser state", async () => {
      const mockChangeSummary = { totalChanges: 3 };
      mockGenerateChangeSummary.mockResolvedValue(mockChangeSummary);
      mockStartSync.mockResolvedValue(true);

      const { result } = renderHook(() => useKitSync(defaultProps));

      // Set up the state as if sync was initiated
      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      await act(async () => {
        await result.current.handleConfirmSync({
          sdCardPath: "/path/to/sd",
          wipeSdCard: false,
        });
      });

      // Verify refresh is called to update kit modification states
      expect(mockOnRefreshKits).toHaveBeenCalledTimes(1);
      expect(mockOnMessage).toHaveBeenCalledWith(
        "All kits synced successfully to /path/to/sd!",
        "success",
        3000,
      );
    });

    it("does not call onRefreshKits when sync fails", async () => {
      const mockChangeSummary = { totalChanges: 3 };
      mockGenerateChangeSummary.mockResolvedValue(mockChangeSummary);
      mockStartSync.mockResolvedValue(false);

      const { result } = renderHook(() => useKitSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      await act(async () => {
        await result.current.handleConfirmSync({
          sdCardPath: "/path/to/sd",
          wipeSdCard: false,
        });
      });

      // Verify refresh is NOT called when sync fails
      expect(mockOnRefreshKits).not.toHaveBeenCalled();
    });

    it("handles missing onRefreshKits gracefully", async () => {
      const propsWithoutRefresh = {
        onMessage: mockOnMessage,
        // onRefreshKits not provided
      };

      mockStartSync.mockResolvedValue(true);

      const { result } = renderHook(() => useKitSync(propsWithoutRefresh));

      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      await act(async () => {
        await result.current.handleConfirmSync({
          sdCardPath: "/path/to/sd",
          wipeSdCard: false,
        });
      });

      // Should not throw error when onRefreshKits is not provided
      expect(result.current.showSyncDialog).toBe(false);
      expect(mockOnMessage).toHaveBeenCalledWith(
        "All kits synced successfully to /path/to/sd!",
        "success",
        3000,
      );
    });
  });

  describe("handleCloseSyncDialog", () => {
    it("resets all sync state", async () => {
      const mockChangeSummary = { totalChanges: 5 };
      mockGenerateChangeSummary.mockResolvedValue(mockChangeSummary);

      const { result } = renderHook(() => useKitSync(defaultProps));

      // Set up the state as if sync was initiated
      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      expect(result.current.showSyncDialog).toBe(true);
      expect(result.current.currentSyncKit).toBe("All Kits");

      act(() => {
        result.current.handleCloseSyncDialog();
      });

      expect(result.current.showSyncDialog).toBe(false);
      expect(result.current.currentSyncKit).toBe(null);
      expect(result.current.currentChangeSummary).toBe(null);
      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe("onSdCardPathChange", () => {
    it("updates local state and saves to settings when path is provided", async () => {
      const mockWriteSettings = vi.fn().mockResolvedValue(undefined);
      const mockElectronAPI = {
        writeSettings: mockWriteSettings,
      };
      global.window = {
        electronAPI: mockElectronAPI,
      } as unknown;

      const { result } = renderHook(() => useKitSync(defaultProps));

      const testPath = "/new/sd/card/path";

      await act(async () => {
        await result.current.onSdCardPathChange(testPath);
      });

      expect(result.current.sdCardPath).toBe(testPath);
      expect(mockWriteSettings).toHaveBeenCalledWith("sdCardPath", testPath);
    });

    it("updates local state and saves when path is null to persist clearing selection", async () => {
      const mockWriteSettings = vi.fn().mockResolvedValue(undefined);
      const mockElectronAPI = {
        writeSettings: mockWriteSettings,
      };
      global.window = {
        electronAPI: mockElectronAPI,
      } as unknown;

      const { result } = renderHook(() => useKitSync(defaultProps));

      await act(async () => {
        await result.current.onSdCardPathChange(null);
      });

      expect(result.current.sdCardPath).toBe(null);
      expect(mockWriteSettings).toHaveBeenCalledWith("sdCardPath", null);
    });

    it("handles save errors gracefully", async () => {
      const mockWriteSettings = vi
        .fn()
        .mockRejectedValue(new Error("Save failed"));
      const mockElectronAPI = {
        writeSettings: mockWriteSettings,
      };
      global.window = {
        electronAPI: mockElectronAPI,
      } as unknown;

      const { result } = renderHook(() => useKitSync(defaultProps));

      const testPath = "/new/sd/card/path";

      await act(async () => {
        await result.current.onSdCardPathChange(testPath);
      });

      expect(result.current.sdCardPath).toBe(testPath);
      expect(mockWriteSettings).toHaveBeenCalledWith("sdCardPath", testPath);
      expect(mockOnMessage).toHaveBeenCalledWith(
        "Failed to save SD card path",
        "warning",
      );
    });

    it("works when electronAPI is not available", async () => {
      global.window = {} as unknown;

      const { result } = renderHook(() => useKitSync(defaultProps));

      const testPath = "/new/sd/card/path";

      await act(async () => {
        await result.current.onSdCardPathChange(testPath);
      });

      expect(result.current.sdCardPath).toBe(testPath);
    });
  });
});
