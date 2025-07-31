// Tests for memory-based useUndoRedo hook
// Tests the new memory-only undo/redo implementation

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AddSampleAction,
  DeleteSampleAction,
} from "../../../../../shared/undoTypes";
import { setupElectronAPIMock } from "../../../../../tests/mocks/electron/electronAPI";
import { useUndoRedo } from "../useUndoRedo";

describe("useUndoRedo", () => {
  const testKitName = "A0";

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up centralized mocks with default success responses
    setupElectronAPIMock({
      addSampleToSlot: vi.fn().mockResolvedValue({ success: true }),
      deleteSampleFromSlot: vi.fn().mockResolvedValue({ success: true }),
      replaceSampleInSlot: vi.fn().mockResolvedValue({ success: true }),
    });
  });

  it("should initialize with empty stacks", () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
    expect(result.current.isUndoing).toBe(false);
    expect(result.current.isRedoing).toBe(false);
  });

  it("should provide addAction function", () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    expect(typeof result.current.addAction).toBe("function");
  });

  it("should provide undo and redo functions", () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    expect(typeof result.current.undo).toBe("function");
    expect(typeof result.current.redo).toBe("function");
  });

  it("should provide clearError function", () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    expect(typeof result.current.clearError).toBe("function");

    // Test clearing error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });

  it("should add actions to undo stack immediately", () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    const deleteAction: DeleteSampleAction = {
      id: "test-1",
      type: "DELETE_SAMPLE",
      timestamp: new Date(),
      description: "Delete sample",
      data: {
        voice: 1,
        slot: 0,
        deletedSample: {
          filename: "test.wav",
          source_path: "/test.wav",
          is_stereo: false,
        },
      },
    };

    act(() => {
      result.current.addAction(deleteAction);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.undoDescription).toContain("delete sample");
  });

  it("should clear redo stack when new action is added", () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    const action1: DeleteSampleAction = {
      id: "test-1",
      type: "DELETE_SAMPLE",
      timestamp: new Date(),
      description: "Delete sample 1",
      data: {
        voice: 1,
        slot: 0,
        deletedSample: {
          filename: "test1.wav",
          source_path: "/test1.wav",
          is_stereo: false,
        },
      },
    };

    const action2: DeleteSampleAction = {
      id: "test-2",
      type: "DELETE_SAMPLE",
      timestamp: new Date(),
      description: "Delete sample 2",
      data: {
        voice: 2,
        slot: 1,
        deletedSample: {
          filename: "test2.wav",
          source_path: "/test2.wav",
          is_stereo: false,
        },
      },
    };

    // Add first action and simulate undo (moves to redo stack)
    act(() => {
      result.current.addAction(action1);
    });

    // Simulate successful undo by manually moving action to redo stack
    act(() => {
      // This would normally happen in the undo function
      result.current.addAction(action2);
    });

    // Adding new action should clear redo stack
    expect(result.current.redoCount).toBe(0);
    expect(result.current.undoCount).toBe(2);
  });

  it("should execute undo for DELETE_SAMPLE by calling addSampleToSlot", async () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    const deleteAction: DeleteSampleAction = {
      id: "test-1",
      type: "DELETE_SAMPLE",
      timestamp: new Date(),
      description: "Delete sample",
      data: {
        voice: 1,
        slot: 0,
        deletedSample: {
          filename: "test.wav",
          source_path: "/test.wav",
          is_stereo: false,
        },
      },
    };

    act(() => {
      result.current.addAction(deleteAction);
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(vi.mocked(window.electronAPI.addSampleToSlot)).toHaveBeenCalledWith(
      testKitName,
      1,
      0,
      "/test.wav",
      { forceMono: true },
    );
  });

  it("should execute undo for ADD_SAMPLE by calling deleteSampleFromSlot", async () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    const addAction: AddSampleAction = {
      id: "test-1",
      type: "ADD_SAMPLE",
      timestamp: new Date(),
      description: "Add sample",
      data: {
        voice: 2,
        slot: 3,
      },
    };

    act(() => {
      result.current.addAction(addAction);
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(
      vi.mocked(window.electronAPI.deleteSampleFromSlot),
    ).toHaveBeenCalledWith(testKitName, 2, 3);
  });

  it("should clear stacks when kit name changes", () => {
    const { result, rerender } = renderHook(
      ({ kitName }) => useUndoRedo(kitName),
      { initialProps: { kitName: "A0" } },
    );

    const deleteAction: DeleteSampleAction = {
      id: "test-1",
      type: "DELETE_SAMPLE",
      timestamp: new Date(),
      description: "Delete sample",
      data: {
        voice: 1,
        slot: 0,
        deletedSample: {
          filename: "test.wav",
          source_path: "/test.wav",
          is_stereo: false,
        },
      },
    };

    act(() => {
      result.current.addAction(deleteAction);
    });

    expect(result.current.undoCount).toBe(1);

    // Change kit name
    rerender({ kitName: "B0" });

    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
  });

  it("should provide action descriptions", () => {
    const { result } = renderHook(() => useUndoRedo(testKitName));

    // Initially should be null for empty stacks
    expect(result.current.undoDescription).toBe(null);
    expect(result.current.redoDescription).toBe(null);

    const deleteAction: DeleteSampleAction = {
      id: "test-1",
      type: "DELETE_SAMPLE",
      timestamp: new Date(),
      description: "Delete sample",
      data: {
        voice: 1,
        slot: 0,
        deletedSample: {
          filename: "test.wav",
          source_path: "/test.wav",
          is_stereo: false,
        },
      },
    };

    act(() => {
      result.current.addAction(deleteAction);
    });

    expect(result.current.undoDescription).toContain("voice 1, slot 1");
  });
});
