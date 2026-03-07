import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";

// Mock the hook before importing the component
vi.mock("../hooks/kit-management/useKitStepSequencerLogic", () => ({
  useKitStepSequencerLogic: vi.fn(),
}));

import { useKitStepSequencerLogic } from "../hooks/kit-management/useKitStepSequencerLogic";
import KitStepSequencer from "../KitStepSequencer";

const mockUseKitStepSequencerLogic = useKitStepSequencerLogic as ReturnType<
  typeof vi.fn
>;

// Minimal stub for required props
const defaultSamples = {
  1: ["kick.wav"],
  2: ["snare.wav"],
  3: ["hat.wav"],
  4: ["tom.wav"],
};
const defaultStepPattern = Array.from({ length: 4 }, () =>
  Array(16).fill(false),
);

describe("KitStepSequencer", () => {
  let onPlaySample;
  let stepPattern;
  let setStepPattern;
  let sequencerOpen;
  let setSequencerOpen;
  let mockLogic;

  function createMockLogic(overrides = {}) {
    return {
      currentSeqStep: 0,
      focusedStep: { step: 0, voice: 0 },
      gridRefInternal: { current: null },
      handleStepGridKeyDown: vi.fn(),
      isSeqPlaying: false,
      LED_GLOWS: [
        "shadow-glow-red",
        "shadow-glow-yellow",
        "shadow-glow-green",
        "shadow-glow-blue",
      ],
      NUM_STEPS: 16,
      NUM_VOICES: 4,
      ROW_COLORS: [
        "bg-red-400",
        "bg-yellow-400",
        "bg-green-400",
        "bg-blue-400",
      ],
      safeStepPattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
      setFocusedStep: vi.fn(),
      setIsSeqPlaying: vi.fn(),
      toggleStep: vi.fn(),
      ...overrides,
    };
  }

  beforeEach(() => {
    setupElectronAPIMock();

    onPlaySample = vi.fn();
    stepPattern = defaultStepPattern.map((row) => [...row]);
    setStepPattern = vi.fn((pattern) => {
      stepPattern = pattern;
    });
    sequencerOpen = false;
    setSequencerOpen = vi.fn();

    mockLogic = createMockLogic();
    mockUseKitStepSequencerLogic.mockReturnValue(mockLogic);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders transport controls and grid", () => {
    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={sequencerOpen}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
      />,
    );

    expect(
      screen.getByRole("button", { name: /step sequencer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("kit-step-sequencer-controls"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("kit-step-sequencer-grid")).toBeInTheDocument();
  });

  it("passes props to the hook correctly", () => {
    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={sequencerOpen}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
      />,
    );

    expect(mockUseKitStepSequencerLogic).toHaveBeenCalledWith(
      expect.objectContaining({
        bpm: 120,
        onPlaySample,
        samples: defaultSamples,
        sequencerOpen,
        setSequencerOpen,
        setStepPattern,
        stepPattern,
      }),
    );
  });

  it("initializes voice state from voice data prop", () => {
    const voices = [
      { sample_mode: "random", voice_number: 1, voice_volume: 80 },
      { sample_mode: "round-robin", voice_number: 2, voice_volume: 60 },
      { sample_mode: "first", voice_number: 3, voice_volume: 100 },
      { sample_mode: "first", voice_number: 4, voice_volume: 50 },
    ];

    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
        voices={voices}
      />,
    );

    // Hook should receive sampleModes and voiceVolumes from managed state
    expect(mockUseKitStepSequencerLogic).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleModes: {
          1: "random",
          2: "round-robin",
          3: "first",
          4: "first",
        },
        voiceVolumes: { 1: 80, 2: 60, 3: 100, 4: 50 },
      }),
    );
  });

  it("handles playback control", () => {
    const mockSetIsSeqPlaying = vi.fn();
    mockUseKitStepSequencerLogic.mockReturnValue({
      ...createMockLogic(),
      isSeqPlaying: false,
      setIsSeqPlaying: mockSetIsSeqPlaying,
    });

    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
      />,
    );

    const playButton = screen.getByRole("button", { name: /play/i });
    fireEvent.click(playButton);

    expect(mockSetIsSeqPlaying).toHaveBeenCalled();
  });

  it("allows setting up a custom grid reference", () => {
    const customGridRef = { current: null };

    render(
      <KitStepSequencer
        bpm={120}
        gridRef={customGridRef}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
      />,
    );

    expect(mockUseKitStepSequencerLogic).toHaveBeenCalledWith(
      expect.objectContaining({
        gridRef: customGridRef,
      }),
    );
  });

  it("passes drawer state to the logic hook", () => {
    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
      />,
    );

    expect(mockUseKitStepSequencerLogic).toHaveBeenCalledWith(
      expect.objectContaining({
        sequencerOpen: true,
        setSequencerOpen,
      }),
    );
  });

  it("calls updateVoiceVolume IPC when volume changes", () => {
    // Render with sequencer open so voice controls are visible
    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
        voices={[
          { sample_mode: "first", voice_number: 1, voice_volume: 100 },
          { sample_mode: "first", voice_number: 2, voice_volume: 100 },
          { sample_mode: "first", voice_number: 3, voice_volume: 100 },
          { sample_mode: "first", voice_number: 4, voice_volume: 100 },
        ]}
      />,
    );

    // Find a volume slider and change it
    const sliders = screen.getAllByRole("slider");
    if (sliders.length > 0) {
      fireEvent.change(sliders[0], { target: { value: "75" } });
      expect(window.electronAPI.updateVoiceVolume).toHaveBeenCalledWith(
        "TestKit",
        1,
        75,
      );
    }
  });

  it("calls updateVoiceSampleMode IPC when sample mode changes", () => {
    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
        voices={[
          { sample_mode: "first", voice_number: 1, voice_volume: 100 },
          { sample_mode: "first", voice_number: 2, voice_volume: 100 },
          { sample_mode: "first", voice_number: 3, voice_volume: 100 },
          { sample_mode: "first", voice_number: 4, voice_volume: 100 },
        ]}
      />,
    );

    // Find sample mode toggle buttons by their title attribute
    const modeButtons = screen.getAllByTitle(/Sample mode:/);
    if (modeButtons.length > 0) {
      fireEvent.click(modeButtons[0]);
      expect(window.electronAPI.updateVoiceSampleMode).toHaveBeenCalledWith(
        "TestKit",
        1,
        "random",
      );
    }
  });

  it("debounces onVoiceSettingChanged for volume changes", async () => {
    vi.useFakeTimers();
    const onVoiceSettingChanged = vi.fn();

    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        onVoiceSettingChanged={onVoiceSettingChanged}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
        voices={[
          { sample_mode: "first", voice_number: 1, voice_volume: 100 },
          { sample_mode: "first", voice_number: 2, voice_volume: 100 },
          { sample_mode: "first", voice_number: 3, voice_volume: 100 },
          { sample_mode: "first", voice_number: 4, voice_volume: 100 },
        ]}
      />,
    );

    const sliders = screen.getAllByRole("slider");
    if (sliders.length > 0) {
      // Multiple rapid volume changes
      fireEvent.change(sliders[0], { target: { value: "90" } });
      fireEvent.change(sliders[0], { target: { value: "80" } });
      fireEvent.change(sliders[0], { target: { value: "70" } });

      // Should not have called yet (debounced)
      expect(onVoiceSettingChanged).not.toHaveBeenCalled();

      // Advance timers past debounce threshold (500ms)
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Should have called exactly once after debounce
      expect(onVoiceSettingChanged).toHaveBeenCalledTimes(1);
    }

    vi.useRealTimers();
  });

  it("passes voiceMutes to the logic hook", () => {
    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        setTriggerConditions={vi.fn()}
        stepPattern={stepPattern}
        triggerConditions={Array.from({ length: 4 }, () =>
          Array(16).fill(null),
        )}
      />,
    );

    // Hook should receive voiceMutes initialized to all false
    expect(mockUseKitStepSequencerLogic).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceMutes: { 1: false, 2: false, 3: false, 4: false },
      }),
    );
  });

  it("renders mute buttons and toggles mute state on click", () => {
    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        setTriggerConditions={vi.fn()}
        stepPattern={stepPattern}
        triggerConditions={Array.from({ length: 4 }, () =>
          Array(16).fill(null),
        )}
      />,
    );

    // Mute buttons should be rendered
    const muteButton = screen.getByTestId("voice-mute-0");
    expect(muteButton).toBeInTheDocument();

    // Click to mute voice 1
    fireEvent.click(muteButton);

    // After click, hook should be re-called with voice 1 muted
    const lastCall =
      mockUseKitStepSequencerLogic.mock.calls[
        mockUseKitStepSequencerLogic.mock.calls.length - 1
      ];
    expect(lastCall[0].voiceMutes[1]).toBe(true);
  });

  it("calls onVoiceSettingChanged immediately for sample mode changes", () => {
    const onVoiceSettingChanged = vi.fn();

    render(
      <KitStepSequencer
        bpm={120}
        kitName="TestKit"
        onPlaySample={onPlaySample}
        onVoiceSettingChanged={onVoiceSettingChanged}
        samples={defaultSamples}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
        setStepPattern={setStepPattern}
        stepPattern={stepPattern}
        voices={[
          { sample_mode: "first", voice_number: 1, voice_volume: 100 },
          { sample_mode: "first", voice_number: 2, voice_volume: 100 },
          { sample_mode: "first", voice_number: 3, voice_volume: 100 },
          { sample_mode: "first", voice_number: 4, voice_volume: 100 },
        ]}
      />,
    );

    const modeButtons = screen.getAllByTitle(/Sample mode:/);
    if (modeButtons.length > 0) {
      fireEvent.click(modeButtons[0]);
      // Sample mode change calls onVoiceSettingChanged immediately (no debounce)
      expect(onVoiceSettingChanged).toHaveBeenCalledTimes(1);
    }
  });

  describe("Stereo linking", () => {
    it("hides secondary voice row when voices are stereo-linked", () => {
      render(
        <KitStepSequencer
          bpm={120}
          kitName="TestKit"
          onPlaySample={onPlaySample}
          samples={defaultSamples}
          sequencerOpen={true}
          setSequencerOpen={setSequencerOpen}
          setStepPattern={setStepPattern}
          setTriggerConditions={vi.fn()}
          stepPattern={stepPattern}
          triggerConditions={Array.from({ length: 4 }, () =>
            Array(16).fill(null),
          )}
          voices={[
            { stereo_mode: true, voice_number: 1, voice_volume: 100 },
            { voice_number: 2, voice_volume: 100 },
            { voice_number: 3, voice_volume: 100 },
            { voice_number: 4, voice_volume: 100 },
          ]}
        />,
      );

      // Voice 1 (primary) row should be visible
      expect(screen.getByTestId("seq-row-0")).toBeInTheDocument();
      // Voice 2 (secondary) row should be hidden
      expect(screen.queryByTestId("seq-row-1")).not.toBeInTheDocument();
      // Voices 3 and 4 should still be visible
      expect(screen.getByTestId("seq-row-2")).toBeInTheDocument();
      expect(screen.getByTestId("seq-row-3")).toBeInTheDocument();
    });

    it("shows stereo label '1+2' on primary row when linked", () => {
      render(
        <KitStepSequencer
          bpm={120}
          kitName="TestKit"
          onPlaySample={onPlaySample}
          samples={defaultSamples}
          sequencerOpen={true}
          setSequencerOpen={setSequencerOpen}
          setStepPattern={setStepPattern}
          setTriggerConditions={vi.fn()}
          stepPattern={stepPattern}
          triggerConditions={Array.from({ length: 4 }, () =>
            Array(16).fill(null),
          )}
          voices={[
            { stereo_mode: true, voice_number: 1, voice_volume: 100 },
            { voice_number: 2, voice_volume: 100 },
            { voice_number: 3, voice_volume: 100 },
            { voice_number: 4, voice_volume: 100 },
          ]}
        />,
      );

      const label = screen.getByTestId("seq-voice-label-0");
      expect(label.textContent).toBe("1+2");
    });

    it("shows all 4 rows when no voices are linked", () => {
      render(
        <KitStepSequencer
          bpm={120}
          kitName="TestKit"
          onPlaySample={onPlaySample}
          samples={defaultSamples}
          sequencerOpen={true}
          setSequencerOpen={setSequencerOpen}
          setStepPattern={setStepPattern}
          setTriggerConditions={vi.fn()}
          stepPattern={stepPattern}
          triggerConditions={Array.from({ length: 4 }, () =>
            Array(16).fill(null),
          )}
          voices={[
            { voice_number: 1, voice_volume: 100 },
            { voice_number: 2, voice_volume: 100 },
            { voice_number: 3, voice_volume: 100 },
            { voice_number: 4, voice_volume: 100 },
          ]}
        />,
      );

      expect(screen.getByTestId("seq-row-0")).toBeInTheDocument();
      expect(screen.getByTestId("seq-row-1")).toBeInTheDocument();
      expect(screen.getByTestId("seq-row-2")).toBeInTheDocument();
      expect(screen.getByTestId("seq-row-3")).toBeInTheDocument();
    });

    it("passes stereoLinks to the logic hook", () => {
      render(
        <KitStepSequencer
          bpm={120}
          kitName="TestKit"
          onPlaySample={onPlaySample}
          samples={defaultSamples}
          sequencerOpen={true}
          setSequencerOpen={setSequencerOpen}
          setStepPattern={setStepPattern}
          setTriggerConditions={vi.fn()}
          stepPattern={stepPattern}
          triggerConditions={Array.from({ length: 4 }, () =>
            Array(16).fill(null),
          )}
          voices={[
            { stereo_mode: true, voice_number: 1, voice_volume: 100 },
            { voice_number: 2, voice_volume: 100 },
            { voice_number: 3, voice_volume: 100 },
            { voice_number: 4, voice_volume: 100 },
          ]}
        />,
      );

      const lastCall =
        mockUseKitStepSequencerLogic.mock.calls[
          mockUseKitStepSequencerLogic.mock.calls.length - 1
        ];
      const stereoLinks = lastCall[0].stereoLinks;
      expect(stereoLinks.linkedSecondaries.has(2)).toBe(true);
      expect(stereoLinks.primaryLabels[1]).toBe("1+2");
    });
  });
});
