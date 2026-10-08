import type {
  AnyUndoAction,
  SequenceEditAction,
} from "@romper/shared/undoTypes";

import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { addSampleAction } from "../../../../../../tests/factories/undoAction.factory";
import { useGlobalKeyboardShortcuts } from "../useGlobalKeyboardShortcuts";
import { useUndoRedo } from "../useUndoRedo";

type UndoRedo = ReturnType<typeof useUndoRedo>;

// Mock the useUndoRedo hook
vi.mock("../useUndoRedo");

describe("useGlobalKeyboardShortcuts - Basic Tests", () => {
  // Create fresh mocks for each test
  let mockUndo: Mock<UndoRedo["undo"]>;
  let mockRedo: Mock<UndoRedo["redo"]>;
  let mockAddAction: Mock<UndoRedo["addAction"]>;
  let mockOnBackNavigation: Mock<() => void>;

  /** useUndoRedo's value: something to undo and redo, nothing running */
  const undoRedoState = (overrides: Partial<UndoRedo> = {}): UndoRedo => ({
    addAction: mockAddAction,
    canRedo: true,
    canUndo: true,
    clearError: vi.fn(),
    error: null,
    isRedoing: false,
    isUndoing: false,
    nextRedo: addSampleAction(),
    nextUndo: addSampleAction(),
    redo: mockRedo,
    redoCount: 0,
    redoDescription: "Redo last action",
    undo: mockUndo,
    undoCount: 1,
    undoDescription: "Undo last action",
    ...overrides,
  });

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
    vi.mocked(useUndoRedo).mockReturnValue(undoRedoState());
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
      vi.mocked(useUndoRedo).mockReturnValue(
        undoRedoState({
          canUndo: false,
          undoCount: 0,
          undoDescription: "Nothing to undo",
        }),
      );

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
      vi.mocked(useUndoRedo).mockReturnValue(
        undoRedoState({ isUndoing: true }),
      );

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
      vi.mocked(useUndoRedo).mockReturnValue(
        undoRedoState({ canRedo: false, redoDescription: "Nothing to redo" }),
      );

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
      vi.mocked(useUndoRedo).mockReturnValue(
        undoRedoState({ isRedoing: true }),
      );

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
    const sequenceEdit: SequenceEditAction = {
      data: {
        after: { sliceSteps: [], stepPattern: [], triggerConditions: [] },
        before: { sliceSteps: [], stepPattern: [], triggerConditions: [] },
      },
      description: "Turn step 1 on voice 1 on",
      id: "seq-1",
      timestamp: new Date(),
      type: "SEQUENCE_EDIT",
    };

    function mockNextUndo(nextUndo: AnyUndoAction) {
      vi.mocked(useUndoRedo).mockReturnValue(undoRedoState({ nextUndo }));
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
      mockNextUndo(addSampleAction());
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

    // #500: Escape in a dialog closes the dialog, not the kit behind it,
    // and Cmd+Z there doesn't undo a kit edit
    it("[UC-07] leaves Escape and Cmd+Z to an open modal dialog", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "test-kit",
          isEditMode: true,
          onBackNavigation: mockOnBackNavigation as () => void,
        }),
      );
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      document.body.appendChild(modal);

      fireEvent.keyDown(document.body, { key: "Escape" });
      fireEvent.keyDown(document.body, { key: "z", metaKey: true });

      expect(mockOnBackNavigation).not.toHaveBeenCalled();
      expect(mockUndo).not.toHaveBeenCalled();
      modal.remove();
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

  describe("[UC-06] [UC-26] undo per store and kit (#568)", () => {
    it("keys undo by the local store as well as the kit", () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          currentKitName: "A0",
          isEditMode: true,
          localStorePath: "/stores/two",
        }),
      );

      expect(useUndoRedo).toHaveBeenCalledWith("A0", undefined, "/stores/two");
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
