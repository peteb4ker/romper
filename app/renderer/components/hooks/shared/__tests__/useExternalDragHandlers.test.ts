import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExternalDragHandlers } from "../useExternalDragHandlers";

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

describe("useExternalDragHandlers", () => {
  const mockFileValidation = {
    getFilePathFromDrop: vi.fn(),
    validateDroppedFile: vi.fn(),
  };

  const mockSampleProcessing = {
    getCurrentKitSamples: vi.fn(),
    isDuplicateSample: vi.fn(),
    processAssignment: vi.fn(),
  };

  const mockOnStereoDragLeave = vi.fn();
  const mockOnStereoDragOver = vi.fn();

  const defaultProps = {
    fileValidation: mockFileValidation,
    isEditable: true,
    onStereoDragLeave: mockOnStereoDragLeave,
    onStereoDragOver: mockOnStereoDragOver,
    sampleProcessing: mockSampleProcessing,
    samples: [],
    voice: 2,
  };

  // Shared mock factory functions
  const createMockFile = (name: string) => ({
    name,
    type: "audio/wav",
  });

  const createMockEvent = (files: unknown[]) => {
    // Create corresponding items array for dragover events
    const items = files.map(() => ({ kind: "file" }));

    return {
      altKey: false,
      dataTransfer: {
        files,
        items,
      },
      preventDefault: vi.fn(),
      shiftKey: false,
      stopPropagation: vi.fn(),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("initializes with null state", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      expect(result.current.dragOverSlot).toBeNull();
      expect(result.current.dropZone).toBeNull();
    });

    it("returns all expected functions", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      expect(typeof result.current.handleDragLeave).toBe("function");
      expect(typeof result.current.handleDragOver).toBe("function");
      expect(typeof result.current.handleDrop).toBe("function");
    });
  });

  describe("handleDragOver", () => {
    it("does nothing when not editable", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, isEditable: false }),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBeNull();
    });

    it("prevents default and sets state for file drag", () => {
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 3);
      rerender();

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBe(3);
      expect(result.current.dropZone).toEqual({ mode: "insert", slot: 3 });
    });

    it("calls onStereoDragOver for single file", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 2);

      expect(mockOnStereoDragOver).toHaveBeenCalledWith(2, 2, false);
    });

    it("calls onStereoDragOver for stereo files", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }, { kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 1);

      expect(mockOnStereoDragOver).toHaveBeenCalledWith(2, 1, true);
    });

    it("ignores non-file drags", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      // Mock items that's not an array to simulate browser behavior
      const mockItems = {
        0: { kind: "string" },
        length: 1,
        [Symbol.iterator]: function* () {
          yield this[0];
        },
      };

      const mockEvent = {
        dataTransfer: {
          items: mockItems,
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBeNull();
      expect(mockOnStereoDragOver).not.toHaveBeenCalled();
    });

    it("works without onStereoDragOver callback", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers({
          ...defaultProps,
          onStereoDragOver: undefined,
        }),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      expect(() => {
        result.current.handleDragOver(mockEvent, 1);
      }).not.toThrow();

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("handles Array.from on dataTransfer.items", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      // Mock items that's not a real array
      const mockItems = {
        0: { kind: "file" },
        length: 1,
      };

      const mockEvent = {
        dataTransfer: {
          items: mockItems,
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      // Mock Array.from to return our test data
      const originalArrayFrom = Array.from;
      Array.from = vi.fn().mockReturnValue([{ kind: "file" }]);

      result.current.handleDragOver(mockEvent, 0);

      expect(Array.from).toHaveBeenCalledWith(mockItems);
      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Restore
      Array.from = originalArrayFrom;
    });
  });

  describe("handleDragLeave", () => {
    it("clears drag state", () => {
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      // Set up some drag state first using createMockEvent for consistency
      const mockEvent = createMockEvent([createMockFile("test.wav")]);
      result.current.handleDragOver(mockEvent, 2);
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBe(2);
      expect(result.current.dropZone).not.toBeNull();

      // Now leave
      result.current.handleDragLeave();
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBeNull();
      expect(result.current.dropZone).toBeNull();
    });

    it("calls onStereoDragLeave", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      result.current.handleDragLeave();

      expect(mockOnStereoDragLeave).toHaveBeenCalled();
    });

    it("works without onStereoDragLeave callback", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers({
          ...defaultProps,
          onStereoDragLeave: undefined,
        }),
      );

      expect(() => {
        result.current.handleDragLeave();
      }).not.toThrow();
    });
  });

  describe("handleDrop", () => {
    beforeEach(() => {
      mockFileValidation.getFilePathFromDrop.mockResolvedValue(
        "/path/to/file.wav",
      );
      mockFileValidation.validateDroppedFile.mockResolvedValue({ valid: true });
      mockSampleProcessing.getCurrentKitSamples.mockResolvedValue([]);
      mockSampleProcessing.isDuplicateSample.mockResolvedValue(false);
      mockSampleProcessing.processAssignment.mockResolvedValue(true);
    });

    it("does nothing when not editable", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, isEditable: false }),
      );

      const mockEvent = createMockEvent([createMockFile("test.wav")]);

      await result.current.handleDrop(mockEvent, 1);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockSampleProcessing.getCurrentKitSamples).not.toHaveBeenCalled();
    });

    it("clears drag state on drop", async () => {
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      // Set up drag state using createMockEvent for consistency
      const dragEvent = createMockEvent([createMockFile("test.wav")]);
      result.current.handleDragOver(dragEvent, 2);
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBe(2);

      const mockEvent = createMockEvent([createMockFile("test.wav")]);
      await result.current.handleDrop(mockEvent, 1);
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBeNull();
      expect(result.current.dropZone).toBeNull();
    });

    it("calls onStereoDragLeave on drop", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = createMockEvent([createMockFile("test.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockOnStereoDragLeave).toHaveBeenCalled();
    });

    it("does nothing with no files", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = createMockEvent([]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.getCurrentKitSamples).not.toHaveBeenCalled();
    });

    it("processes single file successfully", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockFile = createMockFile("test.wav");
      const mockEvent = createMockEvent([mockFile]);

      await result.current.handleDrop(mockEvent, 3);

      expect(mockFileValidation.getFilePathFromDrop).toHaveBeenCalledWith(
        mockFile,
      );
      expect(mockFileValidation.validateDroppedFile).toHaveBeenCalledWith(
        "/path/to/file.wav",
      );
      expect(mockSampleProcessing.getCurrentKitSamples).toHaveBeenCalled();
      expect(mockSampleProcessing.isDuplicateSample).toHaveBeenCalledWith(
        [],
        "/path/to/file.wav",
      );
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledWith(
        "/path/to/file.wav",
        { valid: true },
        [],
        { forceMonoDrop: false, forceStereoDrop: false },
        3,
      );
    });

    it("processes multiple files", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockFiles = [
        createMockFile("file1.wav"),
        createMockFile("file2.wav"),
      ];
      const mockEvent = createMockEvent(mockFiles);

      mockFileValidation.getFilePathFromDrop
        .mockResolvedValueOnce("/path/to/file1.wav")
        .mockResolvedValueOnce("/path/to/file2.wav");

      await result.current.handleDrop(mockEvent, 1);

      expect(mockFileValidation.getFilePathFromDrop).toHaveBeenCalledTimes(2);
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledTimes(2);
    });

    it("detects modifier keys", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        ...createMockEvent([createMockFile("test.wav")]),
        altKey: true,
        shiftKey: true,
      };

      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledWith(
        "/path/to/file.wav",
        { valid: true },
        [],
        { forceMonoDrop: true, forceStereoDrop: true },
        1,
      );
    });

    it("skips duplicate files", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      mockSampleProcessing.isDuplicateSample.mockResolvedValue(true);

      const mockEvent = createMockEvent([createMockFile("duplicate.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.processAssignment).not.toHaveBeenCalled();
    });

    it("skips files with invalid format", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      mockFileValidation.validateDroppedFile.mockResolvedValue(null);

      const mockEvent = createMockEvent([createMockFile("invalid.txt")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.processAssignment).not.toHaveBeenCalled();
    });

    it("handles getCurrentKitSamples failure", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      mockSampleProcessing.getCurrentKitSamples.mockResolvedValue(null);

      const mockEvent = createMockEvent([createMockFile("test.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.processAssignment).not.toHaveBeenCalled();
    });

    it("handles errors gracefully", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      mockFileValidation.getFilePathFromDrop.mockRejectedValue(
        new Error("File error"),
      );

      const mockEvent = createMockEvent([createMockFile("error.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(console.error).toHaveBeenCalledWith(
        "Error handling drop:",
        expect.any(Error),
      );
    });

    it("logs dropped file path", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = createMockEvent([createMockFile("logged.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(console.log).toHaveBeenCalledWith(
        "Processing dropped file:",
        "/path/to/file.wav",
      );
    });

    it("works without onStereoDragLeave callback", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers({
          ...defaultProps,
          onStereoDragLeave: undefined,
        }),
      );

      const mockEvent = createMockEvent([createMockFile("test.wav")]);

      expect(async () => {
        await result.current.handleDrop(mockEvent, 1);
      }).not.toThrow();
    });

    it("handles Array.from on dataTransfer.files", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockFiles = {
        0: createMockFile("test.wav"),
        length: 1,
      };

      const mockEvent = {
        altKey: false,
        dataTransfer: {
          files: mockFiles,
        },
        preventDefault: vi.fn(),
        shiftKey: false,
        stopPropagation: vi.fn(),
      } as unknown;

      // Mock Array.from to return our test data
      const originalArrayFrom = Array.from;
      Array.from = vi.fn().mockReturnValue([createMockFile("test.wav")]);

      await result.current.handleDrop(mockEvent, 1);

      expect(Array.from).toHaveBeenCalledWith(mockFiles);
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalled();

      // Restore
      Array.from = originalArrayFrom;
    });
  });

  describe("integration scenarios", () => {
    it("handles complete drag and drop workflow", async () => {
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      // Start drag over using createMockEvent for consistency
      const dragEvent = createMockEvent([createMockFile("test.wav")]);

      result.current.handleDragOver(dragEvent, 2);
      rerender(); // Force rerender to see state updates
      expect(result.current.dragOverSlot).toBe(2);
      expect(mockOnStereoDragOver).toHaveBeenCalledWith(2, 2, false);

      // Drop
      const dropEvent = {
        altKey: false,
        dataTransfer: {
          files: [{ name: "dropped.wav", type: "audio/wav" }],
        },
        preventDefault: vi.fn(),
        shiftKey: false,
        stopPropagation: vi.fn(),
      } as unknown;

      await result.current.handleDrop(dropEvent, 2);
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBeNull();
      expect(mockOnStereoDragLeave).toHaveBeenCalled();
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalled();
    });

    it("handles drag over then drag leave", () => {
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      // Start drag over with two files for stereo test
      const dragEvent = createMockEvent([
        createMockFile("file1.wav"),
        createMockFile("file2.wav"),
      ]);

      result.current.handleDragOver(dragEvent, 1);
      rerender(); // Force rerender to see state updates
      expect(result.current.dragOverSlot).toBe(1);
      expect(result.current.dropZone).toEqual({ mode: "insert", slot: 1 });
      expect(mockOnStereoDragOver).toHaveBeenCalledWith(2, 1, true);

      // Leave
      result.current.handleDragLeave();
      rerender(); // Force rerender to see state updates
      expect(result.current.dragOverSlot).toBeNull();
      expect(result.current.dropZone).toBeNull();
      expect(mockOnStereoDragLeave).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles mixed item kinds in drag over", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }, { kind: "string" }, { kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockOnStereoDragOver).toHaveBeenCalledWith(2, 1, true); // 2 files
    });

    it("handles empty items array in drag over", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = {
        dataTransfer: {
          items: [],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBeNull();
    });

    it("handles voice boundary values", () => {
      const { result: result0 } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, voice: 0 }),
      );
      const { result: result16 } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, voice: 16 }),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result0.current.handleDragOver(mockEvent, 1);
      expect(mockOnStereoDragOver).toHaveBeenCalledWith(0, 1, false);

      result16.current.handleDragOver(mockEvent, 1);
      expect(mockOnStereoDragOver).toHaveBeenCalledWith(16, 1, false);
    });
  });

  describe("12-sample limit handling", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockFileValidation.getFilePathFromDrop.mockResolvedValue("test.wav");
      mockFileValidation.validateDroppedFile.mockResolvedValue({
        name: "test.wav",
      });
      mockSampleProcessing.getCurrentKitSamples.mockResolvedValue([
        "sample1.wav",
      ]);
      mockSampleProcessing.isDuplicateSample.mockResolvedValue(false);
      mockSampleProcessing.processAssignment.mockResolvedValue(true);
    });

    it("blocks external drops when voice has 12 samples", async () => {
      const fullSamples = Array(12).fill("sample.wav");
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: fullSamples }),
      );

      const mockEvent = createMockEvent([createMockFile("new.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.getCurrentKitSamples).not.toHaveBeenCalled();
      expect(mockSampleProcessing.processAssignment).not.toHaveBeenCalled();
    });

    it("allows external drops when voice has less than 12 samples", async () => {
      const partialSamples = Array(11).fill("sample.wav");
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: partialSamples }),
      );

      const mockEvent = createMockEvent([createMockFile("new.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.getCurrentKitSamples).toHaveBeenCalled();
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalled();
    });

    it("allows external drops when voice is empty", async () => {
      const emptySamples: string[] = [];
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: emptySamples }),
      );

      const mockEvent = createMockEvent([createMockFile("new.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.getCurrentKitSamples).toHaveBeenCalled();
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalled();
    });

    it("shows blocked state during drag over full voice", () => {
      const fullSamples = Array(12).fill("sample.wav");
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: fullSamples }),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 1);
      rerender();

      expect(result.current.dragOverSlot).toBe(1);
      expect(result.current.dropZone).toEqual({ mode: "blocked", slot: 1 });
    });

    it("shows insert mode during drag over non-full voice", () => {
      const partialSamples = Array(5).fill("sample.wav");
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: partialSamples }),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 3);
      rerender();

      expect(result.current.dragOverSlot).toBe(3);
      expect(result.current.dropZone).toEqual({ mode: "insert", slot: 3 });
    });

    it("shows append mode when dropping at end of voice", () => {
      const partialSamples = Array(5).fill("sample.wav");
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: partialSamples }),
      );

      const mockEvent = {
        dataTransfer: {
          items: [{ kind: "file" }],
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown;

      result.current.handleDragOver(mockEvent, 5);
      rerender();

      expect(result.current.dragOverSlot).toBe(5);
      expect(result.current.dropZone).toEqual({ mode: "append", slot: 5 });
    });

    it("handles multiple file drops respecting 12-sample limit", async () => {
      const partialSamples = Array(10).fill("sample.wav");
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: partialSamples }),
      );

      const mockFiles = [
        createMockFile("file1.wav"),
        createMockFile("file2.wav"),
        createMockFile("file3.wav"),
      ];
      const mockEvent = createMockEvent(mockFiles);

      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledTimes(3);
    });
  });
});
