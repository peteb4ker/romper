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

  const defaultProps = {
    onMessage: mockOnMessage,
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
      const mockChangeSummary = { totalChanges: 5 };
      mockGenerateChangeSummary.mockResolvedValue(mockChangeSummary);

      const { result } = renderHook(() => useKitSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      expect(result.current.currentSyncKit).toBe("All Kits");
      expect(result.current.currentChangeSummary).toEqual(mockChangeSummary);
      expect(result.current.showSyncDialog).toBe(true);
    });

    it("handles change summary generation failure", async () => {
      mockGenerateChangeSummary.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useKitSync(defaultProps));

      await act(async () => {
        await result.current.handleSyncToSdCard();
      });

      expect(result.current.showSyncDialog).toBe(false);
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
});
