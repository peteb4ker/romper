import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGlobalKeyboardShortcuts } from "../useGlobalKeyboardShortcuts";
import { useUndoRedo } from "../useUndoRedo";

// Mock the useUndoRedo hook
vi.mock("../useUndoRedo");

describe("useGlobalKeyboardShortcuts - Basic Tests", () => {
  // Unmount each test's hook so its document listener can't handle (and
  // mark handled) the next test's key events
  afterEach(() => cleanup());

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

  describe("[UC-26] undo operations", () => {
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

  describe("[UC-26] redo operations", () => {
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

  describe("key ownership", () => {
    const sequenceEdit = {
      data: {
        after: { sliceSteps: [], stepPattern: [], triggerConditions: [] },
        before: { sliceSteps: [], stepPattern: [], triggerConditions: [] },
      },
      description: "Turn step 1 on voice 1 on",
      id: "seq-1",
      timestamp: new Date(),
      type: "SEQUENCE_EDIT" as const,
    };

    function mockNextUndo(nextUndo: unknown) {
      vi.mocked(useUndoRedo).mockReturnValue({
        ...vi.mocked(useUndoRedo)(""),
        nextRedo: null,
        nextUndo,
      } as ReturnType<typeof useUndoRedo>);
    }

    it("undoes a sequencer edit in a locked kit", () => {
      mockNextUndo(sequenceEdit);
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: false,
        }),
      );

      fireEvent.keyDown(document, { key: "z", metaKey: true });

      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it("does not undo a sample edit in a locked kit", () => {
      mockNextUndo({ ...sequenceEdit, type: "ADD_SAMPLE" });
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: false,
        }),
      );

      fireEvent.keyDown(document, { key: "z", metaKey: true });

      expect(mockUndo).not.toHaveBeenCalled();
    });

    it("leaves Cmd+Z in a text field to the field", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );
      const input = document.createElement("input");
      document.body.appendChild(input);

      fireEvent.keyDown(input, { key: "z", metaKey: true });

      expect(mockUndo).not.toHaveBeenCalled();
      input.remove();
    });

    it("does not go back on an Escape a component already handled", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
          onBackNavigation: mockOnBackNavigation as () => void,
        }),
      );
      const button = document.createElement("button");
      button.addEventListener("keydown", (e) => e.preventDefault());
      document.body.appendChild(button);

      fireEvent.keyDown(button, { key: "Escape" });

      expect(mockOnBackNavigation).not.toHaveBeenCalled();
      button.remove();
    });
  });

  describe("Edit menu undo and redo (RE-65)", () => {
    it("undoes and redoes under the same rules as the keys", () => {
      const { result } = renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      expect(result.current.undoIfAllowed()).toBe(true);
      expect(result.current.redoIfAllowed()).toBe(true);

      expect(mockUndo).toHaveBeenCalledTimes(1);
      expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it("does nothing in a locked kit, or with no kit open", () => {
      const locked = renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: false,
        }),
      );
      const noKit = renderHook(() =>
        useGlobalKeyboardShortcuts({ isEditMode: true }),
      );

      expect(locked.result.current.undoIfAllowed()).toBe(false);
      expect(locked.result.current.redoIfAllowed()).toBe(false);
      expect(noKit.result.current.undoIfAllowed()).toBe(false);

      expect(mockUndo).not.toHaveBeenCalled();
      expect(mockRedo).not.toHaveBeenCalled();
    });

    it("marks a handled Cmd+Z so the menu's accelerator doesn't undo again", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "z",
        metaKey: true,
      });

      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it("leaves an unhandled Cmd+Z unmarked, for the menu to handle", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: false,
        }),
      );
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "z",
        metaKey: true,
      });

      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it("treats Shift+Cmd+Z reported as an uppercase Z as redo", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
        }),
      );

      fireEvent.keyDown(document, { key: "Z", metaKey: true, shiftKey: true });

      expect(mockRedo).toHaveBeenCalledTimes(1);
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
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
