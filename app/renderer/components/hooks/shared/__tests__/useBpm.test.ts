import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBpm } from "../useBpm";

// Mock window.electronAPI
const mockUpdateKitBpm = vi.fn();
const mockElectronAPI = {
  updateKitBpm: mockUpdateKitBpm,
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
});

describe("useBpm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with provided BPM value", () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 140, kitName: "A1" }),
    );

    expect(result.current.bpm).toBe(140);
  });

  it("defaults to 120 BPM when no initial value provided", () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: undefined, kitName: "A1" }),
    );

    expect(result.current.bpm).toBe(120);
  });

  it("updates BPM value when initialBpm changes", () => {
    const { rerender, result } = renderHook(
      ({ initialBpm }) => useBpm({ initialBpm, kitName: "A1" }),
      {
        initialProps: { initialBpm: 120 },
      },
    );

    expect(result.current.bpm).toBe(120);

    rerender({ initialBpm: 150 });
    expect(result.current.bpm).toBe(150);
  });

  it("calls electronAPI.updateKitBpm when setBpm is called with valid value", async () => {
    mockUpdateKitBpm.mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    expect(mockUpdateKitBpm).toHaveBeenCalledWith("A1", 140);
    expect(result.current.bpm).toBe(140);
  });

  it("rejects BPM values below 30", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(20);
    });

    expect(mockUpdateKitBpm).not.toHaveBeenCalled();
    expect(result.current.bpm).toBe(120); // Should remain unchanged
  });

  it("rejects BPM values above 180", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(200);
    });

    expect(mockUpdateKitBpm).not.toHaveBeenCalled();
    expect(result.current.bpm).toBe(120); // Should remain unchanged
  });

  it("reverts BPM on API failure", async () => {
    mockUpdateKitBpm.mockResolvedValue({ error: "API Error", success: false });

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    await waitFor(() => {
      expect(result.current.bpm).toBe(120); // Should revert to original value
    });
  });

  it("reverts BPM on API exception", async () => {
    mockUpdateKitBpm.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    await waitFor(() => {
      expect(result.current.bpm).toBe(120); // Should revert to original value
    });
  });

  it("does not call API when kitName is empty", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    expect(mockUpdateKitBpm).not.toHaveBeenCalled();
  });

  it("does not call API when electronAPI is not available", async () => {
    // Use vi.mocked to mock the function as undefined
    vi.mocked(window.electronAPI.updateKitBpm).mockImplementation(
      undefined as any,
    );

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    expect(mockUpdateKitBpm).not.toHaveBeenCalled();
  });
});
