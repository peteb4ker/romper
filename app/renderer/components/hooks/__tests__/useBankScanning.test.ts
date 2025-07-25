import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBankScanning } from "../useBankScanning";

// Mock electron API
const mockScanBanks = vi.fn();

describe("useBankScanning", () => {
  const mockOnMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure we have a proper window object
    if (typeof window === "undefined") {
      global.window = {} as any;
    }
    // Mock electronAPI for each test
    window.electronAPI = {
      scanBanks: mockScanBanks,
    } as any;
  });

  it("should call scanBanks with correct parameters when localStorePath is provided", async () => {
    mockScanBanks.mockResolvedValue({
      success: true,
      data: { updatedBanks: 3 },
    });

    const { result } = renderHook(() =>
      useBankScanning({
        localStorePath: "/mock/local/store",
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.scanBanks();
    });

    expect(mockScanBanks).toHaveBeenCalledWith(
      "/mock/local/store/.romperdb",
      "/mock/local/store",
    );
    expect(mockOnMessage).toHaveBeenCalledWith(
      "Bank scanning complete. Updated 3 banks.",
      "success",
    );
  });

  it("should show error message when localStorePath is not provided", async () => {
    const { result } = renderHook(() =>
      useBankScanning({
        localStorePath: null,
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.scanBanks();
    });

    expect(mockScanBanks).not.toHaveBeenCalled();
    expect(mockOnMessage).toHaveBeenCalledWith(
      "No local store configured",
      "error",
    );
  });

  it("should handle bank scanning failure", async () => {
    mockScanBanks.mockResolvedValue({
      success: false,
      error: "Database connection failed",
    });

    const { result } = renderHook(() =>
      useBankScanning({
        localStorePath: "/mock/local/store",
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.scanBanks();
    });

    expect(mockOnMessage).toHaveBeenCalledWith(
      "Bank scanning failed: Database connection failed",
      "error",
    );
  });

  it("should handle scanning exception", async () => {
    mockScanBanks.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useBankScanning({
        localStorePath: "/mock/local/store",
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.scanBanks();
    });

    expect(mockOnMessage).toHaveBeenCalledWith(
      "Bank scanning error: Network error",
      "error",
    );
  });

  it("should work without onMessage callback", async () => {
    mockScanBanks.mockResolvedValue({
      success: true,
      data: { updatedBanks: 1 },
    });

    const { result } = renderHook(() =>
      useBankScanning({
        localStorePath: "/mock/local/store",
        onMessage: undefined,
      }),
    );

    await act(async () => {
      await result.current.scanBanks();
    });

    expect(mockScanBanks).toHaveBeenCalled();
    // Should not throw error when onMessage is not provided
  });
});
