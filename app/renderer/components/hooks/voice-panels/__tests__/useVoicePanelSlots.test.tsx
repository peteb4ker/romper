import { cleanup, render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVoicePanelSlots } from "../useVoicePanelSlots";

// Mock SampleWaveform component
vi.mock("../../../SampleWaveform", () => ({
  default: ({ kitName, slotNumber, voiceNumber }: unknown) => (
    <div
      data-testid={`sample-waveform-${kitName}-${voiceNumber}-${slotNumber - 1}`}
    >
      Waveform
    </div>
  ),
}));

describe("useVoicePanelSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
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
      isStereoHighlight: false,
      slotBaseClass: "base-class",
    })),
  };

  const mockSampleActionsHook = {
    handleSampleContextMenu: vi.fn(),
  };

  const defaultProps = {
    dragAndDropHook: mockDragAndDropHook,
    isActive: false,
    isEditable: true,
    kitName: "TestKit",
    onSampleSelect: vi.fn(),
    onWaveformPlayingChange: vi.fn(),
    playTriggers: {},
    renderDeleteButton: vi.fn(() => <button>Delete</button>),
    renderPlayButton: vi.fn(() => <button>Play</button>),
    sampleActionsHook: mockSampleActionsHook,
    sampleMetadata: {},
    samplePlaying: {},
    samples: ["sample1.wav", "sample2.wav"],
    selectedIdx: 1,
    slotRenderingHook: mockSlotRenderingHook,
    stopTriggers: {},
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
});
