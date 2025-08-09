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
      addAction: mockAddAction,
      canRedo: true,
      canUndo: true,
      clearError: vi.fn(),
      error: null,
      isRedoing: false,
      isUndoing: false,
      redo: mockRedo,
      redoCount: 0,
      redoDescription: "Redo last action",
      undo: mockUndo,
      undoCount: 1,
      undoDescription: "Undo last action",
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
