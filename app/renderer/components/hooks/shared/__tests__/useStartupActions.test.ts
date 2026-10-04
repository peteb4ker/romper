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
        isLocalStoreReady: true,
        localStorePath: "/mock/local/store",
      }),
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledWith();
    });
  });

  it("should not run when localStorePath is null", async () => {
    renderHook(() =>
      useStartupActions({
        isLocalStoreReady: true,
        localStorePath: null,
      }),
    );

    // Wait a bit to ensure the effect doesn't run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(window.electronAPI.scanBanks)).not.toHaveBeenCalled();
  });

  it("should not run when the local store isn't ready", async () => {
    renderHook(() =>
      useStartupActions({
        isLocalStoreReady: false,
        localStorePath: "/mock/local/store",
      }),
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
        isLocalStoreReady: true,
        localStorePath: "/mock/local/store",
      }),
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalled();
    });
  });

  it("should handle bank scanning exception gracefully", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockRejectedValue(
      new Error("Connection timeout"),
    );

    renderHook(() =>
      useStartupActions({
        isLocalStoreReady: true,
        localStorePath: "/mock/local/store",
      }),
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
      ({ isLocalStoreReady, localStorePath }) =>
        useStartupActions({ isLocalStoreReady, localStorePath }),
      {
        initialProps: {
          isLocalStoreReady: true,
          localStorePath: "/mock/store1",
        },
      },
    );

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledWith();
    });

    vi.mocked(window.electronAPI.scanBanks).mockClear();

    rerender({
      isLocalStoreReady: true,
      localStorePath: "/mock/store2",
    });

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledWith();
    });
  });
});

describe("[UC-05] useStartupActions with a store that isn't there at launch (#553)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      data: { updatedBanks: 0 },
      success: true,
    });
  });

  it("doesn't scan banks while the saved store is invalid", async () => {
    renderHook(() =>
      useStartupActions({
        isLocalStoreReady: false,
        localStorePath: "/missing/store",
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(window.electronAPI.scanBanks)).not.toHaveBeenCalled();
  });

  it("scans banks once the store becomes valid", async () => {
    const { rerender } = renderHook(
      ({ isLocalStoreReady, localStorePath }) =>
        useStartupActions({ isLocalStoreReady, localStorePath }),
      {
        initialProps: {
          isLocalStoreReady: false,
          localStorePath: "/store" as null | string,
        },
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(vi.mocked(window.electronAPI.scanBanks)).not.toHaveBeenCalled();

    // Try Again found the store, or a new store was set up
    rerender({ isLocalStoreReady: true, localStorePath: "/store" });

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledTimes(1);
    });
  });

  it("scans the new store after the user sets one up instead", async () => {
    const { rerender } = renderHook(
      ({ isLocalStoreReady, localStorePath }) =>
        useStartupActions({ isLocalStoreReady, localStorePath }),
      {
        initialProps: {
          isLocalStoreReady: false,
          localStorePath: "/missing/store" as null | string,
        },
      },
    );

    // Set Up a New Local Store forgets the saved one, then the wizard
    // saves the new one with its status
    rerender({ isLocalStoreReady: false, localStorePath: null });
    rerender({ isLocalStoreReady: true, localStorePath: "/new/store" });

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledTimes(1);
    });
  });

  it("doesn't scan again while the same store stays valid", async () => {
    const { rerender } = renderHook(
      ({ isLocalStoreReady, localStorePath }) =>
        useStartupActions({ isLocalStoreReady, localStorePath }),
      {
        initialProps: { isLocalStoreReady: true, localStorePath: "/store" },
      },
    );
    await waitFor(() => {
      expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledTimes(1);
    });

    rerender({ isLocalStoreReady: true, localStorePath: "/store" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(window.electronAPI.scanBanks)).toHaveBeenCalledTimes(1);
  });
});
