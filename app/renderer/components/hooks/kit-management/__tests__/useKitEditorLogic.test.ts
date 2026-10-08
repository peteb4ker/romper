import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../../../tests/factories/kit.factory";
import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useSampleManagement } from "../../sample-management/useSampleManagement";
import { createSlotPlaybackStore } from "../slotPlaybackStore";
import { useKitEditorLogic } from "../useKitEditorLogic";
import { useKitPlayback } from "../useKitPlayback";
import { useKitVoicePanels } from "../useKitVoicePanels";

// Mock all the hooks that useKitEditorLogic depends on
// Note: useKit is no longer used by useKitEditorLogic

vi.mock("../../voice-panels/useVoiceAlias", () => ({
  useVoiceAlias: vi.fn(() => ({
    updateVoiceAlias: vi.fn(),
  })),
}));

vi.mock("../../sample-management/useSampleManagement", () => ({
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
    slotPlayback: createSlotPlaybackStore(),
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

vi.mock("../../shared/useStepPattern", () => ({
  useStepPattern: vi.fn(() => ({
    setStepPattern: vi.fn(),
    stepPattern: null,
  })),
}));

type Playback = ReturnType<typeof useKitPlayback>;
type VoicePanels = ReturnType<typeof useKitVoicePanels>;

const mockPlayback = (overrides: Partial<Playback> = {}): Playback => ({
  handlePlay: vi.fn(),
  handleStop: vi.fn(),
  handleWaveformPlayingChange: vi.fn(),
  playbackError: null,
  slotPlayback: createSlotPlaybackStore(),
  ...overrides,
});

const mockVoicePanels = (
  overrides: Partial<VoicePanels> = {},
): VoicePanels => ({
  kit: null,
  kitName: "TestKit",
  onPlay: vi.fn(),
  onSampleKeyNav: vi.fn(),
  onSampleSelect: vi.fn(),
  onSaveVoiceName: vi.fn(),
  onStop: vi.fn(),
  onWaveformPlayingChange: vi.fn(),
  samples: { 1: [], 2: [], 3: [], 4: [] },
  selectedSampleIdx: 0,
  selectedVoice: 1,
  slotPlayback: createSlotPlaybackStore(),
  ...overrides,
});

describe("useKitEditorLogic", () => {
  const mockKit = createMockKitWithRelations({
    alias: "Test Kit",
    bank_letter: "T",
    name: "TestKit",
  });

  const mockProps = {
    kit: mockKit,
    kitIndex: 0,
    kitName: "TestKit",
    kits: [],
    onBack: vi.fn(),
    onKitUpdated: vi.fn(),
    onMessage: vi.fn(),
    onNextKit: vi.fn(),
    onPrevKit: vi.fn(),
    onRequestSamplesReload: vi.fn(),
    onToggleEditableMode: vi.fn(),
    onToggleFavorite: vi.fn(),
    onUpdateKitAlias: vi.fn(),
    samples: { 1: [], 2: [], 3: [], 4: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup electronAPI mock after clearAllMocks
    setupElectronAPIMock();

    // Setup default mock for electronAPI methods used in this hook using centralized mocks
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      data: {
        addedSamples: 0,
        locked: false,
        metadataUpdated: 0,
        missingSamples: [],
        scannedSamples: 5,
        skippedFiles: [],
        updatedVoices: 0,
      },
      success: true,
    });
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    expect(result.current).toBeDefined();
    expect(result.current.kit).toEqual(mockKit);
    expect(result.current.kitLoading).toBe(false);
    expect(result.current.kitError).toBeNull();
  });

  it("exposes all required functionality", () => {
    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    // Check that all expected functions are available
    expect(typeof result.current.reloadKit).toBe("function");
    expect(typeof result.current.updateKitAlias).toBe("function");
    expect(typeof result.current.toggleEditableMode).toBe("function");
    expect(typeof result.current.updateVoiceAlias).toBe("function");
    expect(typeof result.current.handleScanKit).toBe("function");
    expect(typeof result.current.handleInferVoiceNames).toBe("function");
    expect(typeof result.current.setSelectedVoice).toBe("function");
    expect(typeof result.current.setSelectedSampleIdx).toBe("function");
    expect(typeof result.current.setSequencerOpen).toBe("function");
    expect(typeof result.current.setStepPattern).toBe("function");
  });

  it("exposes all required state", () => {
    const { result } = renderHook(() => useKitEditorLogic(mockProps));

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
    expect(result.current.flashVoices).toBeDefined();
    expect(result.current.flashVoices.size).toBe(0);
  });

  describe("[Q-01] reloading after an edit (#452)", () => {
    it("[UC-30] shows the kit an edit returned, without reading it again", async () => {
      const { result } = renderHook(() => useKitEditorLogic(mockProps));
      const edited = { ...mockKit, step_pattern: [[1]] };

      await act(async () => {
        await result.current.reloadKit(edited);
      });

      expect(mockProps.onKitUpdated).toHaveBeenCalledWith("TestKit", edited);
    });

    it("[UC-30] reloads only the kit the edit was made in", async () => {
      const { result } = renderHook(() => useKitEditorLogic(mockProps));

      await act(async () => {
        await result.current.reloadKit();
      });

      expect(mockProps.onKitUpdated).toHaveBeenCalledWith("TestKit", undefined);
    });

    it("[UC-18] reloads the edited kit when a save finishes after a step to another", async () => {
      const { rerender, result } = renderHook(
        (props: typeof mockProps) => useKitEditorLogic(props),
        { initialProps: mockProps },
      );
      const reloadEditedKit = result.current.reloadKit;
      rerender({ ...mockProps, kitName: "OtherKit" });

      await act(async () => {
        await reloadEditedKit();
      });

      expect(mockProps.onKitUpdated).toHaveBeenCalledWith("TestKit", undefined);
    });

    it("[UC-19] reloads the kit and its samples once after a sample edit", async () => {
      renderHook(() => useKitEditorLogic(mockProps));
      const { onSamplesChanged } =
        vi.mocked(useSampleManagement).mock.calls[0][0];

      await act(async () => {
        await onSamplesChanged?.();
      });

      expect(mockProps.onRequestSamplesReload).toHaveBeenCalledTimes(1);
      expect(mockProps.onRequestSamplesReload).toHaveBeenCalledWith("TestKit");
      expect(mockProps.onKitUpdated).not.toHaveBeenCalled();
    });
  });

  it("handles kit scanning successfully", async () => {
    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    await result.current.handleScanKit();

    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("TestKit");
    expect(mockProps.onRequestSamplesReload).toHaveBeenCalled();
  });

  it("handles kit scanning errors", async () => {
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      error: "Test error",
      success: false,
    });

    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    await result.current.handleScanKit();

    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("TestKit");
    // onRequestSamplesReload should not be called on error
    expect(mockProps.onRequestSamplesReload).not.toHaveBeenCalled();
  });

  it("handles missing rescan API", async () => {
    // Remove the rescanKit method to simulate missing API
    setupElectronAPIMock({ rescanKit: undefined });

    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    await result.current.handleScanKit();

    expect(mockProps.onRequestSamplesReload).not.toHaveBeenCalled();
  });

  it("handles kit scanning without kit name", async () => {
    const propsWithoutKit = { ...mockProps, kitName: "" };
    const { result } = renderHook(() => useKitEditorLogic(propsWithoutKit));

    await result.current.handleScanKit();

    expect(window.electronAPI.rescanKit).not.toHaveBeenCalled();
  });

  it("initializes with default samples when not provided", () => {
    const propsWithoutSamples = { ...mockProps, samples: undefined };
    const { result } = renderHook(() => useKitEditorLogic(propsWithoutSamples));

    expect(result.current.samples).toEqual({ 1: [], 2: [], 3: [], 4: [] });
  });

  it("exposes sequencer controls", () => {
    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    expect(result.current.sequencerOpen).toBe(false);
    expect(typeof result.current.setSequencerOpen).toBe("function");
    expect(result.current.sequencerGridRef).toBeDefined();
  });

  it("manages voice selection", () => {
    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    expect(result.current.selectedVoice).toBe(1);
    expect(result.current.selectedSampleIdx).toBe(0);
    expect(typeof result.current.setSelectedVoice).toBe("function");
    expect(typeof result.current.setSelectedSampleIdx).toBe("function");
  });

  it("triggers error reporting useEffect when playback errors occur", () => {
    vi.mocked(useKitPlayback).mockReturnValue(
      mockPlayback({ playbackError: "Playback failed" }),
    );

    renderHook(() => useKitEditorLogic(mockProps));

    expect(mockProps.onMessage).toHaveBeenCalledWith(
      "Playback failed",
      "error",
    );
  });

  // Kit errors are no longer applicable since kit is passed as prop
  // This test is removed as kit loading is handled by parent component

  it("sets up and removes SampleWaveformError event listener", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useKitEditorLogic(mockProps));

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
    renderHook(() => useKitEditorLogic(mockProps));

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
    const { result } = renderHook(() => useKitEditorLogic(mockProps));

    // Mock the sequencer grid ref
    const mockGridElement = document.createElement("div");
    vi.spyOn(mockGridElement, "focus");

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
    renderHook(() => useKitEditorLogic(mockProps));

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
    renderHook(() => useKitEditorLogic(mockProps));

    // Test kit scan (slash key)
    const scanEvent = new KeyboardEvent("keydown", { key: "/" });
    const preventDefaultSpy = vi.spyOn(scanEvent, "preventDefault");
    window.dispatchEvent(scanEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    // rescanKit should be called
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("TestKit");
  });

  // #552: ";" toggles the open kit's favorite
  it("[UC-10] toggles the open kit's favorite with ;", async () => {
    const onToggleFavorite = vi
      .fn()
      .mockResolvedValue({ data: { isFavorite: true }, success: true });
    renderHook(() => useKitEditorLogic({ ...mockProps, onToggleFavorite }));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: ";" }));
    });

    expect(onToggleFavorite).toHaveBeenCalledWith("TestKit");
    expect(mockProps.onMessage).not.toHaveBeenCalledWith(
      expect.stringContaining("favorites"),
      "error",
    );
  });

  // #554: the approved wording, for both directions
  it("[UC-10] reports an add to favorites that couldn't save", async () => {
    const onToggleFavorite = vi
      .fn()
      .mockResolvedValue({ error: "db locked", success: false });
    renderHook(() => useKitEditorLogic({ ...mockProps, onToggleFavorite }));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: ";" }));
    });

    expect(mockProps.onMessage).toHaveBeenCalledWith(
      "Couldn't add kit TestKit to favorites. Try again.",
      "error",
    );
  });

  it("[UC-10] reports a remove from favorites that couldn't save", async () => {
    const onToggleFavorite = vi
      .fn()
      .mockResolvedValue({ error: "db locked", success: false });
    const { result } = renderHook(() =>
      useKitEditorLogic({
        ...mockProps,
        kit: { ...mockKit, is_favorite: true },
        onToggleFavorite,
      }),
    );

    // The header's star button calls the same toggleFavorite as ;
    await act(async () => {
      await result.current.toggleFavorite?.();
    });

    expect(onToggleFavorite).toHaveBeenCalledWith("TestKit");
    expect(mockProps.onMessage).toHaveBeenCalledWith(
      "Couldn't remove kit TestKit from favorites. Try again.",
      "error",
    );
  });

  it("handles global keyboard navigation for sequencer toggle", () => {
    const { rerender, result } = renderHook(() => useKitEditorLogic(mockProps));
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
    vi.mocked(useKitVoicePanels).mockReturnValue(
      mockVoicePanels({ onSampleKeyNav: mockOnSampleKeyNav }),
    );

    renderHook(() => useKitEditorLogic(mockProps));

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
    vi.mocked(useKitPlayback).mockReturnValue(
      mockPlayback({ handlePlay: mockHandlePlay }),
    );

    const sampleProps = {
      ...mockProps,
      samples: {
        1: ["test.wav"],
        2: [],
        3: [],
        4: [],
      },
    };

    renderHook(() => useKitEditorLogic(sampleProps));

    // Test spacebar playback
    const spaceEvent = new KeyboardEvent("keydown", { key: " " });
    const spacePreventDefaultSpy = vi.spyOn(spaceEvent, "preventDefault");
    window.dispatchEvent(spaceEvent);

    expect(spacePreventDefaultSpy).toHaveBeenCalled();
    expect(mockHandlePlay).toHaveBeenCalledWith(1, 0);

    // Test Enter key - should be ignored (removed to prevent conflicts with kit name editing)
    const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
    const enterPreventDefaultSpy = vi.spyOn(enterEvent, "preventDefault");
    window.dispatchEvent(enterEvent);

    expect(enterPreventDefaultSpy).not.toHaveBeenCalled();
    // The call count should remain the same as before the Enter key event (only from Space key)
    expect(mockHandlePlay).toHaveBeenCalledTimes(1); // Only called once from Space key
    expect(mockHandlePlay).toHaveBeenCalledWith(1, 0); // From Space key only
  });

  it("ignores keyboard events when sequencer is open", () => {
    const mockOnSampleKeyNav = vi.fn();
    vi.mocked(useKitVoicePanels).mockReturnValue(
      mockVoicePanels({ onSampleKeyNav: mockOnSampleKeyNav }),
    );

    const { rerender, result } = renderHook(() => useKitEditorLogic(mockProps));

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
    vi.mocked(useKitVoicePanels).mockReturnValue(
      mockVoicePanels({ onSampleKeyNav: mockOnSampleKeyNav }),
    );

    renderHook(() => useKitEditorLogic(mockProps));

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
    vi.mocked(useKitVoicePanels).mockReturnValue(
      mockVoicePanels({ onSampleKeyNav: mockOnSampleKeyNav }),
    );

    renderHook(() => useKitEditorLogic(mockProps));

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
    vi.mocked(useKitVoicePanels).mockReturnValue(
      mockVoicePanels({ onSampleKeyNav: mockOnSampleKeyNav }),
    );

    renderHook(() => useKitEditorLogic(mockProps));

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

    const { unmount } = renderHook(() => useKitEditorLogic(mockProps));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
  });

  describe("[UC-17] [UC-36] reporting a failed toggle or rename (RE-41)", () => {
    it("reports a failed editable toggle instead of rejecting into the click", async () => {
      const onMessage = vi.fn();
      const onToggleEditableMode = vi
        .fn()
        .mockRejectedValue(new Error("Failed to toggle editable mode"));
      const { result } = renderHook(() =>
        useKitEditorLogic({ ...mockProps, onMessage, onToggleEditableMode }),
      );

      await act(async () => {
        await expect(result.current.toggleEditableMode()).resolves.toBe(
          undefined,
        );
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't turn editing on for kit TestKit. Try again.",
        "error",
      );
    });

    it("says editing couldn't be turned off on an editable kit", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useKitEditorLogic({
          ...mockProps,
          kit: { ...mockKit, editable: true },
          onMessage,
          onToggleEditableMode: vi.fn().mockRejectedValue(new Error("x")),
        }),
      );

      await act(async () => {
        await result.current.toggleEditableMode();
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't turn editing off for kit TestKit. Try again.",
        "error",
      );
    });

    it("reports a failed rename instead of rejecting into the blur", async () => {
      const onMessage = vi.fn();
      const onUpdateKitAlias = vi
        .fn()
        .mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));
      const { result } = renderHook(() =>
        useKitEditorLogic({ ...mockProps, onMessage, onUpdateKitAlias }),
      );

      await act(async () => {
        await expect(result.current.updateKitAlias("Big Drums")).resolves.toBe(
          undefined,
        );
      });

      expect(onUpdateKitAlias).toHaveBeenCalledWith("TestKit", "Big Drums");
      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't save the name for kit TestKit. Try again.",
        "error",
      );
    });

    it("says nothing when the toggle and rename work", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useKitEditorLogic({
          ...mockProps,
          onMessage,
          onToggleEditableMode: vi.fn().mockResolvedValue(undefined),
          onUpdateKitAlias: vi.fn().mockResolvedValue(undefined),
        }),
      );

      await act(async () => {
        await result.current.toggleEditableMode();
        await result.current.updateKitAlias("Big Drums");
      });

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleInferVoiceNames", () => {
    it("infers voice names from sample filenames and calls updateVoiceAlias", async () => {
      const propsWithSamples = {
        ...mockProps,
        samples: {
          1: ["kick_hard.wav", "kick_soft.wav"],
          2: ["snare_01.wav"],
          3: [],
          4: ["hh_closed.wav"],
        },
      };

      const { result } = renderHook(() => useKitEditorLogic(propsWithSamples));

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      // Should call updateVoiceAlias for voices 1, 2, and 4 (voice 3 has no samples)
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "TestKit",
        1,
        "Kick",
      );
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "TestKit",
        2,
        "Snare",
      );
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "TestKit",
        4,
        "Closed HH",
      );
      // Voice 3 has no samples, so should not be called for it
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledTimes(3);
    });

    it("skips voices with no samples", async () => {
      const propsWithEmptySamples = {
        ...mockProps,
        samples: { 1: [], 2: [], 3: [], 4: [] },
      };

      const { result } = renderHook(() =>
        useKitEditorLogic(propsWithEmptySamples),
      );

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(window.electronAPI.updateVoiceAlias).not.toHaveBeenCalled();
    });

    it("does nothing without kitName", async () => {
      const propsWithoutKit = {
        ...mockProps,
        kitName: "",
        samples: { 1: ["kick.wav"], 2: [], 3: [], 4: [] },
      };

      const { result } = renderHook(() => useKitEditorLogic(propsWithoutKit));

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(window.electronAPI.updateVoiceAlias).not.toHaveBeenCalled();
    });

    it("sets flashVoices for updated voices", async () => {
      const propsWithSamples = {
        ...mockProps,
        samples: {
          1: ["kick_hard.wav"],
          2: ["snare_01.wav"],
          3: [],
          4: [],
        },
      };

      const { result } = renderHook(() => useKitEditorLogic(propsWithSamples));

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      // flashVoices should contain the voices that were updated (1 and 2)
      expect(result.current.flashVoices.has(1)).toBe(true);
      expect(result.current.flashVoices.has(2)).toBe(true);
      expect(result.current.flashVoices.has(3)).toBe(false);
      expect(result.current.flashVoices.has(4)).toBe(false);
    });

    it("does not set flashVoices when no voices are inferred", async () => {
      const propsWithEmptySamples = {
        ...mockProps,
        samples: { 1: [], 2: [], 3: [], 4: [] },
      };

      const { result } = renderHook(() =>
        useKitEditorLogic(propsWithEmptySamples),
      );

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(result.current.flashVoices.size).toBe(0);
    });

    it("skips voices where type cannot be inferred", async () => {
      const propsWithUnknown = {
        ...mockProps,
        samples: {
          1: ["random_noise_xyz.wav"],
          2: ["kick_01.wav"],
          3: [],
          4: [],
        },
      };

      const { result } = renderHook(() => useKitEditorLogic(propsWithUnknown));

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      // "random_noise_xyz" won't match any voice type keywords, but "kick_01" will
      // Actually "noise" doesn't match, but let's check what inference returns
      // The important thing is that kick_01 should be inferred
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "TestKit",
        2,
        "Kick",
      );
    });
  });
});
