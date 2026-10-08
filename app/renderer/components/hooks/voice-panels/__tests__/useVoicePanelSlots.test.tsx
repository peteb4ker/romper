import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSlotPlaybackStore } from "../../kit-management/slotPlaybackStore";
import {
  useVoicePanelSlots,
  type UseVoicePanelSlotsOptions,
} from "../useVoicePanelSlots";

/** A store in which the slot is playing */
function playingStore(key: string) {
  const store = createSlotPlaybackStore();
  store.update(key, (slot) => ({ ...slot, playing: true }));
  return store;
}

// Mock SampleWaveform component; clicking it reports a load error
vi.mock("../../../SampleWaveform", () => ({
  default: ({
    kitName,
    onError,
    slotNumber,
    voiceNumber,
  }: {
    kitName: string;
    onError?: (error: string) => void;
    slotNumber: number;
    voiceNumber: number;
  }) => (
    <div
      data-testid={`sample-waveform-${kitName}-${voiceNumber}-${slotNumber - 1}`}
      onClick={() => onError?.("decode failed")}
    >
      Waveform
    </div>
  ),
}));

describe("useVoicePanelSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDragAndDropHook = {
    getSampleDragHandlers: vi.fn(() => ({})),
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleInternalDragOver: vi.fn(),
    handleInternalDrop: vi.fn(),
  };

  const mockSlotRenderingHook = {
    calculateRenderSlots: vi.fn(() => ({
      nextAvailableSlot: 2,
      slotsToRender: 12,
    })),
    getSampleSlotClassName: vi.fn(() => "sample-slot-class"),
    getSampleSlotTitle: vi.fn(() => "Sample title"),
    getSlotStyling: vi.fn(() => ({
      dragOverClass: "",
      dropHintTitle: "Drop hint",
      isDragOver: false,
      isDropZone: false,
      slotBaseClass: "base-class",
    })),
  };

  const mockSampleActionsHook = {
    handleSampleContextMenu: vi.fn(),
  };

  const defaultProps: UseVoicePanelSlotsOptions = {
    dragAndDropHook: mockDragAndDropHook,
    isActive: false,
    isEditable: true,
    kitName: "TestKit",
    onSampleSelect: vi.fn(),
    onWaveformPlayingChange: vi.fn(),
    playsStereo: false,
    renderDeleteButton: vi.fn(() => <button>Delete</button>),
    renderPlayButton: vi.fn(() => <button>Play</button>),
    sampleActionsHook: mockSampleActionsHook,
    sampleMetadata: {},
    samples: ["sample1.wav", "sample2.wav"],
    selectedIdx: 1,
    slotPlayback: createSlotPlaybackStore(),
    slotRenderingHook: mockSlotRenderingHook,
    voice: 1,
  };

  it("initializes without errors", () => {
    const { result } = renderHook(() => useVoicePanelSlots(defaultProps));
    expect(result.current.renderSampleSlots).toBeDefined();
    expect(result.current.renderSampleSlot).toBeDefined();
  });

  it("renders sample slots correctly", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(screen.getByText("sample1.wav")).toBeInTheDocument();
    expect(screen.getByText("sample2.wav")).toBeInTheDocument();
  });

  it("renders drop zone when voice is not full", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(screen.getByTestId("drop-zone-voice-1")).toBeInTheDocument();
  });

  it("does not render drop zone when voice is full", () => {
    const fullSamples = Array(12)
      .fill(0)
      .map((_, i) => `sample${i + 1}.wav`);
    const fullVoiceProps = { ...defaultProps, samples: fullSamples };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(fullVoiceProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(screen.queryByTestId("drop-zone-voice-1")).not.toBeInTheDocument();
  });

  it("does not render drop zone when not editable", () => {
    const notEditableProps = { ...defaultProps, isEditable: false };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(notEditableProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(screen.queryByTestId("drop-zone-voice-1")).not.toBeInTheDocument();
  });

  it("handles drag events when editable", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    const dropZone = screen.getByTestId("drop-zone-voice-1");

    // Simulate external drag events using fireEvent
    fireEvent.dragOver(dropZone, {
      dataTransfer: {
        types: [], // External drags don't have the internal sample type
      },
    });

    expect(mockDragAndDropHook.handleDragOver).toHaveBeenCalled();
  });

  it("handles internal drag events differently from external", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    const dropZone = screen.getByTestId("drop-zone-voice-1");

    // Simulate internal drag events using fireEvent
    fireEvent.dragOver(dropZone, {
      dataTransfer: {
        types: ["application/x-romper-sample"], // Internal drag identifier
      },
    });

    expect(mockDragAndDropHook.handleInternalDragOver).toHaveBeenCalled();
  });

  it("does not handle drag events when not editable", () => {
    const notEditableProps = {
      ...defaultProps,
      isEditable: false,
      samples: ["sample.wav"],
    };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(notEditableProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    // Should not have drag handlers attached when not editable
    const sampleSlot = screen.getByText("sample.wav").closest("li");
    expect(sampleSlot).not.toHaveAttribute("draggable", "true");
  });

  it("renders sample metadata correctly", () => {
    const propsWithMetadata = {
      ...defaultProps,
      sampleMetadata: {
        "1:0": {
          filename: "sample1.wav",
          source_path: "/path/sample1.wav",
          wav_bit_depth: 16,
          wav_channels: 2,
          wav_sample_rate: 44100,
        },
      },
    };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(propsWithMetadata);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(screen.getByText("sample1.wav")).toBeInTheDocument();
    // Verify that getSampleSlotTitle was called with the metadata
    expect(mockSlotRenderingHook.getSampleSlotTitle).toHaveBeenCalledWith(
      0,
      propsWithMetadata.sampleMetadata["1:0"],
      false,
      false,
      "Drop hint",
      "sample1.wav",
    );
  });

  it("handles sample selection and keyboard interactions", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    const firstSample = screen.getByText("sample1.wav").closest("li");
    expect(firstSample).toBeInTheDocument();

    // Test click selection
    firstSample?.click();
    expect(defaultProps.onSampleSelect).toHaveBeenCalledWith(1, 0);

    // Test keyboard selection (Enter key)
    firstSample?.focus();
    fireEvent.keyDown(firstSample!, { key: "Enter" });
    expect(defaultProps.onSampleSelect).toHaveBeenCalledWith(1, 0);

    // Test keyboard selection (Space key)
    fireEvent.keyDown(firstSample!, { key: " " });
    expect(defaultProps.onSampleSelect).toHaveBeenCalledWith(1, 0);
  });

  it("renders playing state correctly", () => {
    const propsWithPlaying = {
      ...defaultProps,
      slotPlayback: playingStore("1:0"),
    };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(propsWithPlaying);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(defaultProps.renderPlayButton).toHaveBeenCalledWith(true, 0);
  });

  describe("[UC-24] [UC-29] same-named samples (RE-45)", () => {
    const twins = {
      ...defaultProps,
      sampleMetadata: {
        "1:0": { filename: "dup.wav", gain_db: 6, source_path: "/a/dup.wav" },
        "1:1": { filename: "dup.wav", gain_db: -3, source_path: "/b/dup.wav" },
      },
      samples: ["dup.wav", "dup.wav"],
    };

    const renderTwins = (props: UseVoicePanelSlotsOptions) => {
      const TestComponent = () => {
        const { renderSampleSlots } = useVoicePanelSlots(props);
        return <ul>{renderSampleSlots()}</ul>;
      };
      render(<TestComponent />);
      return screen.getAllByRole("option");
    };

    it("shows only the playing slot as playing", () => {
      const [first, second] = renderTwins({
        ...twins,
        slotPlayback: playingStore("1:1"),
      });

      expect(first).toHaveAttribute("data-playing", "false");
      expect(second).toHaveAttribute("data-playing", "true");
      expect(defaultProps.renderPlayButton).toHaveBeenCalledWith(false, 0);
      expect(defaultProps.renderPlayButton).toHaveBeenCalledWith(true, 1);
    });

    it("shows each slot's own gain", () => {
      const [first, second] = renderTwins(twins);

      expect(
        within(first).getByRole("slider").getAttribute("aria-valuenow"),
      ).toBe("6");
      expect(
        within(second).getByRole("slider").getAttribute("aria-valuenow"),
      ).toBe("-3");
    });

    it("reports a gain change for its own slot", () => {
      const onGainChange = vi.fn();
      const [, second] = renderTwins({ ...twins, onGainChange });

      fireEvent.wheel(within(second).getByRole("slider"), { deltaY: -100 });

      expect(onGainChange).toHaveBeenCalledWith(1, 1, "dup.wav", -2);
    });
  });

  it("renders waveform component with correct props", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(
      screen.getByTestId("sample-waveform-TestKit-1-0"),
    ).toBeInTheDocument();
  });

  it("handles context menu events", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    const firstSample = screen.getByText("sample1.wav").closest("li");
    fireEvent.contextMenu(firstSample!);

    expect(mockSampleActionsHook.handleSampleContextMenu).toHaveBeenCalled();
  });

  it("renders delete button when editable", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(defaultProps.renderDeleteButton).toHaveBeenCalledWith(
      0,
      "sample1.wav",
    );
    expect(screen.getAllByText("Delete")).toHaveLength(2); // Two samples
  });

  it("does not render delete button when not editable", () => {
    const notEditableProps = { ...defaultProps, isEditable: false };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(notEditableProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("always renders exactly 12 slots for consistent height", () => {
    const singleSampleProps = { ...defaultProps, samples: ["sample1.wav"] };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(singleSampleProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    const allSlots = screen.getByRole("list").children;
    expect(allSlots).toHaveLength(12); // Always 12 slots
  });

  it("handles empty samples array correctly", () => {
    const emptyProps = { ...defaultProps, samples: [] };

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(emptyProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    const allSlots = screen.getByRole("list").children;
    expect(allSlots).toHaveLength(12); // Still renders 12 slots
    expect(screen.getByTestId("drop-zone-voice-1")).toBeInTheDocument();
  });

  it("renders appropriate accessibility attributes", () => {
    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    const firstSample = screen.getByText("sample1.wav").closest("li");
    expect(firstSample).toHaveAttribute("role", "option");
    expect(firstSample).toHaveAttribute(
      "aria-label",
      "Sample sample1.wav in slot 1",
    );
    expect(firstSample).toHaveAttribute("tabIndex", "0");
  });

  it("announces a waveform load error as a SampleWaveformError event", () => {
    const errors: unknown[] = [];
    const onWaveformError = (e: Event) => {
      if (e instanceof CustomEvent) errors.push(e.detail);
    };
    globalThis.addEventListener("SampleWaveformError", onWaveformError);

    const TestComponent = () => {
      const { renderSampleSlots } = useVoicePanelSlots(defaultProps);
      return <ul>{renderSampleSlots()}</ul>;
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId("sample-waveform-TestKit-1-0"));
    globalThis.removeEventListener("SampleWaveformError", onWaveformError);

    expect(errors).toEqual(["decode failed"]);
  });
});
