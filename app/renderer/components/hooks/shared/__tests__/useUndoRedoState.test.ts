import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoRedoState } from "../useUndoRedoState";

// Mock types for testing
const mockAction = {
  data: { test: "data" },
  type: "ADD_SAMPLE" as const,
};

describe("useUndoRedoState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with empty stacks and no errors", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      expect(result.current.undoStack).toEqual([]);
      expect(result.current.redoStack).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isUndoing).toBe(false);
      expect(result.current.isRedoing).toBe(false);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.undoCount).toBe(0);
      expect(result.current.redoCount).toBe(0);
    });
  });

  describe("addAction", () => {
    it("should add action to undo stack", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      act(() => {
        result.current.addAction(mockAction);
      });

      expect(result.current.undoStack).toHaveLength(1);
      expect(result.current.undoStack[0]).toEqual(mockAction);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.undoCount).toBe(1);
    });

    it("should clear redo stack when adding new action", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Add action, undo it, then add a new action
      act(() => {
        result.current.addAction(mockAction);
      });

      act(() => {
        result.current.handleUndoSuccess(mockAction);
      });

      expect(result.current.redoStack).toHaveLength(1);

      act(() => {
        result.current.addAction({ ...mockAction, type: "DELETE_SAMPLE" });
      });

      expect(result.current.redoStack).toHaveLength(0);
      expect(result.current.canRedo).toBe(false);
    });

    it("should clear error when adding action", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Set error first
      act(() => {
        result.current.setError("Test error");
      });

      expect(result.current.error).toBe("Test error");

      // Add action should clear error
      act(() => {
        result.current.addAction(mockAction);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should set and clear errors", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      act(() => {
        result.current.setError("Test error");
      });

      expect(result.current.error).toBe("Test error");

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("loading states", () => {
    it("should manage undoing state", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      act(() => {
        result.current.setUndoing(true);
      });

      expect(result.current.isUndoing).toBe(true);

      act(() => {
        result.current.setUndoing(false);
      });

      expect(result.current.isUndoing).toBe(false);
    });

    it("should manage redoing state", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      act(() => {
        result.current.setRedoing(true);
      });

      expect(result.current.isRedoing).toBe(true);

      act(() => {
        result.current.setRedoing(false);
      });

      expect(result.current.isRedoing).toBe(false);
    });

    it("should disable canUndo when undoing", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Add action to make canUndo true
      act(() => {
        result.current.addAction(mockAction);
      });

      expect(result.current.canUndo).toBe(true);

      // Set undoing state
      act(() => {
        result.current.setUndoing(true);
      });

      expect(result.current.canUndo).toBe(false);
    });

    it("should disable canRedo when redoing", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Add action and undo it to populate redo stack
      act(() => {
        result.current.addAction(mockAction);
      });

      act(() => {
        result.current.handleUndoSuccess(mockAction);
      });

      expect(result.current.canRedo).toBe(true);

      // Set redoing state
      act(() => {
        result.current.setRedoing(true);
      });

      expect(result.current.canRedo).toBe(false);
    });
  });

  describe("handleUndoSuccess", () => {
    it("should move action from undo to redo stack", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Add action first
      act(() => {
        result.current.addAction(mockAction);
      });

      expect(result.current.undoStack).toHaveLength(1);
      expect(result.current.redoStack).toHaveLength(0);

      // Handle undo success
      act(() => {
        result.current.handleUndoSuccess(mockAction);
      });

      expect(result.current.undoStack).toHaveLength(0);
      expect(result.current.redoStack).toHaveLength(1);
      expect(result.current.redoStack[0]).toEqual(mockAction);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it("should clear error on successful undo", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Add action first
      act(() => {
        result.current.addAction(mockAction);
      });

      // Then set error
      act(() => {
        result.current.setError("Test error");
      });

      expect(result.current.error).toBe("Test error");

      // Handle undo success should clear error
      act(() => {
        result.current.handleUndoSuccess(mockAction);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("handleRedoSuccess", () => {
    it("should move action from redo to undo stack", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Set up redo stack
      act(() => {
        result.current.addAction(mockAction);
        result.current.handleUndoSuccess(mockAction);
      });

      expect(result.current.undoStack).toHaveLength(0);
      expect(result.current.redoStack).toHaveLength(1);

      // Handle redo success
      act(() => {
        result.current.handleRedoSuccess(mockAction);
      });

      expect(result.current.undoStack).toHaveLength(1);
      expect(result.current.redoStack).toHaveLength(0);
      expect(result.current.undoStack[0]).toEqual(mockAction);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it("should clear error on successful redo", () => {
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      // Set up redo stack and error
      act(() => {
        result.current.addAction(mockAction);
        result.current.handleUndoSuccess(mockAction);
        result.current.setError("Test error");
      });

      expect(result.current.error).toBe("Test error");

      // Handle redo success should clear error
      act(() => {
        result.current.handleRedoSuccess(mockAction);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("emitRefreshEvent", () => {
    it("should dispatch custom event with kit name", () => {
      const dispatchEventSpy = vi.spyOn(document, "dispatchEvent");
      const { result } = renderHook(() =>
        useUndoRedoState({ kitName: "Test Kit" }),
      );

      act(() => {
        result.current.emitRefreshEvent();
      });

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { kitName: "Test Kit" },
          type: "romper:refresh-samples",
        }),
      );

      dispatchEventSpy.mockRestore();
    });
  });

  describe("kit name changes", () => {
    it("should clear stacks when kit name changes", () => {
      const { rerender, result } = renderHook(
        ({ kitName }) => useUndoRedoState({ kitName }),
        { initialProps: { kitName: "Original Kit" } },
      );

      // Add some state
      act(() => {
        result.current.addAction(mockAction);
        result.current.handleUndoSuccess(mockAction);
        result.current.setError("Test error");
      });

      expect(result.current.undoStack).toHaveLength(0);
      expect(result.current.redoStack).toHaveLength(1);
      expect(result.current.error).toBe("Test error");

      // Change kit name
      rerender({ kitName: "New Kit" });

      expect(result.current.undoStack).toHaveLength(0);
      expect(result.current.redoStack).toHaveLength(0);
      expect(result.current.error).toBeNull();
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });
});
