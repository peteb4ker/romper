import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useStartupActions } from "../useStartupActions";

// Mock console methods
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

describe("useStartupActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  it("should run bank scanning when local store is configured", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      success: true,
      data: { updatedBanks: 5 },
    });

    renderHook(() =>
      useStartupActions({
        localStorePath: "/mock/local/store",
        needsLocalStoreSetup: false,
      }),
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledWith();
    });

    expect(mockConsoleLog).toHaveBeenCalledWith(
      "[Startup] Running bank scanning...",
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      "[Startup] Bank scanning complete. Updated 5 banks.",
    );
  });

  it("should not run when localStorePath is null", async () => {
    renderHook(() =>
      useStartupActions({
        localStorePath: null,
        needsLocalStoreSetup: false,
      }),
    );

    // Wait a bit to ensure the effect doesn't run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(window.electronAPI.scanBanks)).not.toHaveBeenCalled();
  });

  it("should not run when local store setup is needed", async () => {
    renderHook(() =>
      useStartupActions({
        localStorePath: "/mock/local/store",
        needsLocalStoreSetup: true,
      }),
    );

    // Wait a bit to ensure the effect doesn't run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(window.electronAPI.scanBanks)).not.toHaveBeenCalled();
  });

  it("should handle bank scanning failure gracefully", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      success: false,
      error: "Permission denied",
    });

    renderHook(() =>
      useStartupActions({
        localStorePath: "/mock/local/store",
        needsLocalStoreSetup: false,
      }),
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalled();
    });

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      "[Startup] Bank scanning failed: Permission denied",
    );
  });

  it("should handle bank scanning exception gracefully", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockRejectedValue(
      new Error("Connection timeout"),
    );

    renderHook(() =>
      useStartupActions({
        localStorePath: "/mock/local/store",
        needsLocalStoreSetup: false,
      }),
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalled();
    });

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      "[Startup] Bank scanning error: Connection timeout",
    );
  });

  it("should re-run when localStorePath changes", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      success: true,
      data: { updatedBanks: 2 },
    });

    const { rerender } = renderHook(
      ({ localStorePath, needsLocalStoreSetup }) =>
        useStartupActions({ localStorePath, needsLocalStoreSetup }),
      {
        initialProps: {
          localStorePath: "/mock/store1",
          needsLocalStoreSetup: false,
        },
      },
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledWith();
    });

    vi.mocked(window.electronAPI.scanBanks).mockClear();

    rerender({
      localStorePath: "/mock/store2",
      needsLocalStoreSetup: false,
    });

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledWith();
    });
  });
});
