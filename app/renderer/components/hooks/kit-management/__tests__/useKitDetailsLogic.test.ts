import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useKit } from "../useKit";
import { useKitDetailsLogic } from "../useKitDetailsLogic";
import { useKitPlayback } from "../useKitPlayback";
import { useKitVoicePanels } from "../useKitVoicePanels";

// Mock all the hooks that useKitDetailsLogic depends on
vi.mock("../useKit", () => ({
  useKit: vi.fn(() => ({
    error: null,
    kit: {
      alias: "Test Kit",
      artist: "Test Artist",
      bank_letter: "T",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "TestKit",
      step_pattern: null,
    },
    loading: false,
    reloadKit: vi.fn(),
    toggleEditableMode: vi.fn(),
    updateKitAlias: vi.fn(),
  })),
}));

vi.mock("../useVoiceAlias", () => ({
  useVoiceAlias: vi.fn(() => ({
    updateVoiceAlias: vi.fn(),
  })),
}));

vi.mock("../useSampleManagement", () => ({
  useSampleManagement: vi.fn(() => ({
    handleSampleManagement: vi.fn(),
    isManaging: false,
    managementError: null,
    onSampleSelect: vi.fn(),
  })),
}));

vi.mock("../useKitPlayback", () => ({
  useKitPlayback: vi.fn(() => ({
    handlePlay: vi.fn(),
    handleStop: vi.fn(),
    handleWaveformPlayingChange: vi.fn(),
    playbackError: null,
    playbackState: "stopped",
    playTriggers: {},
    samplePlaying: null,
    stopTriggers: {},
  })),
}));

vi.mock("../useKitVoicePanels", () => ({
  useKitVoicePanels: vi.fn(() => ({
    handleVoiceChange: vi.fn(),
    onSampleKeyNav: vi.fn(),
    selectedSlot: 0,
    selectedVoice: 1,
    setSelectedSlot: vi.fn(),
    setSelectedVoice: vi.fn(),
  })),
}));

