import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStartupActions } from "../useStartupActions";

// No console mocking needed since we don't test logging messages

describe("useStartupActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run bank scanning when local store is configured", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      data: { updatedBanks: 5 },
      success: true,
    });

    renderHook(() =>
      useStartupActions({
        localStorePath: "/mock/local/store",
        needsLocalStoreSetup: false,
      })
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledWith();
    });
  });

  it("should not run when localStorePath is null", async () => {
    renderHook(() =>
      useStartupActions({
        localStorePath: null,
        needsLocalStoreSetup: false,
      })
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
      })
    );

    // Wait a bit to ensure the effect doesn't run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(window.electronAPI.scanBanks)).not.toHaveBeenCalled();
  });

  it("should handle bank scanning failure gracefully", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      error: "Permission denied",
      success: false,
    });

    renderHook(() =>
      useStartupActions({
        localStorePath: "/mock/local/store",
        needsLocalStoreSetup: false,
      })
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalled();
    });
  });

  it("should handle bank scanning exception gracefully", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockRejectedValue(
      new Error("Connection timeout")
    );

    renderHook(() =>
      useStartupActions({
        localStorePath: "/mock/local/store",
        needsLocalStoreSetup: false,
      })
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalled();
    });
  });

  it("should re-run when localStorePath changes", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      data: { updatedBanks: 2 },
      success: true,
    });

    const { rerender } = renderHook(
      ({ localStorePath, needsLocalStoreSetup }) =>
        useStartupActions({ localStorePath, needsLocalStoreSetup }),
      {
        initialProps: {
          localStorePath: "/mock/store1",
          needsLocalStoreSetup: false,
        },
      }
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
