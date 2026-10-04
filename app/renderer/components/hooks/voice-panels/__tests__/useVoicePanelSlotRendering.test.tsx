import { SAMPLE_FILE_LABELS } from "@romper/shared/stereoLinkRules";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { slotKey } from "../../../../utils/slotKey";
import { useVoicePanelSlotRendering } from "../useVoicePanelSlotRendering";

describe("useVoicePanelSlotRendering", () => {
  const mockProps = {
    dragAndDropHook: {
      getSampleDragHandlers: vi.fn(() => ({
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragStart: vi.fn(),
        onDrop: vi.fn(),
      })),
      handleDragLeave: vi.fn(),
      handleDragOver: vi.fn(),
      handleDrop: vi.fn(),
      handleInternalDragOver: vi.fn(),
      handleInternalDrop: vi.fn(),
    },
    handleCombinedDragLeave: vi.fn(),
    handleCombinedDragOver: vi.fn(),
    handleCombinedDrop: vi.fn(),
    isActive: true,
    isEditable: true,
    kitName: "TestKit",
    onSampleSelect: vi.fn(),
    onWaveformPlayingChange: vi.fn(),
    playTriggers: {},
    renderDeleteButton: vi.fn(() => <button>Delete</button>),
    renderPlayButton: vi.fn(() => <button>Play</button>),
    sampleActionsHook: {
      handleSampleContextMenu: vi.fn(),
    },
    sampleMetadata: {},
    samplePlaying: {},
    samples: ["sample1.wav", "sample2.wav"],
    selectedIdx: 0,
    slotRenderingHook: {
      calculateRenderSlots: vi.fn(() => ({
        nextAvailableSlot: 2,
        slotsToRender: 12,
      })),
      getSampleSlotClassName: vi.fn(() => "slot-class"),
      getSampleSlotTitle: vi.fn(() => "slot-title"),
      getSlotStyling: vi.fn(() => ({
        dragOverClass: "",
        dropHintTitle: "Drop hint",
        isDragOver: false,
        isDropZone: false,
        slotBaseClass: "base-class",
      })),
    },
    stopTriggers: {},
    voice: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function TestComponent() {
    const { renderSampleSlots } = useVoicePanelSlotRendering(mockProps);
    return <ul>{renderSampleSlots()}</ul>;
  }

  it("returns rendering functions", () => {
    let result: unknown;

    function TestHook() {
      result = useVoicePanelSlotRendering(mockProps);
      return null;
    }

    render(<TestHook />);

    expect(result.renderSampleSlot).toBeDefined();
    expect(result.renderSampleSlots).toBeDefined();
    expect(result.renderSingleDropZone).toBeDefined();
    expect(result.renderEmptySlot).toBeDefined();
  });

  it("renders sample slots correctly", () => {
    const { container } = render(<TestComponent />);

    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(12); // MAX_SLOTS_PER_VOICE
  });

  it("calls slot rendering hook methods", () => {
    render(<TestComponent />);

    expect(mockProps.slotRenderingHook.calculateRenderSlots).toHaveBeenCalled();
    expect(mockProps.slotRenderingHook.getSlotStyling).toHaveBeenCalled();
  });

  it("renders drop zone when editable and not full", () => {
    const { container } = render(<TestComponent />);

    const dropZone = container.querySelector(
      '[data-testid="drop-zone-voice-1"]',
    );
    expect(dropZone).toBeInTheDocument();
  });

  it("does not render drop zone when not editable", () => {
    const notEditableProps = { ...mockProps, isEditable: false };

    function NotEditableComponent() {
      const { renderSampleSlots } =
        useVoicePanelSlotRendering(notEditableProps);
      return <ul>{renderSampleSlots()}</ul>;
    }

    const { container } = render(<NotEditableComponent />);

    const dropZone = container.querySelector(
      '[data-testid="drop-zone-voice-1"]',
    );
    expect(dropZone).not.toBeInTheDocument();
  });

  it("renders waveform component for sample slots", () => {
    const { container } = render(<TestComponent />);

    // Should have sample slots with proper labels for the 2 samples
    const sampleSlots = container.querySelectorAll('[aria-label*="Sample"]');
    expect(sampleSlots.length).toBeGreaterThan(0);
  });

  it("handles sample selection when editable", () => {
    const { container } = render(<TestComponent />);

    const firstSampleSlot = container.querySelector(
      '[aria-label*="sample1.wav"]',
    );
    expect(firstSampleSlot).toBeInTheDocument();

    if (firstSampleSlot) {
      firstSampleSlot.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(mockProps.onSampleSelect).toHaveBeenCalledWith(1, 0);
    }
  });

  describe("file labels (#537)", () => {
    afterEach(cleanup);

    function renderWithStatus(status: null | string) {
      const props = {
        ...mockProps,
        sampleMetadata: {
          [slotKey(1, 0)]: {
            filename: "sample1.wav",
            source_path: "/samples/sample1.wav",
            source_status: status,
          },
        },
      };
      function StatusComponent() {
        const { renderSampleSlots } = useVoicePanelSlotRendering(props);
        return <ul>{renderSampleSlots()}</ul>;
      }
      return render(<StatusComponent />);
    }

    it("labels a sample whose file is missing", () => {
      const { getByTestId } = renderWithStatus("missing");
      const label = getByTestId("sample-file-label-1-0");
      expect(label).toHaveTextContent(SAMPLE_FILE_LABELS.missing);
      const slot = label.closest("li");
      expect(slot).toHaveAttribute("aria-describedby", label.id);
    });

    it("labels a sample whose file can't be read", () => {
      const { getByTestId } = renderWithStatus("unreadable");
      expect(getByTestId("sample-file-label-1-0")).toHaveTextContent(
        SAMPLE_FILE_LABELS.unreadable,
      );
    });

    it("shows no label for a readable or unchecked file", () => {
      for (const status of ["readable", null]) {
        const { queryByTestId, unmount } = renderWithStatus(status);
        expect(queryByTestId("sample-file-label-1-0")).toBeNull();
        unmount();
      }
    });
  });
});
