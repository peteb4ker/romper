import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SampleData } from "../../kitTypes";

import { useVoicePanelRendering } from "../useVoicePanelRendering";

describe("useVoicePanelRendering", () => {
  const mockOnPlay = vi.fn();
  const mockOnSampleSelect = vi.fn();
  const mockOnStop = vi.fn();
  const mockOnWaveformPlayingChange = vi.fn();

  const mockSampleData: SampleData = {
    source_path: "/path/to/kick.wav",
  };

  const defaultProps = {
    // Mock hook dependencies
    dragAndDropHook: {
      dragOverSlot: null,
      dropZone: null,
      getSampleDragHandlers: vi.fn(() => ({
        onDragEnd: vi.fn(),
        onDragStart: vi.fn(),
      })),
      handleDragLeave: vi.fn(),
      handleDragOver: vi.fn(),
      handleDrop: vi.fn(),
    },
    isActive: true,
    isEditable: true,
    kitName: "TestKit",
    onPlay: mockOnPlay,
    onSampleSelect: mockOnSampleSelect,
    onStop: mockOnStop,
    onWaveformPlayingChange: mockOnWaveformPlayingChange,
    playTriggers: { "1:kick.wav": 1 },
    sampleActionsHook: {
      handleDeleteSample: vi.fn(),
      handleSampleContextMenu: vi.fn(),
    },
    sampleMetadata: { "kick.wav": mockSampleData },
    samplePlaying: { "1:kick.wav": false },
    samples: ["kick.wav", "snare.wav", "", ""],
    selectedIdx: 0,
    slotRenderingHook: {
      calculateRenderSlots: vi.fn(() => ({
        nextAvailableSlot: 2,
        slotsToRender: 3,
      })),
      getSampleSlotClassName: vi.fn(
        (_, baseClass, dragOverClass) =>
          `${baseClass}${dragOverClass}${" bg-blue-100 font-bold ring-2 ring-blue-300"}`,
      ),
      getSampleSlotTitle: vi.fn((slotNumber, sampleData) =>
        sampleData?.source_path
          ? `Slot ${slotNumber}\\nSource: ${sampleData.source_path}`
          : `Slot ${slotNumber}`,
      ),
      getSlotStyling: vi.fn(() => ({
        dragOverClass: "",
        dropHintTitle: "",
        isDragOver: false,
        isDropZone: false,
        isStereoHighlight: false,
        slotBaseClass: "truncate flex items-center gap-2 mb-1 min-h-[28px]",
      })),
    },

    stopTriggers: { "1:kick.wav": 0 },
    voice: 1,
    voiceName: "Drums",
    voiceNameEditorHook: {
      editing: false,
      editValue: "",
      handleCancel: vi.fn(),
      handleKeyDown: vi.fn(),
      handleSave: vi.fn(),
      setEditValue: vi.fn(),
      startEditing: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock return values
    defaultProps.slotRenderingHook.calculateRenderSlots.mockReturnValue({
      nextAvailableSlot: 2,
      slotsToRender: 3,
    });
    defaultProps.slotRenderingHook.getSlotStyling.mockReturnValue({
      dragOverClass: "",
      dropHintTitle: "",
      isDragOver: false,
      isDropZone: false,
      isStereoHighlight: false,
      slotBaseClass: "truncate flex items-center gap-2 mb-1 min-h-[28px]",
    });
  });

  describe("renderVoiceName", () => {
    it("renders voice name display mode correctly", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const component = result.current.renderVoiceName();
      const { container } = render(<>{component}</>);

      expect(container.textContent).toContain("1:");
      expect(container.textContent).toContain("Drums");
    });

    it("renders voice name editing mode correctly", () => {
      const editingProps = {
        ...defaultProps,
        voiceNameEditorHook: {
          ...defaultProps.voiceNameEditorHook,
          editing: true,
          editValue: "New Name",
        },
      };

      const { result } = renderHook(() => useVoicePanelRendering(editingProps));

      const component = result.current.renderVoiceName();
      const { container } = render(<>{component}</>);

      const input = container.querySelector("input");
      expect(input?.value).toBe("New Name");
    });

    it("renders no voice name set when voiceName is null", () => {
      const noNameProps = {
        ...defaultProps,
        voiceName: null,
      };

      const { result } = renderHook(() => useVoicePanelRendering(noNameProps));

      const component = result.current.renderVoiceName();
      const { container } = render(<>{component}</>);

      expect(container.textContent).toContain("No voice name set");
    });
  });

  describe("renderSlotNumbers", () => {
    it("renders correct number of slot numbers", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const components = result.current.renderSlotNumbers();
      const { container } = render(<>{components}</>);

      const slotNumbers = container.querySelectorAll(
        "[data-testid*='slot-number-1-']",
      );
      expect(slotNumbers).toHaveLength(3);

      expect(slotNumbers[0].textContent).toBe("1.");
      expect(slotNumbers[1].textContent).toBe("2.");
      expect(slotNumbers[2].textContent).toBe("3.");
    });
  });

  describe("renderSampleSlots", () => {
    it("renders sample slots correctly", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const slots = result.current.renderSampleSlots();
      expect(slots).toHaveLength(3); // 2 filled samples + 1 empty drop target
    });

    it("calls slot rendering hook methods", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      result.current.renderSampleSlots();

      expect(
        defaultProps.slotRenderingHook.calculateRenderSlots,
      ).toHaveBeenCalled();
    });
  });

  describe("renderPlayButton", () => {
    it("renders play button when not playing", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const button = result.current.renderPlayButton(false, "kick.wav");
      const { container } = render(<>{button}</>);

      const playButton = container.querySelector("button");
      expect(playButton?.getAttribute("aria-label")).toBe("Play");
    });

    it("renders stop button when playing", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const button = result.current.renderPlayButton(true, "kick.wav");
      const { container } = render(<>{button}</>);

      const stopButton = container.querySelector("button");
      expect(stopButton?.getAttribute("aria-label")).toBe("Stop");
    });

    it("calls onPlay when play button is clicked", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const button = result.current.renderPlayButton(false, "kick.wav");
      const { container } = render(<>{button}</>);

      const playButton = container.querySelector("button");
      playButton?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(1, "kick.wav");
    });

    it("calls onStop when stop button is clicked", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const button = result.current.renderPlayButton(true, "kick.wav");
      const { container } = render(<>{button}</>);

      const stopButton = container.querySelector("button");
      stopButton?.click();

      expect(mockOnStop).toHaveBeenCalledWith(1, "kick.wav");
    });
  });

  describe("renderSampleSlot", () => {
    it("renders sample slot with correct structure", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const slot = result.current.renderSampleSlot(0, "kick.wav");
      const { container } = render(<>{slot}</>);

      const listItem = container.querySelector("li");
      expect(listItem).toBeTruthy();
      expect(listItem?.getAttribute("aria-label")).toBe(
        "Sample kick.wav in slot 0",
      );
      expect(listItem?.getAttribute("draggable")).toBe("true");
    });

    it("calls drag and drop handlers correctly", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      result.current.renderSampleSlot(0, "kick.wav");

      expect(
        defaultProps.dragAndDropHook.getSampleDragHandlers,
      ).toHaveBeenCalledWith(0, "kick.wav");
    });

    it("calls slot rendering methods correctly", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      result.current.renderSampleSlot(0, "kick.wav");

      expect(
        defaultProps.slotRenderingHook.getSlotStyling,
      ).toHaveBeenCalledWith(0, "kick.wav");
      expect(
        defaultProps.slotRenderingHook.getSampleSlotClassName,
      ).toHaveBeenCalled();
      expect(
        defaultProps.slotRenderingHook.getSampleSlotTitle,
      ).toHaveBeenCalled();
    });
  });

  describe("renderEmptySlot", () => {
    it("renders empty slot correctly", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const slot = result.current.renderEmptySlot(2, true);
      const { container } = render(<>{slot}</>);

      const listItem = container.querySelector("li");
      expect(listItem).toBeTruthy();
      expect(listItem?.getAttribute("aria-label")).toBe("Empty slot 2");
      expect(container.textContent).toContain("Drop WAV file here");
    });

    it("renders empty slot for non-editable mode", () => {
      const nonEditableProps = {
        ...defaultProps,
        isEditable: false,
      };

      const { result } = renderHook(() =>
        useVoicePanelRendering(nonEditableProps),
      );

      const slot = result.current.renderEmptySlot(2, true);
      const { container } = render(<>{slot}</>);

      const placeholder = container.querySelector(".w-2.h-2");
      expect(placeholder).toBeTruthy();
    });

    it("adds drag handlers for drop targets when editable", () => {
      const { result } = renderHook(() => useVoicePanelRendering(defaultProps));

      const slot = result.current.renderEmptySlot(2, true);
      const { container } = render(<>{slot}</>);

      const listItem = container.querySelector("li");
      expect(listItem?.getAttribute("data-testid")).toBe("empty-slot-1-2");
    });
  });

  describe("memoization", () => {
    it("should memoize render functions properly", () => {
      const { rerender, result } = renderHook(() =>
        useVoicePanelRendering(defaultProps),
      );

      const firstRender = result.current.renderSampleSlots;

      // Rerender with same props
      rerender();

      const secondRender = result.current.renderSampleSlots;
      expect(firstRender).toBe(secondRender);
    });

    it("should update when dependencies change", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelRendering(props),
        { initialProps: defaultProps },
      );

      const firstRender = result.current.renderSampleSlots;

      // Rerender with different samples
      const newProps = {
        ...defaultProps,
        samples: ["kick.wav", "snare.wav", "hat.wav", ""],
      };
      rerender(newProps);

      const secondRender = result.current.renderSampleSlots;
      expect(firstRender).not.toBe(secondRender);
    });
  });
});
