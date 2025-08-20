import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBpm } from "../useBpm";

describe("useBpm", () => {
  let mockUpdateKitBpm: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the global electronAPI mock (set up by test setup)
    mockUpdateKitBpm = (window as unknown).electronAPI?.updateKitBpm;
    // Reset the mock to default behavior
    mockUpdateKitBpm?.mockResolvedValue({ success: true });
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
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    expect(mockUpdateKitBpm).toHaveBeenCalledWith("A1", 140);
    expect(result.current.bpm).toBe(140);
  });

  it("clamps BPM values below 30 to 30", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(20);
    });

    expect(mockUpdateKitBpm).toHaveBeenCalledWith("A1", 30);
    expect(result.current.bpm).toBe(30); // Should be clamped to 30
  });

  it("clamps BPM values above 180 to 180", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(200);
    });

    expect(mockUpdateKitBpm).toHaveBeenCalledWith("A1", 180);
    expect(result.current.bpm).toBe(180); // Should be clamped to 180
  });

  it("reverts BPM on API failure", async () => {
    mockUpdateKitBpm?.mockRejectedValue(new Error("API Error"));

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
    mockUpdateKitBpm?.mockRejectedValue(new Error("Network error"));

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
    // Temporarily remove electronAPI
    const originalElectronAPI = (window as unknown).electronAPI;
    delete (window as unknown).electronAPI;

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    // Restore electronAPI
    (window as unknown).electronAPI = originalElectronAPI;

    expect(mockUpdateKitBpm).not.toHaveBeenCalled();
  });
});
