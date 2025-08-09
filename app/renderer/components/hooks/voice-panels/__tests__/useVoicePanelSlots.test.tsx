import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVoicePanelSlots } from "../useVoicePanelSlots";

// Mock SampleWaveform component - matches actual component structure
vi.mock("../../../SampleWaveform", () => ({
  default: ({
    kitName,
    onError,
    onPlayingChange,
    playTrigger,
    slotNumber,
    stopTrigger,
    voiceNumber,
  }: any) => {
    // Create a component that can handle both click handlers
    const handleCanvasClick = () => {
      if (onPlayingChange) {
        onPlayingChange(true);
      }
    };

    const handleErrorClick = () => {
      if (onError) {
        onError("Mock error");
      }
    };

    return (
      <div
        data-testid={`sample-waveform-${kitName}-${voiceNumber}-${slotNumber - 1}`}
        style={{ alignItems: "center", display: "flex" }}
      >
        <canvas
          className="rounded bg-slate-100 dark:bg-slate-800 shadow align-middle"
          data-play-trigger={playTrigger}
          data-stop-trigger={stopTrigger}
          data-testid={`waveform-canvas-${kitName}-${voiceNumber}-${slotNumber - 1}`}
          onClick={handleCanvasClick}
        />
        <button
          data-testid={`waveform-error-trigger-${kitName}-${voiceNumber}-${slotNumber - 1}`}
          onClick={handleErrorClick}
          style={{ display: "none" }}
        />
      </div>
    );
  },
}));

// Mock the SampleData type
const mockSampleData = {
  filename: "test.wav",
  is_stereo: false,
  source_path: "/path/to/test.wav",
};

