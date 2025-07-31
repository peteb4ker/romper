import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoRedo } from "../useUndoRedo";

// Mock electron API
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
};

// Setup window.electronAPI mock
beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electronAPI = mockElectronAPI;

  // Reset all mocks to return success by default
  Object.values(mockElectronAPI).forEach((mock) => {
    mock.mockResolvedValue({ success: true });
  });
});

describe("useUndoRedo - Basic Tests", () => {
  it("should initialize with empty stacks", () => {
    const { result } = renderHook(() => useUndoRedo("test-kit"));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
    expect(result.current.error).toBe(null);
  });

  it("should add actions to undo stack", () => {
    const { result } = renderHook(() => useUndoRedo("test-kit"));

    act(() => {
      result.current.addAction({
        type: "ADD_SAMPLE",
        data: {
          voice: 1,
          slot: 0,
          addedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
            is_stereo: false,
          },
        },
      });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.undoDescription).toBe(
      "Undo add sample to voice 1, slot 1",
    );
  });

  it("should perform basic undo operation", async () => {
    const { result } = renderHook(() => useUndoRedo("test-kit"));

    act(() => {
      result.current.addAction({
        type: "ADD_SAMPLE",
        data: {
          voice: 1,
          slot: 2,
          addedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
            is_stereo: false,
          },
        },
      });
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
      "test-kit",
      1,
      2,
    );
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("should clear stacks when kit changes", () => {
    const { result, rerender } = renderHook(
      ({ kitName }) => useUndoRedo(kitName),
      {
        initialProps: { kitName: "kit1" },
      },
    );

    // Add some actions
    act(() => {
      result.current.addAction({
        type: "ADD_SAMPLE",
        data: {
          voice: 1,
          slot: 0,
          addedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
            is_stereo: false,
          },
        },
      });
    });

    expect(result.current.undoCount).toBe(1);

    // Change kit
    rerender({ kitName: "kit2" });

    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
  });
});
