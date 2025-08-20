import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGlobalKeyboardShortcuts } from "../useGlobalKeyboardShortcuts";
import { useUndoRedo } from "../useUndoRedo";

// Mock the useUndoRedo hook
vi.mock("../useUndoRedo");

describe("useGlobalKeyboardShortcuts - Basic Tests", () => {
  // Create fresh mocks for each test
  let mockUndo: unknown;
  let mockRedo: unknown;
  let mockAddAction: unknown;
  let mockOnBackNavigation: unknown;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockUndo = vi.fn();
    mockRedo = vi.fn();
    mockAddAction = vi.fn();
    mockOnBackNavigation = vi.fn();

    // Clear all mocks more thoroughly
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Setup default mock implementation with fresh mocks
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

  describe("basic functionality", () => {
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

    it("should handle empty kit name", () => {
      const { result } = renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "",
          isEditMode: true,
        }),
      );

      expect(result.current.addUndoAction).toBe(mockAddAction);
    });
  });

  describe("undo operations", () => {
    it("should handle Cmd+Z for undo when in edit mode", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        metaKey: true,
        shiftKey: false,
      });

      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it("should handle Ctrl+Z for undo on Windows/Linux", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        ctrlKey: true,
        key: "z",
        shiftKey: false,
      });

      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it("should not undo when canUndo is false", () => {
      vi.mocked(useUndoRedo).mockReturnValue({
        addAction: mockAddAction,
        canRedo: true,
        canUndo: false,
        clearError: vi.fn(),
        error: null,
        isRedoing: false,
        isUndoing: false,
        redo: mockRedo,
        redoCount: 0,
        redoDescription: "Redo last action",
        undo: mockUndo,
        undoCount: 0,
        undoDescription: "Nothing to undo",
      });

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        metaKey: true,
        shiftKey: false,
      });

      expect(mockUndo).not.toHaveBeenCalled();
    });

    it("should not undo when isUndoing is true", () => {
      vi.mocked(useUndoRedo).mockReturnValue({
        addAction: mockAddAction,
        canRedo: true,
        canUndo: true,
        clearError: vi.fn(),
        error: null,
        isRedoing: false,
        isUndoing: true,
        redo: mockRedo,
        redoCount: 0,
        redoDescription: "Redo last action",
        undo: mockUndo,
        undoCount: 1,
        undoDescription: "Undo last action",
      });

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        metaKey: true,
        shiftKey: false,
      });

      expect(mockUndo).not.toHaveBeenCalled();
    });
  });

  describe("redo operations", () => {
    it("should handle Cmd+Shift+Z for redo", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        metaKey: true,
        shiftKey: true,
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it("should handle Cmd+Y for redo", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "y",
        metaKey: true,
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it("should handle Ctrl+Y for redo on Windows/Linux", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        ctrlKey: true,
        key: "y",
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it("should not redo when canRedo is false", () => {
      vi.mocked(useUndoRedo).mockReturnValue({
        addAction: mockAddAction,
        canRedo: false,
        canUndo: true,
        clearError: vi.fn(),
        error: null,
        isRedoing: false,
        isUndoing: false,
        redo: mockRedo,
        redoCount: 0,
        redoDescription: "Nothing to redo",
        undo: mockUndo,
        undoCount: 1,
        undoDescription: "Undo last action",
      });

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        metaKey: true,
        shiftKey: true,
      });

      expect(mockRedo).not.toHaveBeenCalled();
    });

    it("should not redo when isRedoing is true", () => {
      vi.mocked(useUndoRedo).mockReturnValue({
        addAction: mockAddAction,
        canRedo: true,
        canUndo: true,
        clearError: vi.fn(),
        error: null,
        isRedoing: true,
        isUndoing: false,
        redo: mockRedo,
        redoCount: 0,
        redoDescription: "Redo last action",
        undo: mockUndo,
        undoCount: 1,
        undoDescription: "Undo last action",
      });

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "y",
        metaKey: true,
      });

      expect(mockRedo).not.toHaveBeenCalled();
    });
  });

  describe("escape key navigation", () => {
    it("should handle escape key for back navigation", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: false,
          onBackNavigation: mockOnBackNavigation,
        }),
      );

      fireEvent.keyDown(document, {
        key: "Escape",
      });

      expect(mockOnBackNavigation).toHaveBeenCalledTimes(1);
    });

    it("should not handle escape when no onBackNavigation provided", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: false,
        }),
      );

      fireEvent.keyDown(document, {
        key: "Escape",
      });

      expect(mockOnBackNavigation).not.toHaveBeenCalled();
    });

    it("should not handle escape when no currentKitName", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          isEditMode: false,
          onBackNavigation: mockOnBackNavigation,
        }),
      );

      fireEvent.keyDown(document, {
        key: "Escape",
      });

      expect(mockOnBackNavigation).not.toHaveBeenCalled();
    });
  });

  describe("edit mode restrictions", () => {
    it("should not handle undo/redo when not in edit mode", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: false,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        metaKey: true,
        shiftKey: false,
      });

      expect(mockUndo).not.toHaveBeenCalled();
    });

    it("should not handle undo/redo when no currentKitName", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        metaKey: true,
        shiftKey: false,
      });

      expect(mockUndo).not.toHaveBeenCalled();
    });

    it("should not handle undo/redo without modifier key", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, {
        key: "z",
        shiftKey: false,
      });

      expect(mockUndo).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should remove event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      const { unmount } = renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        true,
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