describe("useVoicePanelSlots", () => {
  const mockDragAndDropHook = {
    getSampleDragHandlers: vi.fn(() => ({
      onDragEnd: vi.fn(),
      onDragLeave: vi.fn(),
      onDragOver: vi.fn(),
      onDragStart: vi.fn(),
      onDrop: vi.fn(),
    })),
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
  };

  const mockSampleActionsHook = {
    handleSampleContextMenu: vi.fn(),
  };

  const mockSlotRenderingHook = {
    calculateRenderSlots: vi.fn(() => ({
      nextAvailableSlot: 2,
      slotsToRender: 4,
    })),
    getSampleSlotClassName: vi.fn(() => "mock-class-name"),
    getSampleSlotTitle: vi.fn(() => "Mock title"),
    getSlotStyling: vi.fn(() => ({
      dragOverClass: " drag-over",
      dropHintTitle: "Drop hint",
      isDragOver: false,
      isDropZone: false,
      isStereoHighlight: false,
      slotBaseClass: "base-class",
    })),
  };

  const mockRenderDeleteButton = vi.fn(() => (
    <button data-testid="delete-button">Delete</button>
  ));
  const mockRenderPlayButton = vi.fn(() => (
    <button data-testid="play-button">Play</button>
  ));
  const mockOnSampleSelect = vi.fn();
  const mockOnWaveformPlayingChange = vi.fn();

  const defaultProps = {
    dragAndDropHook: mockDragAndDropHook,
    isActive: true,
    isEditable: true,
    kitName: "TestKit",
    onSampleSelect: mockOnSampleSelect,
    onWaveformPlayingChange: mockOnWaveformPlayingChange,
    playTriggers: { "2:sample1.wav": 1 },
    renderDeleteButton: mockRenderDeleteButton,
    renderPlayButton: mockRenderPlayButton,
    sampleActionsHook: mockSampleActionsHook,
    sampleMetadata: { "sample1.wav": mockSampleData },
    samplePlaying: { "2:sample1.wav": false },
    samples: ["sample1.wav", "sample2.wav", "", "sample4.wav"],
    selectedIdx: 0,
    slotRenderingHook: mockSlotRenderingHook,
    stopTriggers: { "2:sample1.wav": 0 },
    voice: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock implementations
    mockSlotRenderingHook.calculateRenderSlots.mockReturnValue({
      nextAvailableSlot: 2,
      slotsToRender: 4,
    });
    mockSlotRenderingHook.getSlotStyling.mockReturnValue({
      dragOverClass: " drag-over",
      dropHintTitle: "Drop hint",
      isDragOver: false,
      isDropZone: false,
      isStereoHighlight: false,
      slotBaseClass: "base-class",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("initialization", () => {
    it("returns render functions", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      expect(typeof result.current.renderEmptySlot).toBe("function");
      expect(typeof result.current.renderSampleSlot).toBe("function");
      expect(typeof result.current.renderSampleSlots).toBe("function");
    });
  });

  describe("renderSampleSlot", () => {
    it("renders filled sample slot correctly", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole, getByTestId } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const listItem = getByRole("option");
      expect(listItem).toHaveAttribute(
        "aria-label",
        "Sample sample1.wav in slot 0",
      );
      expect(listItem).toHaveAttribute("aria-selected", "true"); // selectedIdx = 0, isActive = true
      expect(listItem).toHaveAttribute("draggable", "true");

      expect(getByTestId("play-button")).toBeInTheDocument();
      expect(getByTestId("delete-button")).toBeInTheDocument();
    });

    it("calls slot rendering hook methods with correct parameters", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      render(<div>{result.current.renderSampleSlot(1, "sample2.wav")}</div>);

      expect(mockSlotRenderingHook.getSlotStyling).toHaveBeenCalledWith(
        1,
        "sample2.wav",
      );
      expect(mockSlotRenderingHook.getSampleSlotClassName).toHaveBeenCalledWith(
        1,
        "base-class",
        " drag-over",
      );
      expect(mockSlotRenderingHook.getSampleSlotTitle).toHaveBeenCalledWith(
        2, // slotNumber = slotIndex + 1
        undefined, // no metadata for sample2.wav
        false, // isDragOver
        false, // isStereoHighlight
        false, // isDropZone
        "Drop hint",
      );
    });

    it("gets drag handlers from drag and drop hook", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      render(<div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>);

      expect(mockDragAndDropHook.getSampleDragHandlers).toHaveBeenCalledWith(
        0,
        "sample1.wav",
      );
    });

    it("renders waveform component with correct props", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { container } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      // The canvas should have the data attributes
      const canvas = container.querySelector(
        '[data-testid="waveform-canvas-TestKit-2-0"]',
      );
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute("data-play-trigger", "1");
      expect(canvas).toHaveAttribute("data-stop-trigger", "0");
    });

    it("shows selected styling when slot is selected and active", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { container } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const selectedElement = container.querySelector(
        '[data-testid="sample-selected-voice-2"]',
      );
      expect(selectedElement).toBeInTheDocument();
    });

    it("does not show selected styling when not active", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, isActive: false }),
      );

      const { queryByTestId } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      expect(queryByTestId("sample-selected-voice-2")).not.toBeInTheDocument();
    });

    it("does not show selected styling when different slot is selected", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, selectedIdx: 1 }),
      );

      const { queryByTestId } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      expect(queryByTestId("sample-selected-voice-2")).not.toBeInTheDocument();
    });

    it("handles click events", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderSampleSlot(1, "sample2.wav")}</div>,
      );

      const listItem = getByRole("option");
      listItem.click();

      expect(mockOnSampleSelect).toHaveBeenCalledWith(2, 1);
    });

    it("handles keyboard events", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderSampleSlot(1, "sample2.wav")}</div>,
      );

      const listItem = getByRole("option");

      // Test Enter key
      fireEvent.keyDown(listItem, { key: "Enter" });
      expect(mockOnSampleSelect).toHaveBeenCalledWith(2, 1);

      // Reset mock
      mockOnSampleSelect.mockClear();

      // Test Space key
      fireEvent.keyDown(listItem, { key: " " });
      expect(mockOnSampleSelect).toHaveBeenCalledWith(2, 1);
    });

    it("handles context menu events", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const listItem = getByRole("option");
      fireEvent.contextMenu(listItem);

      expect(
        mockSampleActionsHook.handleSampleContextMenu,
      ).toHaveBeenCalledWith(expect.any(Object), mockSampleData);
    });

    it("displays sample source path in title when available", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { container } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const sampleNameSpan = container.querySelector(".truncate");
      expect(sampleNameSpan).toHaveAttribute(
        "title",
        "sample1.wav\nSource: /path/to/test.wav",
      );
    });

    it("displays only sample name in title when no source path", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({
          ...defaultProps,
          sampleMetadata: {
            "sample1.wav": { ...mockSampleData, source_path: undefined },
          },
        }),
      );

      const { container } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const sampleNameSpan = container.querySelector(".truncate");
      expect(sampleNameSpan).toHaveAttribute("title", "sample1.wav");
    });

    it("does not render delete button when not editable", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, isEditable: false }),
      );

      const { queryByTestId } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      expect(queryByTestId("delete-button")).not.toBeInTheDocument();
    });

    it("handles waveform error events", () => {
      const mockDispatchEvent = vi.fn();
      Object.defineProperty(window, "dispatchEvent", {
        value: mockDispatchEvent,
        writable: true,
      });

      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { container } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const errorButton = container.querySelector(
        '[data-testid="waveform-error-trigger-TestKit-2-0"]',
      );
      if (errorButton) {
        fireEvent.click(errorButton);
      }

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: "Mock error",
          type: "SampleWaveformError",
        }),
      );
    });

    it("handles waveform playing changes", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { container } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const canvas = container.querySelector(
        '[data-testid="waveform-canvas-TestKit-2-0"]',
      );
      if (canvas) {
        fireEvent.click(canvas);
      }

      expect(mockOnWaveformPlayingChange).toHaveBeenCalledWith(
        2,
        "sample1.wav",
        true,
      );
    });

    it("works without onSampleSelect callback", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, onSampleSelect: undefined }),
      );

      expect(() => {
        render(<div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>);
      }).not.toThrow();
    });
  });

  describe("renderEmptySlot", () => {
    it("renders empty slot correctly", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole, getByTestId } = render(
        <div>{result.current.renderEmptySlot(2, true)}</div>,
      );

      const listItem = getByRole("option");
      expect(listItem).toHaveAttribute("aria-label", "Empty slot 2");
      expect(listItem).toHaveAttribute("aria-selected", "false");

      expect(getByTestId("empty-slot-2-2")).toBeInTheDocument();
    });

    it("shows drop message when editable", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { container } = render(
        <div>{result.current.renderEmptySlot(2, true)}</div>,
      );

      expect(container.textContent).toContain("Drop WAV file here");
    });

    it("shows placeholder when not editable", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, isEditable: false }),
      );

      const { container } = render(
        <div>{result.current.renderEmptySlot(2, false)}</div>,
      );

      const placeholder = container.querySelector(".w-2.h-2.bg-gray-200");
      expect(placeholder).toBeInTheDocument();
    });

    it("applies drag handlers when editable and is drop target", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderEmptySlot(2, true)}</div>,
      );

      const listItem = getByRole("option");

      // Test drag over
      fireEvent.dragOver(listItem);
      expect(mockDragAndDropHook.handleDragOver).toHaveBeenCalledWith(
        expect.any(Object),
        2,
      );

      // Test drag leave
      fireEvent.dragLeave(listItem);
      expect(mockDragAndDropHook.handleDragLeave).toHaveBeenCalled();

      // Test drop
      fireEvent.drop(listItem);
      expect(mockDragAndDropHook.handleDrop).toHaveBeenCalledWith(
        expect.any(Object),
        2,
      );
    });

    it("does not apply drag handlers when not editable", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, isEditable: false }),
      );

      const { getByRole } = render(
        <div>{result.current.renderEmptySlot(2, false)}</div>,
      );

      const listItem = getByRole("option");

      // Clear any previous calls
      mockDragAndDropHook.handleDragOver.mockClear();
      mockDragAndDropHook.handleDragLeave.mockClear();
      mockDragAndDropHook.handleDrop.mockClear();

      // Test that handlers are not called
      fireEvent.dragOver(listItem);
      expect(mockDragAndDropHook.handleDragOver).not.toHaveBeenCalled();

      fireEvent.dragLeave(listItem);
      expect(mockDragAndDropHook.handleDragLeave).not.toHaveBeenCalled();

      fireEvent.drop(listItem);
      expect(mockDragAndDropHook.handleDrop).not.toHaveBeenCalled();
    });

    it("does not apply drag handlers when not drop target", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderEmptySlot(1, false)}</div>,
      );

      const listItem = getByRole("option");

      // Clear any previous calls
      mockDragAndDropHook.handleDragOver.mockClear();
      mockDragAndDropHook.handleDragLeave.mockClear();
      mockDragAndDropHook.handleDrop.mockClear();

      // Test that handlers are not called
      fireEvent.dragOver(listItem);
      expect(mockDragAndDropHook.handleDragOver).not.toHaveBeenCalled();

      fireEvent.dragLeave(listItem);
      expect(mockDragAndDropHook.handleDragLeave).not.toHaveBeenCalled();

      fireEvent.drop(listItem);
      expect(mockDragAndDropHook.handleDrop).not.toHaveBeenCalled();
    });

    it("handles click events", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderEmptySlot(3, false)}</div>,
      );

      const listItem = getByRole("option");
      listItem.click();

      expect(mockOnSampleSelect).toHaveBeenCalledWith(2, 3);
    });

    it("handles keyboard events", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderEmptySlot(3, false)}</div>,
      );

      const listItem = getByRole("option");

      // Test Enter key
      fireEvent.keyDown(listItem, { key: "Enter" });
      expect(mockOnSampleSelect).toHaveBeenCalledWith(2, 3);

      // Reset mock
      mockOnSampleSelect.mockClear();

      // Test Space key
      fireEvent.keyDown(listItem, { key: " " });
      expect(mockOnSampleSelect).toHaveBeenCalledWith(2, 3);
    });

    it("shows drop hint title when dragging over", () => {
      mockSlotRenderingHook.getSlotStyling.mockReturnValue({
        dragOverClass: " drag-over",
        dropHintTitle: "Drop to insert here",
        isDragOver: true,
        isDropZone: true,
        isStereoHighlight: false,
        slotBaseClass: "base-class",
      });

      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderEmptySlot(2, true)}</div>,
      );

      const listItem = getByRole("option");
      expect(listItem).toHaveAttribute("title", "Drop to insert here");
    });

    it("applies correct CSS classes", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const { getByRole } = render(
        <div>{result.current.renderEmptySlot(2, true)}</div>,
      );

      const listItem = getByRole("option");
      expect(listItem).toHaveClass(
        "base-class",
        "text-gray-400",
        "dark:text-gray-600",
        "italic",
        "drag-over",
      );
      expect(listItem).toHaveClass(
        "border-2",
        "border-dashed",
        "border-gray-300",
        "dark:border-gray-600",
        "hover:border-orange-400",
        "dark:hover:border-orange-500",
      );
    });

    it("works without onSampleSelect callback", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, onSampleSelect: undefined }),
      );

      expect(() => {
        render(<div>{result.current.renderEmptySlot(2, true)}</div>);
      }).not.toThrow();
    });
  });

  describe("renderSampleSlots", () => {
    it("renders correct combination of sample and empty slots", () => {
      // Mock: 4 slots to render, slot 2 is next available
      mockSlotRenderingHook.calculateRenderSlots.mockReturnValue({
        nextAvailableSlot: 2,
        slotsToRender: 4,
      });

      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const slots = result.current.renderSampleSlots();

      // Should render: sample1.wav, sample2.wav, empty (drop target), sample4.wav
      expect(slots).toHaveLength(4);

      const { container } = render(<div>{slots}</div>);

      expect(container.textContent).toContain("sample1.wav");
      expect(container.textContent).toContain("sample2.wav");
      expect(container.textContent).toContain("Drop WAV file here");
      expect(container.textContent).toContain("sample4.wav");
    });

    it("skips empty slots that are not drop targets", () => {
      // Mock: 3 slots to render, slot 2 is next available (but samples[2] is empty)
      mockSlotRenderingHook.calculateRenderSlots.mockReturnValue({
        nextAvailableSlot: 2,
        slotsToRender: 3,
      });

      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const slots = result.current.renderSampleSlots();

      // Should render: sample1.wav, sample2.wav, empty (drop target)
      // But samples[2] is empty and is the drop target, so it gets rendered
      expect(slots).toHaveLength(3);
    });

    it("handles zero slots to render", () => {
      mockSlotRenderingHook.calculateRenderSlots.mockReturnValue({
        nextAvailableSlot: 0,
        slotsToRender: 0,
      });

      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const slots = result.current.renderSampleSlots();

      expect(slots).toHaveLength(0);
    });

    it("handles all empty slots", () => {
      mockSlotRenderingHook.calculateRenderSlots.mockReturnValue({
        nextAvailableSlot: 0,
        slotsToRender: 3,
      });

      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, samples: ["", "", ""] }),
      );

      const slots = result.current.renderSampleSlots();

      // Should only render the drop target (slot 0)
      expect(slots).toHaveLength(1);

      const { container } = render(<div>{slots}</div>);
      expect(container.textContent).toContain("Drop WAV file here");
    });

    it("handles all filled slots", () => {
      mockSlotRenderingHook.calculateRenderSlots.mockReturnValue({
        nextAvailableSlot: 3,
        slotsToRender: 3,
      });

      const { result } = renderHook(() =>
        useVoicePanelSlots({
          ...defaultProps,
          samples: ["a.wav", "b.wav", "c.wav"],
        }),
      );

      const slots = result.current.renderSampleSlots();

      // Should render all 3 sample slots
      expect(slots).toHaveLength(3);

      const { container } = render(<div>{slots}</div>);
      expect(container.textContent).toContain("a.wav");
      expect(container.textContent).toContain("b.wav");
      expect(container.textContent).toContain("c.wav");
    });

    it("calls calculateRenderSlots", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      result.current.renderSampleSlots();

      expect(mockSlotRenderingHook.calculateRenderSlots).toHaveBeenCalled();
    });

    it("maintains consistent rendering order", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      const slots1 = result.current.renderSampleSlots();
      const slots2 = result.current.renderSampleSlots();

      // Should render the same number of slots consistently
      expect(slots1).toHaveLength(slots2.length);
    });
  });

  describe("memoization and performance", () => {
    it("memoizes render functions based on dependencies", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelSlots(props),
        { initialProps: defaultProps },
      );

      const firstRender = result.current.renderSampleSlot;

      // Rerender with same props
      rerender(defaultProps);

      const secondRender = result.current.renderSampleSlot;

      // Should be the same function reference (memoized)
      expect(firstRender).toBe(secondRender);
    });

    it("recreates render functions when dependencies change", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelSlots(props),
        { initialProps: defaultProps },
      );

      const firstRender = result.current.renderSampleSlot;

      // Change voice number
      rerender({ ...defaultProps, voice: 3 });

      const secondRender = result.current.renderSampleSlot;

      // Should be different function reference
      expect(firstRender).not.toBe(secondRender);
    });
  });

  describe("edge cases", () => {
    it("handles missing sample metadata", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, sampleMetadata: undefined }),
      );

      expect(() => {
        render(<div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>);
      }).not.toThrow();
    });

    it("handles empty sample name", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      expect(() => {
        render(<div>{result.current.renderSampleSlot(0, "")}</div>);
      }).not.toThrow();
    });

    it("handles negative slot index", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      expect(() => {
        render(<div>{result.current.renderSampleSlot(-1, "sample.wav")}</div>);
      }).not.toThrow();
    });

    it("handles very large slot index", () => {
      const { result } = renderHook(() => useVoicePanelSlots(defaultProps));

      expect(() => {
        render(<div>{result.current.renderSampleSlot(999, "sample.wav")}</div>);
      }).not.toThrow();
    });

    it("handles missing play/stop triggers", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({
          ...defaultProps,
          playTriggers: {},
          stopTriggers: {},
        }),
      );

      const { container } = render(
        <div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>,
      );

      const canvas = container.querySelector(
        '[data-testid="waveform-canvas-TestKit-2-0"]',
      );
      expect(canvas).toHaveAttribute("data-play-trigger", "0");
      expect(canvas).toHaveAttribute("data-stop-trigger", "0");
    });

    it("handles missing sample playing state", () => {
      const { result } = renderHook(() =>
        useVoicePanelSlots({ ...defaultProps, samplePlaying: {} }),
      );

      expect(() => {
        render(<div>{result.current.renderSampleSlot(0, "sample1.wav")}</div>);
      }).not.toThrow();

      expect(mockRenderPlayButton).toHaveBeenCalledWith(
        undefined,
        "sample1.wav",
      );
    });
  });
});
