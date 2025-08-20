import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInternalDragHandlers } from "../useInternalDragHandlers";

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  vi.clearAllMocks();
});

describe("useInternalDragHandlers", () => {
  const mockOnSampleMove = vi.fn();

  const defaultProps = {
    isEditable: true,
    onSampleMove: mockOnSampleMove,
    samples: ["sample1.wav", "sample2.wav", "", "sample4.wav"],
    voice: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("initializes with null draggedSample", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      expect(result.current.draggedSample).toBeNull();
    });

    it("returns all expected functions", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      expect(typeof result.current.getSampleDragHandlers).toBe("function");
      expect(typeof result.current.handleSampleDragEnd).toBe("function");
      expect(typeof result.current.handleSampleDragLeave).toBe("function");
      expect(typeof result.current.handleSampleDragOver).toBe("function");
      expect(typeof result.current.handleSampleDragStart).toBe("function");
      expect(typeof result.current.handleSampleDrop).toBe("function");
    });
  });

  describe("handleSampleDragStart", () => {
    it("does nothing when not editable", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, isEditable: false }),
      );

      const mockEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;

      result.current.handleSampleDragStart(mockEvent, 0, "sample1.wav");

      expect(result.current.draggedSample).toBeNull();
      expect(mockEvent.dataTransfer.setData).not.toHaveBeenCalled();
    });

    it("sets up drag when editable", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;

      result.current.handleSampleDragStart(mockEvent, 2, "sample3.wav");

      // Trigger re-render to get updated state
      rerender();

      expect(result.current.draggedSample).toEqual({
        sampleName: "sample3.wav",
        slot: 2,
        voice: 1,
      });
      expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith(
        "application/x-romper-sample",
        "true",
      );
      expect(mockEvent.dataTransfer.effectAllowed).toBe("move");
    });
  });

  describe("handleSampleDragEnd", () => {
    it("clears dragged sample", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // First start a drag
      const mockEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;

      result.current.handleSampleDragStart(mockEvent, 0, "sample1.wav");
      rerender();
      expect(result.current.draggedSample).not.toBeNull();

      // End the drag
      result.current.handleSampleDragEnd({} as unknown);
      rerender();
      expect(result.current.draggedSample).toBeNull();
    });
  });

  describe("handleSampleDragOver", () => {
    it("does nothing when not editable", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, isEditable: false }),
      );

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleSampleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("does nothing when no dragged sample", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleSampleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("prevents default for valid internal drag", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag first
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleSampleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockEvent.dataTransfer.dropEffect).toBe("move");
    });

    it("sets dropEffect to none for same slot", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag from slot 2
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 2, "sample3.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      // Try to drag over same slot
      result.current.handleSampleDragOver(mockEvent, 2);

      expect(mockEvent.dataTransfer.dropEffect).toBe("none");
    });

    it("ignores non-internal drags", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag first
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["files"], // Not internal drag
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleSampleDragOver(mockEvent, 1);

      expect(mockEvent.dataTransfer.dropEffect).toBe("");
    });
  });

  describe("handleSampleDragLeave", () => {
    it("executes without errors", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      expect(() => result.current.handleSampleDragLeave()).not.toThrow();
    });
  });

  describe("handleSampleDrop", () => {
    it("does nothing when not editable", async () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, isEditable: false }),
      );

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      await result.current.handleSampleDrop(mockEvent, 1);

      expect(mockOnSampleMove).not.toHaveBeenCalled();
    });

    it("does nothing when no dragged sample", async () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      await result.current.handleSampleDrop(mockEvent, 1);

      expect(mockOnSampleMove).not.toHaveBeenCalled();
    });

    it("does nothing when no onSampleMove callback", async () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, onSampleMove: undefined }),
      );

      // Start drag first
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      await result.current.handleSampleDrop(mockEvent, 1);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("ignores non-internal drops", async () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag first
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");

      const mockEvent = {
        dataTransfer: {
          types: ["files"], // Not internal drag
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      await result.current.handleSampleDrop(mockEvent, 1);

      expect(mockOnSampleMove).not.toHaveBeenCalled();
    });

    it("ignores drop on same slot", async () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag from slot 2
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 2, "sample3.wav");

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      await result.current.handleSampleDrop(mockEvent, 2);

      expect(mockOnSampleMove).not.toHaveBeenCalled();
    });

    it("calls onSampleMove with insert mode for empty slot", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag from slot 0
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      mockOnSampleMove.mockResolvedValue(undefined);

      // Drop on empty slot (index 2 is empty)
      await result.current.handleSampleDrop(mockEvent, 2);

      expect(mockOnSampleMove).toHaveBeenCalledWith(
        1, // fromVoice
        0, // fromSlot
        1, // toVoice
        2, // toSlot
      );
    });

    it("calls onSampleMove with insert mode for same-voice occupied slot", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag from slot 0
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      mockOnSampleMove.mockResolvedValue(undefined);

      // Drop on occupied slot in same voice (should use insert for contiguity)
      await result.current.handleSampleDrop(mockEvent, 1);

      expect(mockOnSampleMove).toHaveBeenCalledWith(
        1, // fromVoice
        0, // fromSlot
        1, // toVoice
        1, // toSlot
      );
    });

    // Note: Cross-voice drag testing is complex as it involves coordination
    // between multiple voice panel hooks. The logic is tested through the
    // same-voice vs cross-voice conditional in the implementation.

    it("clears dragged sample after successful drop", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();
      expect(result.current.draggedSample).not.toBeNull();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      mockOnSampleMove.mockResolvedValue(undefined);

      await result.current.handleSampleDrop(mockEvent, 1);
      rerender();

      expect(result.current.draggedSample).toBeNull();
    });

    it("clears dragged sample after failed drop", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      mockOnSampleMove.mockRejectedValue(new Error("Move failed"));

      await result.current.handleSampleDrop(mockEvent, 1);
      rerender();

      expect(console.error).toHaveBeenCalledWith(
        "Failed to move sample:",
        "Move failed",
      );
      expect(result.current.draggedSample).toBeNull();
    });

    it("calls onSampleMove correctly", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag from slot 0
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      mockOnSampleMove.mockResolvedValue(undefined);

      await result.current.handleSampleDrop(mockEvent, 1);

      // Verify the move function was called with correct arguments
      expect(mockOnSampleMove).toHaveBeenCalledWith(1, 0, 1, 1);
    });
  });

  describe("getSampleDragHandlers", () => {
    it("returns empty object when not editable", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, isEditable: false }),
      );

      const handlers = result.current.getSampleDragHandlers(0, "sample.wav");

      expect(handlers).toEqual({});
    });

    it("returns all drag handlers when editable", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      const handlers = result.current.getSampleDragHandlers(0, "sample.wav");

      expect(handlers).toHaveProperty("onDragEnd");
      expect(handlers).toHaveProperty("onDragLeave");
      expect(handlers).toHaveProperty("onDragOver");
      expect(handlers).toHaveProperty("onDragStart");
      expect(handlers).toHaveProperty("onDrop");

      expect(typeof handlers.onDragEnd).toBe("function");
      expect(typeof handlers.onDragLeave).toBe("function");
      expect(typeof handlers.onDragOver).toBe("function");
      expect(typeof handlers.onDragStart).toBe("function");
      expect(typeof handlers.onDrop).toBe("function");
    });

    it("returned handlers work correctly", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      const handlers = result.current.getSampleDragHandlers(1, "test.wav");

      const mockEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;

      // Test onDragStart
      handlers.onDragStart!(mockEvent);
      rerender();
      expect(result.current.draggedSample).toEqual({
        sampleName: "test.wav",
        slot: 1,
        voice: 1,
      });

      // Test onDragEnd
      handlers.onDragEnd!(mockEvent);
      rerender();
      expect(result.current.draggedSample).toBeNull();
    });
  });

  describe("visual feedback", () => {
    it("sets visual feedback state on drag over", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag first
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      expect(result.current.internalDragOverSlot).toBeNull();
      expect(result.current.internalDropZone).toBeNull();

      // Drag over different slot
      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleSampleDragOver(mockEvent, 1);
      rerender();

      expect(result.current.internalDragOverSlot).toBe(1);
      expect(result.current.internalDropZone).toEqual({
        mode: "insert",
        slot: 1,
      });
    });

    it("clears visual feedback state on drag leave", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag and set up visual state
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const dragOverEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;
      result.current.handleSampleDragOver(dragOverEvent, 1);
      rerender();

      expect(result.current.internalDragOverSlot).toBe(1);

      // Drag leave should clear state
      result.current.handleSampleDragLeave();
      rerender();

      expect(result.current.internalDragOverSlot).toBeNull();
      expect(result.current.internalDropZone).toBeNull();
    });

    it("clears visual feedback state on drag end", () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag and set up visual state
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const dragOverEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;
      result.current.handleSampleDragOver(dragOverEvent, 1);
      rerender();

      expect(result.current.internalDragOverSlot).toBe(1);

      // Drag end should clear all state
      result.current.handleSampleDragEnd({} as unknown);
      rerender();

      expect(result.current.draggedSample).toBeNull();
      expect(result.current.internalDragOverSlot).toBeNull();
      expect(result.current.internalDropZone).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles different voices correctly", () => {
      const { rerender: rerender1, result: result1 } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, voice: 1 }),
      );
      const { rerender: rerender2, result: result2 } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, voice: 3 }),
      );

      const mockEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;

      result1.current.handleSampleDragStart(mockEvent, 0, "sample1.wav");
      rerender1();
      expect(result1.current.draggedSample?.voice).toBe(1);

      result2.current.handleSampleDragStart(mockEvent, 0, "sample1.wav");
      rerender2();
      expect(result2.current.draggedSample?.voice).toBe(3);
    });

    it("handles empty samples array", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers({ ...defaultProps, samples: [] }),
      );

      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      // Verify dragged sample is set
      expect(result.current.draggedSample).not.toBeNull();

      const dropEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      mockOnSampleMove.mockResolvedValue(undefined);

      await result.current.handleSampleDrop(dropEvent, 1);

      expect(mockOnSampleMove).toHaveBeenCalledWith(1, 0, 1, 1);
    });

    it("handles undefined sample in samples array", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers({
          ...defaultProps,
          samples: ["sample1.wav", undefined as unknown, "sample3.wav"],
        }),
      );

      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as unknown;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const dropEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      mockOnSampleMove.mockResolvedValue(undefined);

      // Drop on slot with undefined (should be insert mode)
      await result.current.handleSampleDrop(dropEvent, 1);

      expect(mockOnSampleMove).toHaveBeenCalledWith(1, 0, 1, 1);
    });
  });
});