vi.mock("../useStepPattern", () => ({
  useStepPattern: vi.fn(() => ({
    setStepPattern: vi.fn(),
    stepPattern: null,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
  },
}));

describe("useKitDetailsLogic", () => {
  const mockProps = {
    kitIndex: 0,
    kitName: "TestKit",
    kits: [],
    onBack: vi.fn(),
    onMessage: vi.fn(),
    onNextKit: vi.fn(),
    onPrevKit: vi.fn(),
    onRequestSamplesReload: vi.fn(),
    samples: { 1: [], 2: [], 3: [], 4: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup electronAPI mock after clearAllMocks
    setupElectronAPIMock();

    // Setup default mock for electronAPI methods used in this hook using centralized mocks
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      data: { scannedSamples: 5 },
      success: true,
    });
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    expect(result.current).toBeDefined();
    expect(result.current.kit).toEqual({
      alias: "Test Kit",
      artist: "Test Artist",
      bank_letter: "T",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "TestKit",
      step_pattern: null,
    });
    expect(result.current.kitLoading).toBe(false);
    expect(result.current.kitError).toBeNull();
  });

  it("exposes all required functionality", () => {
    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    // Check that all expected functions are available
    expect(typeof result.current.reloadKit).toBe("function");
    expect(typeof result.current.updateKitAlias).toBe("function");
    expect(typeof result.current.toggleEditableMode).toBe("function");
    expect(typeof result.current.updateVoiceAlias).toBe("function");
    expect(typeof result.current.handleScanKit).toBe("function");
    expect(typeof result.current.setSelectedVoice).toBe("function");
    expect(typeof result.current.setSelectedSampleIdx).toBe("function");
    expect(typeof result.current.setSequencerOpen).toBe("function");
    expect(typeof result.current.setStepPattern).toBe("function");
  });

  it("exposes all required state", () => {
    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    // Check that all expected state is available
    expect(result.current.kit).toBeDefined();
    expect(result.current.kitLoading).toBeDefined();
    expect(result.current.kitError).toBeDefined();
    expect(result.current.samples).toBeDefined();
    expect(result.current.selectedVoice).toBeDefined();
    expect(result.current.selectedSampleIdx).toBeDefined();
    expect(result.current.sequencerOpen).toBeDefined();
    expect(result.current.sequencerGridRef).toBeDefined();
    expect(result.current.stepPattern).toBeDefined();
    expect(result.current.playback).toBeDefined();
    expect(result.current.kitVoicePanels).toBeDefined();
    expect(result.current.sampleManagement).toBeDefined();
  });

  it("handles kit scanning successfully", async () => {
    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    await result.current.handleScanKit();

    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("TestKit");
    expect(mockProps.onRequestSamplesReload).toHaveBeenCalled();
  });

  it("handles kit scanning errors", async () => {
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      error: "Test error",
      success: false,
    });

    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    await result.current.handleScanKit();

    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("TestKit");
    // onRequestSamplesReload should not be called on error
    expect(mockProps.onRequestSamplesReload).not.toHaveBeenCalled();
  });

  it("handles missing rescan API", async () => {
    // Remove the rescanKit method to simulate missing API
    delete (window.electronAPI as any).rescanKit;

    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    await result.current.handleScanKit();

    expect(mockProps.onRequestSamplesReload).not.toHaveBeenCalled();
  });

  it("handles kit scanning without kit name", async () => {
    const propsWithoutKit = { ...mockProps, kitName: "" };
    const { result } = renderHook(() => useKitDetailsLogic(propsWithoutKit));

    await result.current.handleScanKit();

    expect(window.electronAPI.rescanKit).not.toHaveBeenCalled();
  });

  it("initializes with default samples when not provided", () => {
    const propsWithoutSamples = { ...mockProps, samples: undefined };
    const { result } = renderHook(() =>
      useKitDetailsLogic(propsWithoutSamples),
    );

    expect(result.current.samples).toEqual({ 1: [], 2: [], 3: [], 4: [] });
  });

  it("exposes sequencer controls", () => {
    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    expect(result.current.sequencerOpen).toBe(false);
    expect(typeof result.current.setSequencerOpen).toBe("function");
    expect(result.current.sequencerGridRef).toBeDefined();
  });

  it("manages voice selection", () => {
    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    expect(result.current.selectedVoice).toBe(1);
    expect(result.current.selectedSampleIdx).toBe(0);
    expect(typeof result.current.setSelectedVoice).toBe("function");
    expect(typeof result.current.setSelectedSampleIdx).toBe("function");
  });

  it("triggers error reporting useEffect when playback errors occur", () => {
    vi.mocked(useKitPlayback).mockReturnValue({
      handlePlay: vi.fn(),
      handleStop: vi.fn(),
      handleWaveformPlayingChange: vi.fn(),
      playbackError: "Playback failed",
      playbackState: "stopped",
      playTriggers: {},
      samplePlaying: null,
      stopTriggers: {},
    });

    renderHook(() => useKitDetailsLogic(mockProps));

    expect(mockProps.onMessage).toHaveBeenCalledWith(
      "Playback failed",
      "error",
    );
  });

  it("triggers error reporting useEffect when kit errors occur", () => {
    vi.mocked(useKit).mockReturnValue({
      error: "Kit loading failed",
      kit: null,
      loading: false,
      reloadKit: vi.fn(),
      toggleEditableMode: vi.fn(),
      updateKitAlias: vi.fn(),
    });

    renderHook(() => useKitDetailsLogic(mockProps));

    expect(mockProps.onMessage).toHaveBeenCalledWith(
      "Kit loading failed",
      "error",
    );
  });

  it("sets up and removes SampleWaveformError event listener", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useKitDetailsLogic(mockProps));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "SampleWaveformError",
      expect.any(Function),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "SampleWaveformError",
      expect.any(Function),
    );
  });

  it("handles SampleWaveformError events", () => {
    renderHook(() => useKitDetailsLogic(mockProps));

    // Simulate a SampleWaveformError event
    const errorEvent = new CustomEvent("SampleWaveformError", {
      detail: "Waveform rendering failed",
    });
    window.dispatchEvent(errorEvent);

    expect(mockProps.onMessage).toHaveBeenCalledWith(
      "Waveform rendering failed",
      "error",
    );
  });

  it("manages sequencer focus when sequencer opens", async () => {
    const { result } = renderHook(() => useKitDetailsLogic(mockProps));

    // Mock the sequencer grid ref
    const mockGridElement = {
      focus: vi.fn(),
    } as any;

    // Set the ref before opening the sequencer
    act(() => {
      result.current.sequencerGridRef.current = mockGridElement;
    });

    // Open the sequencer
    act(() => {
      result.current.setSequencerOpen(true);
    });

    // Wait for setTimeout to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockGridElement.focus).toHaveBeenCalled();
  });

  it("handles global keyboard navigation for kit navigation", () => {
    renderHook(() => useKitDetailsLogic(mockProps));

    // Test previous kit navigation (comma key)
    const prevEvent = new KeyboardEvent("keydown", { key: "," });
    const preventDefaultSpy = vi.spyOn(prevEvent, "preventDefault");
    window.dispatchEvent(prevEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(mockProps.onPrevKit).toHaveBeenCalled();

    // Test next kit navigation (period key)
    const nextEvent = new KeyboardEvent("keydown", { key: "." });
    const nextPreventDefaultSpy = vi.spyOn(nextEvent, "preventDefault");
    window.dispatchEvent(nextEvent);

    expect(nextPreventDefaultSpy).toHaveBeenCalled();
    expect(mockProps.onNextKit).toHaveBeenCalled();
  });

  it("handles global keyboard navigation for kit scanning", async () => {
    renderHook(() => useKitDetailsLogic(mockProps));

    // Test kit scan (slash key)
    const scanEvent = new KeyboardEvent("keydown", { key: "/" });
    const preventDefaultSpy = vi.spyOn(scanEvent, "preventDefault");
    window.dispatchEvent(scanEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    // rescanKit should be called
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("TestKit");
  });

  it("handles global keyboard navigation for sequencer toggle", () => {
    const { rerender, result } = renderHook(() =>
      useKitDetailsLogic(mockProps),
    );
    expect(result.current.sequencerOpen).toBe(false);

    // Test sequencer toggle (s key)
    const toggleEvent = new KeyboardEvent("keydown", { key: "s" });
    const preventDefaultSpy = vi.spyOn(toggleEvent, "preventDefault");
    window.dispatchEvent(toggleEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();

    // Force re-render to get updated values
    rerender();
    expect(result.current.sequencerOpen).toBe(true);

    // Test toggle with capital S
    const toggleEventCap = new KeyboardEvent("keydown", { key: "S" });
    const preventDefaultSpyCap = vi.spyOn(toggleEventCap, "preventDefault");
    window.dispatchEvent(toggleEventCap);

    expect(preventDefaultSpyCap).toHaveBeenCalled();

    // Force re-render to get updated values
    rerender();
    expect(result.current.sequencerOpen).toBe(false);
  });

  it("handles sample navigation keyboard events when sequencer is closed", () => {
    const mockOnSampleKeyNav = vi.fn();
    vi.mocked(useKitVoicePanels).mockReturnValue({
      handleVoiceChange: vi.fn(),
      onSampleKeyNav: mockOnSampleKeyNav,
      selectedSlot: 0,
      selectedVoice: 1,
      setSelectedSlot: vi.fn(),
      setSelectedVoice: vi.fn(),
    });

    renderHook(() => useKitDetailsLogic(mockProps));

    // Test arrow down navigation
    const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
    const downPreventDefaultSpy = vi.spyOn(downEvent, "preventDefault");
    window.dispatchEvent(downEvent);

    expect(downPreventDefaultSpy).toHaveBeenCalled();
    expect(mockOnSampleKeyNav).toHaveBeenCalledWith("down");

    // Test arrow up navigation
    const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
    const upPreventDefaultSpy = vi.spyOn(upEvent, "preventDefault");
    window.dispatchEvent(upEvent);

    expect(upPreventDefaultSpy).toHaveBeenCalled();
    expect(mockOnSampleKeyNav).toHaveBeenCalledWith("up");
  });

  it("handles sample playback keyboard events when sequencer is closed", () => {
    const mockHandlePlay = vi.fn();
    vi.mocked(useKitPlayback).mockReturnValue({
      handlePlay: mockHandlePlay,
      handleStop: vi.fn(),
      handleWaveformPlayingChange: vi.fn(),
      playbackError: null,
      playbackState: "stopped",
      playTriggers: {},
      samplePlaying: null,
      stopTriggers: {},
    });

    const sampleProps = {
      ...mockProps,
      samples: {
        1: [
          {
            filePath: "/test.wav",
            id: "sample1",
            name: "test.wav",
            slot: 0,
            voice: 1,
          },
        ],
        2: [],
        3: [],
        4: [],
      },
    };

    renderHook(() => useKitDetailsLogic(sampleProps));

    // Test spacebar playback
    const spaceEvent = new KeyboardEvent("keydown", { key: " " });
    const spacePreventDefaultSpy = vi.spyOn(spaceEvent, "preventDefault");
    window.dispatchEvent(spaceEvent);

    expect(spacePreventDefaultSpy).toHaveBeenCalled();
    expect(mockHandlePlay).toHaveBeenCalledWith(1, sampleProps.samples[1][0]);

    // Test Enter key - should be ignored (removed to prevent conflicts with kit name editing)
    const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
    const enterPreventDefaultSpy = vi.spyOn(enterEvent, "preventDefault");
    window.dispatchEvent(enterEvent);

    expect(enterPreventDefaultSpy).not.toHaveBeenCalled();
    // The call count should remain the same as before the Enter key event (only from Space key)
    expect(mockHandlePlay).toHaveBeenCalledTimes(1); // Only called once from Space key
    expect(mockHandlePlay).toHaveBeenCalledWith(1, sampleProps.samples[1][0]); // From Space key only
  });

  it("ignores keyboard events when sequencer is open", () => {
    const mockOnSampleKeyNav = vi.fn();
    vi.mocked(useKitVoicePanels).mockReturnValue({
      handleVoiceChange: vi.fn(),
      onSampleKeyNav: mockOnSampleKeyNav,
      selectedSlot: 0,
      selectedVoice: 1,
      setSelectedSlot: vi.fn(),
      setSelectedVoice: vi.fn(),
    });

    const { rerender, result } = renderHook(() =>
      useKitDetailsLogic(mockProps),
    );

    // Open sequencer first
    result.current.setSequencerOpen(true);
    rerender();

    // Create a fresh event for this test
    const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });

    // Instead of spying on preventDefault, let's check if onSampleKeyNav was called
    // since that's the actual behavior we're testing
    window.dispatchEvent(downEvent);

    // When sequencer is open, sample navigation should be ignored
    expect(mockOnSampleKeyNav).not.toHaveBeenCalled();
  });

  it("ignores keyboard events when input fields are focused", () => {
    const mockOnSampleKeyNav = vi.fn();
    vi.mocked(useKitVoicePanels).mockReturnValue({
      handleVoiceChange: vi.fn(),
      onSampleKeyNav: mockOnSampleKeyNav,
      selectedSlot: 0,
      selectedVoice: 1,
      setSelectedSlot: vi.fn(),
      setSelectedVoice: vi.fn(),
    });

    renderHook(() => useKitDetailsLogic(mockProps));

    // Create and focus an input element
    const inputElement = document.createElement("input");
    inputElement.type = "text";
    document.body.appendChild(inputElement);
    inputElement.focus();

    // Test arrow navigation - should be ignored
    const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
    const preventDefaultSpy = vi.spyOn(downEvent, "preventDefault");
    window.dispatchEvent(downEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(mockOnSampleKeyNav).not.toHaveBeenCalled();

    document.body.removeChild(inputElement);
  });

  it("ignores keyboard events when textarea is focused", () => {
    const mockOnSampleKeyNav = vi.fn();
    vi.mocked(useKitVoicePanels).mockReturnValue({
      handleVoiceChange: vi.fn(),
      onSampleKeyNav: mockOnSampleKeyNav,
      selectedSlot: 0,
      selectedVoice: 1,
      setSelectedSlot: vi.fn(),
      setSelectedVoice: vi.fn(),
    });

    renderHook(() => useKitDetailsLogic(mockProps));

    // Create and focus a textarea element
    const textareaElement = document.createElement("textarea");
    document.body.appendChild(textareaElement);
    textareaElement.focus();

    // Test arrow navigation - should be ignored
    const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
    const preventDefaultSpy = vi.spyOn(downEvent, "preventDefault");
    window.dispatchEvent(downEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(mockOnSampleKeyNav).not.toHaveBeenCalled();

    document.body.removeChild(textareaElement);
  });

  it("allows keyboard events when checkbox input is focused", () => {
    const mockOnSampleKeyNav = vi.fn();
    vi.mocked(useKitVoicePanels).mockReturnValue({
      handleVoiceChange: vi.fn(),
      onSampleKeyNav: mockOnSampleKeyNav,
      selectedSlot: 0,
      selectedVoice: 1,
      setSelectedSlot: vi.fn(),
      setSelectedVoice: vi.fn(),
    });

    renderHook(() => useKitDetailsLogic(mockProps));

    // Create and focus a checkbox input element
    const checkboxElement = document.createElement("input");
    checkboxElement.type = "checkbox";
    document.body.appendChild(checkboxElement);
    checkboxElement.focus();

    // Test arrow navigation - should work since checkbox inputs are allowed
    const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
    const preventDefaultSpy = vi.spyOn(downEvent, "preventDefault");
    window.dispatchEvent(downEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(mockOnSampleKeyNav).toHaveBeenCalledWith("down");

    document.body.removeChild(checkboxElement);
  });

  it("cleans up keyboard event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useKitDetailsLogic(mockProps));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
  });
});
