import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExternalDragHandlers } from "../useExternalDragHandlers";
import { type DroppedFileCheck } from "../useFileValidation";

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

interface DragEventInit {
  files?: ArrayLike<File>;
  items?: ArrayLike<Pick<DataTransferItem, "kind">>;
}

type Options = Parameters<typeof useExternalDragHandlers>[0];

// jsdom has no DataTransfer, and the hook reads only dataTransfer.files and
// dataTransfer.items (through Array.from) and calls preventDefault and
// stopPropagation, so a plain object with those stands in for the event.
function makeDragEvent({
  files = [],
  items = [],
}: DragEventInit): React.DragEvent {
  return {
    dataTransfer: { files, items },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.DragEvent;
}

/** A format check that passes, with the file's channel count */
const validFile = (channels?: number): DroppedFileCheck => ({
  validation: { issues: [], isValid: true, metadata: { channels } },
});

describe("useExternalDragHandlers", () => {
  const mockFileValidation = {
    getFilePathFromDrop:
      vi.fn<Options["fileValidation"]["getFilePathFromDrop"]>(),
    validateDroppedFile:
      vi.fn<Options["fileValidation"]["validateDroppedFile"]>(),
  };

  const mockSampleProcessing = {
    getCurrentKitSamples:
      vi.fn<Options["sampleProcessing"]["getCurrentKitSamples"]>(),
    isDuplicateSample:
      vi.fn<Options["sampleProcessing"]["isDuplicateSample"]>(),
    processAssignment:
      vi.fn<Options["sampleProcessing"]["processAssignment"]>(),
  };

  const onMessage = vi.fn<NonNullable<Options["onMessage"]>>();

  const defaultProps: Options = {
    fileValidation: mockFileValidation,
    isEditable: true,
    onMessage,
    sampleProcessing: mockSampleProcessing,
    samples: [],
    voice: 2,
  };

  // Shared mock factory functions
  const createMockFile = (name: string) =>
    new File([], name, { type: "audio/wav" });

  // A drop or dragover carrying files: one "file" item per file
  const createMockEvent = (files: File[]) =>
    makeDragEvent({ files, items: files.map(() => ({ kind: "file" })) });

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

      const mockEvent = makeDragEvent({ items: [{ kind: "file" }] });

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBeNull();
    });

    it("prevents default and sets state for file drag", () => {
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = makeDragEvent({ items: [{ kind: "file" }] });

      result.current.handleDragOver(mockEvent, 3);
      rerender();

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBe(0);
      expect(result.current.dropZone).toEqual({ mode: "append", slot: 0 });
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

      const mockEvent = makeDragEvent({ items: mockItems });

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBeNull();
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

      const mockEvent = makeDragEvent({ items: mockItems });

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

      // Empty voice: the file lands in slot 0, whatever is hovered (RE-74)
      expect(result.current.dragOverSlot).toBe(0);
      expect(result.current.dropZone).not.toBeNull();

      // Now leave
      result.current.handleDragLeave();
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBeNull();
      expect(result.current.dropZone).toBeNull();
    });
  });

  describe("[UC-19] handleDrop", () => {
    beforeEach(() => {
      mockFileValidation.getFilePathFromDrop.mockResolvedValue(
        "/path/to/file.wav",
      );
      mockFileValidation.validateDroppedFile.mockResolvedValue(validFile());
      mockSampleProcessing.getCurrentKitSamples.mockResolvedValue([]);
      mockSampleProcessing.isDuplicateSample.mockResolvedValue(false);
      mockSampleProcessing.processAssignment.mockResolvedValue(true);
    });

    // #537: once a drop's files are added, the voice panels hear which
    // were added and their channel counts, to ask or warn about stereo
    it("[UC-19] reports the added files with their channel counts, after adding them", async () => {
      const order: string[] = [];
      const stereoDrop = {
        report: vi.fn(async () => {
          order.push("report");
        }),
      };
      mockSampleProcessing.processAssignment.mockImplementation(async () => {
        order.push("add");
        return true;
      });
      const channels = [1, 2];
      mockFileValidation.validateDroppedFile.mockImplementation(async () =>
        validFile(channels.shift()),
      );
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, stereoDrop }),
      );

      await result.current.handleDrop(
        createMockEvent([
          createMockFile("kick.wav"),
          createMockFile("pad.wav"),
        ]),
        0,
      );

      expect(order).toEqual(["add", "add", "report"]);
      expect(stereoDrop.report).toHaveBeenCalledWith(2, [
        { channels: 1, fileName: "kick.wav" },
        { channels: 2, fileName: "pad.wav" },
      ]);
    });

    it("[UC-19] doesn't report a drop that added nothing", async () => {
      const stereoDrop = { report: vi.fn() };
      mockSampleProcessing.isDuplicateSample.mockResolvedValue(true);
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, stereoDrop }),
      );

      await result.current.handleDrop(
        createMockEvent([createMockFile("kick.wav")]),
        0,
      );

      expect(stereoDrop.report).not.toHaveBeenCalled();
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

      // Empty voice: the file lands in slot 0, whatever is hovered (RE-74)
      expect(result.current.dragOverSlot).toBe(0);

      const mockEvent = createMockEvent([createMockFile("test.wav")]);
      await result.current.handleDrop(mockEvent, 1);
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBeNull();
      expect(result.current.dropZone).toBeNull();
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

      mockFileValidation.validateDroppedFile.mockResolvedValue({
        rejection: "notWav",
      });

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
        "[ExternalDrag] Error handling drop:",
        expect.any(Error),
      );
    });

    it("processes the resolved dropped file path", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = createMockEvent([createMockFile("logged.wav")]);
      await result.current.handleDrop(mockEvent, 1);

      expect(mockSampleProcessing.isDuplicateSample).toHaveBeenCalledWith(
        expect.anything(),
        "/path/to/file.wav",
      );
    });

    it("handles Array.from on dataTransfer.files", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockFiles = {
        0: createMockFile("test.wav"),
        length: 1,
      };

      const mockEvent = makeDragEvent({ files: mockFiles });

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
      // Empty voice: the file lands in slot 0, whatever is hovered (RE-74)
      expect(result.current.dragOverSlot).toBe(0);

      // Drop
      const dropEvent = makeDragEvent({
        files: [createMockFile("dropped.wav")],
      });

      await result.current.handleDrop(dropEvent, 2);
      rerender(); // Force rerender to see state updates

      expect(result.current.dragOverSlot).toBeNull();
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalled();
    });

    it("handles drag over then drag leave", () => {
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      // Start drag over with two files
      const dragEvent = createMockEvent([
        createMockFile("file1.wav"),
        createMockFile("file2.wav"),
      ]);

      result.current.handleDragOver(dragEvent, 1);
      rerender(); // Force rerender to see state updates
      expect(result.current.dragOverSlot).toBe(0);
      expect(result.current.dropZone).toEqual({ mode: "append", slot: 0 });

      // Leave
      result.current.handleDragLeave();
      rerender(); // Force rerender to see state updates
      expect(result.current.dragOverSlot).toBeNull();
      expect(result.current.dropZone).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles mixed item kinds in drag over", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = makeDragEvent({
        items: [{ kind: "file" }, { kind: "string" }, { kind: "file" }],
      });

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("handles empty items array in drag over", () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      const mockEvent = makeDragEvent({ items: [] });

      result.current.handleDragOver(mockEvent, 1);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.dragOverSlot).toBeNull();
    });
  });

  describe("[UC-19] 12-sample limit handling", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockFileValidation.getFilePathFromDrop.mockResolvedValue("test.wav");
      mockFileValidation.validateDroppedFile.mockResolvedValue(validFile());
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

      const mockEvent = makeDragEvent({ items: [{ kind: "file" }] });

      result.current.handleDragOver(mockEvent, 1);
      rerender();

      expect(result.current.dragOverSlot).toBe(1);
      expect(result.current.dropZone).toEqual({ mode: "blocked", slot: 1 });
    });

    it("highlights the slot after the last sample, wherever the pointer is (RE-74)", () => {
      const partialSamples = Array(5).fill("sample.wav");
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: partialSamples }),
      );

      const mockEvent = makeDragEvent({ items: [{ kind: "file" }] });

      result.current.handleDragOver(mockEvent, 3);
      rerender();

      // Hovering slot 3 of 5: the file will land in slot 5, so that's what
      // lights up, never an "insert" the drop doesn't do
      expect(result.current.dragOverSlot).toBe(5);
      expect(result.current.dropZone).toEqual({ mode: "append", slot: 5 });
    });

    it("shows append mode when dropping at end of voice", () => {
      const partialSamples = Array(5).fill("sample.wav");
      const { rerender, result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, samples: partialSamples }),
      );

      const mockEvent = makeDragEvent({ items: [{ kind: "file" }] });

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

      // Only 2 slots available (10 and 11), so only 2 files can be added
      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledTimes(2);
    });
  });

  describe("[UC-19] [UC-36] telling the user about rejected files (RE-40)", () => {
    const files = (...names: string[]) => names.map(createMockFile);

    beforeEach(() => {
      mockFileValidation.getFilePathFromDrop.mockImplementation(
        async (file: File) => `/src/${file.name}`,
      );
      mockFileValidation.validateDroppedFile.mockResolvedValue(validFile());
      mockSampleProcessing.getCurrentKitSamples.mockResolvedValue([]);
      mockSampleProcessing.isDuplicateSample.mockResolvedValue(false);
      mockSampleProcessing.processAssignment.mockResolvedValue(true);
    });

    it("says nothing when every file is added", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      await result.current.handleDrop(createMockEvent(files("a.wav")), 0);

      expect(onMessage).not.toHaveBeenCalled();
    });

    it("names a file dropped on a full voice", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers({
          ...defaultProps,
          samples: Array(12).fill("s.wav"),
        }),
      );

      await result.current.handleDrop(createMockEvent(files("kick.wav")), 0);

      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        "kick.wav wasn't added: voice 2 is full (12 samples). Delete one to make room.",
        "warning",
      );
    });

    it("names the files left over when the voice fills up", async () => {
      const { result } = renderHook(() =>
        useExternalDragHandlers({
          ...defaultProps,
          samples: Array(11).fill("s.wav"),
        }),
      );

      await result.current.handleDrop(
        createMockEvent(files("a.wav", "b.wav", "c.wav")),
        0,
      );

      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        "b.wav and c.wav weren't added: voice 2 is full (12 samples). Delete one to make room.",
        "warning",
      );
    });

    it("names a duplicate", async () => {
      mockSampleProcessing.isDuplicateSample.mockResolvedValue(true);
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      await result.current.handleDrop(createMockEvent(files("snare.wav")), 0);

      expect(onMessage).toHaveBeenCalledWith(
        "snare.wav wasn't added: it's already in voice 2.",
        "warning",
      );
    });

    it("names a file that isn't a WAV", async () => {
      mockFileValidation.validateDroppedFile.mockResolvedValue({
        rejection: "notWav",
      });
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      await result.current.handleDrop(createMockEvent(files("notes.txt")), 0);

      expect(onMessage).toHaveBeenCalledWith(
        "notes.txt wasn't added: only WAV files can be added.",
        "warning",
      );
    });

    it("gives one message for several rejected files and adds the rest", async () => {
      mockSampleProcessing.isDuplicateSample.mockImplementation(
        async (_all: unknown[], filePath: string) =>
          filePath === "/src/kick.wav",
      );
      mockFileValidation.validateDroppedFile.mockImplementation(
        async (filePath: string) =>
          filePath.endsWith(".txt") ? { rejection: "notWav" } : validFile(),
      );
      const onBatchDropComplete = vi.fn();
      const { result } = renderHook(() =>
        useExternalDragHandlers({ ...defaultProps, onBatchDropComplete }),
      );

      await result.current.handleDrop(
        createMockEvent(files("kick.wav", "notes.txt", "hat.wav", "a.txt")),
        0,
      );

      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledTimes(1);
      expect(onBatchDropComplete).toHaveBeenCalled();
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        "kick.wav wasn't added: it's already in voice 2. " +
          "notes.txt and a.txt weren't added: only WAV files can be added.",
        "warning",
      );
    });

    it("reports an error when the kit's samples can't be read", async () => {
      mockSampleProcessing.getCurrentKitSamples.mockResolvedValue(null);
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      await result.current.handleDrop(
        createMockEvent(files("a.wav", "b.wav")),
        0,
      );

      expect(onMessage).toHaveBeenCalledWith(
        "a.wav and b.wav weren't added: Romper couldn't check them. Try again.",
        "error",
      );
    });

    it("reports an error for the files left when the drop fails", async () => {
      mockFileValidation.validateDroppedFile
        .mockResolvedValueOnce(validFile())
        .mockRejectedValueOnce(new Error("IPC channel closed"));
      const { result } = renderHook(() =>
        useExternalDragHandlers(defaultProps),
      );

      await result.current.handleDrop(
        createMockEvent(files("a.wav", "b.wav", "c.wav")),
        0,
      );

      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        "b.wav and c.wav weren't added: Romper couldn't check them. Try again.",
        "error",
      );
      // The raw reason stays in the log
      expect(onMessage.mock.calls[0][0]).not.toContain("IPC channel closed");
    });
  });

  // #542: an add main refuses tells the user itself (handleSampleAdd), so
  // the drop must not count it as added
  describe("[UC-19] [Q-07] counting only the files that were added", () => {
    const files = (...names: string[]) => names.map(createMockFile);

    beforeEach(() => {
      mockFileValidation.getFilePathFromDrop.mockImplementation(
        async (file: File) => `/src/${file.name}`,
      );
      mockFileValidation.validateDroppedFile.mockImplementation(
        async (path: string) => validFile(path.includes("pad") ? 2 : 1),
      );
      mockSampleProcessing.getCurrentKitSamples.mockResolvedValue([]);
      mockSampleProcessing.isDuplicateSample.mockResolvedValue(false);
    });

    it("doesn't count a refused add as added", async () => {
      mockSampleProcessing.processAssignment.mockImplementation(
        async (filePath: string) => !filePath.includes("refused"),
      );
      const onBatchDropComplete = vi.fn();
      const stereoDrop = { report: vi.fn().mockResolvedValue(undefined) };
      const { result } = renderHook(() =>
        useExternalDragHandlers({
          ...defaultProps,
          onBatchDropComplete,
          stereoDrop,
        }),
      );

      await result.current.handleDrop(
        createMockEvent(files("refused.wav", "pad.wav")),
        0,
      );

      // Only the file that was added is reported as added
      expect(stereoDrop.report).toHaveBeenCalledWith(2, [
        { channels: 2, fileName: "pad.wav" },
      ]);
      expect(onBatchDropComplete).toHaveBeenCalledTimes(1);
      // The refused file's slot stays free for the next file
      expect(mockSampleProcessing.processAssignment.mock.calls).toEqual([
        ["/src/refused.wav", 0],
        ["/src/pad.wav", 0],
      ]);
      // The add already said why; the drop doesn't add a second message
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("reports nothing as added when every add is refused", async () => {
      mockSampleProcessing.processAssignment.mockResolvedValue(false);
      const onBatchDropComplete = vi.fn();
      const stereoDrop = { report: vi.fn().mockResolvedValue(undefined) };
      const { result } = renderHook(() =>
        useExternalDragHandlers({
          ...defaultProps,
          onBatchDropComplete,
          stereoDrop,
        }),
      );

      await result.current.handleDrop(
        createMockEvent(files("kick.wav", "pad.wav")),
        0,
      );

      expect(mockSampleProcessing.processAssignment).toHaveBeenCalledTimes(2);
      expect(stereoDrop.report).not.toHaveBeenCalled();
      expect(onBatchDropComplete).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });
  });
});
