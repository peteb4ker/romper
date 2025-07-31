import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGlobalKeyboardShortcuts } from "../useGlobalKeyboardShortcuts";
import { useUndoRedo } from "../useUndoRedo";

// Mock the useUndoRedo hook
vi.mock("../useUndoRedo");

describe("useGlobalKeyboardShortcuts - Basic Tests", () => {
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();
  const mockAddAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUndo.mockClear();
    mockRedo.mockClear();
    mockAddAction.mockClear();

    // Setup default mock implementation
    vi.mocked(useUndoRedo).mockReturnValue({
      canUndo: true,
      canRedo: true,
      isUndoing: false,
      isRedoing: false,
      undo: mockUndo,
      redo: mockRedo,
      addAction: mockAddAction,
      undoDescription: "Undo last action",
      redoDescription: "Redo last action",
      undoCount: 1,
      redoCount: 0,
      error: null,
      clearError: vi.fn(),
    });
  });

  it("should handle Cmd+Z for undo when in edit mode", () => {
    renderHook(() =>
      useGlobalKeyboardShortcuts({
        currentKitName: "test-kit",
        isEditMode: true,
      }),
    );

    // Simulate Cmd+Z
    fireEvent.keyDown(document, {
      key: "z",
      metaKey: true,
      shiftKey: false,
    });

    expect(mockUndo).toHaveBeenCalledTimes(1);
  });

  it("should expose hook state correctly", () => {
    const { result } = renderHook(() =>
      useGlobalKeyboardShortcuts({
        currentKitName: "test-kit",
        isEditMode: true,
      }),
    );

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.undoDescription).toBe("Undo last action");
    expect(result.current.redoDescription).toBe("Redo last action");
    expect(result.current.addUndoAction).toBe(mockAddAction);
  });
});
