import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useVoicePanelRendering } from "../useVoicePanelRendering";

// Mock SampleWaveform component
vi.mock("../../../SampleWaveform", () => ({
  default: () => <div>Waveform</div>,
}));

describe("useVoicePanelRendering", () => {
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

  const mockPlaybackHook = {
    handlePlay: vi.fn(),
    handleStop: vi.fn(),
    handleWaveformPlayingChange: vi.fn(),
    playbackError: null,
    playTriggers: {},
    samplePlaying: {},
    stopTriggers: {},
  };

  const defaultProps = {
    dragAndDropHook: mockDragAndDropHook,
    isActive: false,
    isEditable: true,
    kitName: "TestKit",
    onSampleDelete: vi.fn(),
    onSampleSelect: vi.fn(),
    onWaveformPlayingChange: vi.fn(),
    playbackHook: mockPlaybackHook,
    playTriggers: {},
    sampleActionsHook: mockSampleActionsHook,
    sampleMetadata: {},
    samplePlaying: {},
    samples: ["kick.wav", "snare.wav"],
    selectedIdx: 1,
    slotRenderingHook: mockSlotRenderingHook,
    stopTriggers: {},
    voice: 1,
  };

  it("initializes without errors", () => {
    const { result } = renderHook(() => useVoicePanelRendering(defaultProps));
    expect(result.current).toBeDefined();
    expect(result.current.renderSampleSlots).toBeDefined();
  });

  it("renders sample slots", () => {
    const { result } = renderHook(() => useVoicePanelRendering(defaultProps));
    const slots = result.current.renderSampleSlots();
    expect(Array.isArray(slots)).toBe(true);
  });

  it("handles empty samples array", () => {
    const propsWithEmptySamples = { ...defaultProps, samples: [] };
    const { result } = renderHook(() =>
      useVoicePanelRendering(propsWithEmptySamples),
    );
    const slots = result.current.renderSampleSlots();
    expect(Array.isArray(slots)).toBe(true);
  });

  it("works in non-editable mode", () => {
    const nonEditableProps = { ...defaultProps, isEditable: false };
    const { result } = renderHook(() =>
      useVoicePanelRendering(nonEditableProps),
    );
    expect(result.current.renderSampleSlots).toBeDefined();
  });
});
