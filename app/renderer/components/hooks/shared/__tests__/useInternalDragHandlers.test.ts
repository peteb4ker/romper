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
      } as any;

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
      } as any;

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

    it("logs drag start message", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as any;

      result.current.handleSampleDragStart(mockEvent, 1, "test.wav");

      expect(console.log).toHaveBeenCalledWith(
        "Dragging sample test.wav from slot 1",
      );
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
      } as any;

      result.current.handleSampleDragStart(mockEvent, 0, "sample1.wav");
      rerender();
      expect(result.current.draggedSample).not.toBeNull();

      // End the drag
      result.current.handleSampleDragEnd({} as any);
      rerender();
      expect(result.current.draggedSample).toBeNull();
    });

    it("logs drag end message", () => {
      const { result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      result.current.handleSampleDragEnd({} as any);

      expect(console.log).toHaveBeenCalledWith("Sample drag ended");
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
      } as any;

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
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 2, "sample3.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");

      const mockEvent = {
        dataTransfer: {
          dropEffect: "",
          types: ["files"], // Not internal drag
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

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
      } as any;

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
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");

      const mockEvent = {
        dataTransfer: {
          types: ["files"], // Not internal drag
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 2, "sample3.wav");

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      mockOnSampleMove.mockResolvedValue(undefined);

      // Drop on empty slot (index 2 is empty)
      await result.current.handleSampleDrop(mockEvent, 2);

      expect(mockOnSampleMove).toHaveBeenCalledWith(
        1, // fromVoice
        0, // fromSlot
        1, // toVoice
        2, // toSlot
        "insert",
      );
    });

    it("calls onSampleMove with overwrite mode for occupied slot", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag from slot 0
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      mockOnSampleMove.mockResolvedValue(undefined);

      // Drop on occupied slot (index 1 has sample2.wav)
      await result.current.handleSampleDrop(mockEvent, 1);

      expect(mockOnSampleMove).toHaveBeenCalledWith(
        1, // fromVoice
        0, // fromSlot
        1, // toVoice
        1, // toSlot
        "overwrite",
      );
    });

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();
      expect(result.current.draggedSample).not.toBeNull();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

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
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      mockOnSampleMove.mockRejectedValue(new Error("Move failed"));

      await result.current.handleSampleDrop(mockEvent, 1);
      rerender();

      expect(console.error).toHaveBeenCalledWith(
        "Failed to move sample:",
        expect.any(Error),
      );
      expect(result.current.draggedSample).toBeNull();
    });

    it("logs move operation", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers(defaultProps),
      );

      // Start drag from slot 0
      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const mockEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      mockOnSampleMove.mockResolvedValue(undefined);

      await result.current.handleSampleDrop(mockEvent, 1);

      expect(console.log).toHaveBeenCalledWith(
        "Moving sample from voice 1 slot 0 to voice 1 slot 1",
      );
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
      } as any;

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
      } as any;

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
      } as any;
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
      } as any;

      mockOnSampleMove.mockResolvedValue(undefined);

      await result.current.handleSampleDrop(dropEvent, 1);

      expect(mockOnSampleMove).toHaveBeenCalledWith(1, 0, 1, 1, "insert");
    });

    it("handles undefined sample in samples array", async () => {
      const { rerender, result } = renderHook(() =>
        useInternalDragHandlers({
          ...defaultProps,
          samples: ["sample1.wav", undefined as any, "sample3.wav"],
        }),
      );

      const startEvent = {
        dataTransfer: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      } as any;
      result.current.handleSampleDragStart(startEvent, 0, "sample1.wav");
      rerender();

      const dropEvent = {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      mockOnSampleMove.mockResolvedValue(undefined);

      // Drop on slot with undefined (should be insert mode)
      await result.current.handleSampleDrop(dropEvent, 1);

      expect(mockOnSampleMove).toHaveBeenCalledWith(1, 0, 1, 1, "insert");
    });
  });
});
