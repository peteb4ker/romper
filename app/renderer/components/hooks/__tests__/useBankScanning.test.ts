import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBankScanning } from "../useBankScanning";

describe("useBankScanning", () => {
  const mockOnMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call scanBanks and show success message", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      data: { updatedBanks: 3 },
      success: true,
    });

    const { result } = renderHook(() =>
      useBankScanning({
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.scanBanks();
    });

    expect(window.electronAPI.scanBanks).toHaveBeenCalledWith();
    expect(mockOnMessage).toHaveBeenCalledWith(
      "Bank scanning complete. Updated 3 banks.",
      "success",
    );
  });

  it("should handle bank scanning failure", async () => {
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      error: "Database connection failed",
      success: false,
    });

    const { result } = renderHook(() =>
      useBankScanning({
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
    vi.mocked(window.electronAPI.scanBanks).mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(() =>
      useBankScanning({
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
    vi.mocked(window.electronAPI.scanBanks).mockResolvedValue({
      data: { updatedBanks: 1 },
      success: true,
    });

    const { result } = renderHook(() =>
      useBankScanning({
        onMessage: undefined,
      }),
    );

    await act(async () => {
      await result.current.scanBanks();
    });

    expect(window.electronAPI.scanBanks).toHaveBeenCalled();
    // Should not throw error when onMessage is not provided
  });
});
