import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  SCHEDULE_AHEAD_MS,
  useKitStepSequencerLogic,
} from "../useKitStepSequencerLogic";

type Params = Parameters<typeof useKitStepSequencerLogic>[0];

// Mock the worker
const mockWorker = {
  onmessage: null as ((e: MessageEvent) => void) | null,
  postMessage: vi.fn(),
  terminate: vi.fn(),
};

global.Worker = vi.fn().mockImplementation(function () {
  return mockWorker;
});
global.URL.createObjectURL = vi.fn().mockReturnValue("mock-worker-url");

describe("useKitStepSequencerLogic", () => {
  const defaultSamples = {
    1: ["kick.wav", "kick2.wav"],
    2: ["snare.wav"],
    3: ["hat.wav"],
    4: ["tom.wav"],
  };

  const defaultStepPattern = [
    [127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0],
    [0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0],
    [0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0],
    [0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127],
  ];

  let mockOnPlaySample: Mock<Params["onPlaySample"]>;
  let mockSetStepPattern: Mock<Params["setStepPattern"]>;
  let mockSetSequencerOpen: Mock<Params["setSequencerOpen"]>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnPlaySample = vi.fn();
    mockSetStepPattern = vi.fn();
    mockSetSequencerOpen = vi.fn();

    // Reset console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // Sequencer triggers carry a scheduled start time
  const scheduled = { startAt: expect.any(Number) };

  const getDefaultParams = (): Params => ({
    bpm: 120,
    onPlaySample: mockOnPlaySample,
    samples: defaultSamples,
    sequencerOpen: false,
    setSequencerOpen: mockSetSequencerOpen,
    setStepPattern: mockSetStepPattern,
    stepPattern: defaultStepPattern,
  });

  describe("Firing voices", () => {
    it("marks the rows that fire on the current step", () => {
      const conditions = Array.from({ length: 4 }, () =>
        new Array(16).fill(null),
      );
      conditions[0][0] = "2:2"; // voice 1 step 1 waits for loop 2
      const pattern = defaultStepPattern.map((row) => [...row]);
      pattern[1][0] = 127; // voice 2 on at step 1
      pattern[2][0] = 127; // voice 3 on at step 1, but muted

      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          stepPattern: pattern,
          triggerConditions: conditions,
          voiceMutes: { 3: true },
        }),
      );
      expect(result.current.firingVoices).toEqual([false, false, false, false]);

      act(() => result.current.setIsSeqPlaying(true));

      expect(result.current.firingVoices).toEqual([false, true, false, false]);
    });
  });

  describe("Initialization", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      expect(result.current.isSeqPlaying).toBe(false);
      expect(result.current.currentSeqStep).toBe(0);
      expect(result.current.focusedStep).toEqual({ step: 0, voice: 0 });
      expect(result.current.safeStepPattern).toEqual(defaultStepPattern);
    });

    it("should initialize worker correctly", () => {
      renderHook(() => useKitStepSequencerLogic(getDefaultParams()));

      // The worker should be created with our mocked URL string
      expect(global.Worker).toHaveBeenCalledWith("mock-worker-url");
    });

    it("should handle null stepPattern by providing safe default", () => {
      const params = {
        ...getDefaultParams(),
        stepPattern: null,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      expect(result.current.safeStepPattern).toEqual([
        Array(16).fill(0),
        Array(16).fill(0),
        Array(16).fill(0),
        Array(16).fill(0),
      ]);
    });
  });

  describe("Worker Management", () => {
    it("should setup worker message handler", () => {
      renderHook(() => useKitStepSequencerLogic(getDefaultParams()));

      expect(mockWorker.onmessage).toBeDefined();
    });

    it("should handle step messages from worker", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      // Simulate worker sending step message
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 5 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(result.current.currentSeqStep).toBe(5);
    });

    it("should ignore non-STEP messages from worker", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 10 }, type: "OTHER" },
        } as MessageEvent);
      });

      expect(result.current.currentSeqStep).toBe(0); // Should remain unchanged
    });

    it("should terminate worker on cleanup", () => {
      const { unmount } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      unmount();

      expect(mockWorker.terminate).toHaveBeenCalled();
    });
  });

  describe("Playback Control", () => {
    it("should start worker when playback begins", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        payload: { numSteps: 16, stepDuration: 125 },
        type: "START",
      });
    });

    it("should stop worker when playback stops", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      // Start playback first
      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      vi.clearAllMocks();

      // Stop playback
      act(() => {
        result.current.setIsSeqPlaying(false);
      });

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: "STOP" });
    });
  });

  describe("Sample Triggering", () => {
    it("should trigger samples when step advances during playback", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      // Start playback
      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Advance to step 0 (should trigger voice 1)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });

    it("should not trigger samples when not playing", () => {
      renderHook(() => useKitStepSequencerLogic(getDefaultParams()));

      // Don't start playback

      // Try to advance step
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).not.toHaveBeenCalled();
    });

    it("should not trigger same step twice", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Trigger step 0 twice
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledTimes(1);
    });

    it("should handle voice with no samples gracefully", () => {
      const samplesWithMissingVoice = {
        1: ["kick.wav"],
        // Voice 2 has no samples
        3: ["hat.wav"],
        4: ["tom.wav"],
      };

      const params = {
        ...getDefaultParams(),
        samples: samplesWithMissingVoice,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Advance to step 1 (should try to trigger voice 2 but has no samples)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 1 }, type: "STEP" },
        } as MessageEvent);
      });

      // Voice 2 is active at step 1 but has no samples — it must not trigger playback
      expect(mockOnPlaySample).not.toHaveBeenCalledWith(
        2,
        expect.anything(),
        expect.anything(),
      );
    });

    it("should trigger multiple voices on same step", () => {
      const multipleVoicePattern = [
        [127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Voice 1 on step 0
        [127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Voice 2 on step 0
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const params = {
        ...getDefaultParams(),
        stepPattern: multipleVoicePattern,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
      expect(mockOnPlaySample).toHaveBeenCalledWith(
        2,
        0, // snare.wav
        100,
        scheduled,
      );
      expect(mockOnPlaySample).toHaveBeenCalledTimes(2);
    });
  });

  describe("[UC-32] Sample Selection Modes", () => {
    it("should use first sample in 'first' mode (default)", () => {
      const params = {
        ...getDefaultParams(),
        sampleModes: { 1: "first" as const },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });

    it("should use random sample in 'random' mode", () => {
      // Mock Math.random to return predictable value
      const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);

      const params = {
        ...getDefaultParams(),
        sampleModes: { 1: "random" as const },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      // With Math.random() returning 0.9, floor(0.9 * 2) = 1, so second sample
      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        1, // kick2.wav
        100,
        scheduled,
      );

      mathRandomSpy.mockRestore();
    });

    it("should cycle through samples in 'round-robin' mode", () => {
      const params = {
        ...getDefaultParams(),
        sampleModes: { 1: "round-robin" as const },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // First trigger — should play kick.wav (index 0)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );

      // Second trigger — should play kick2.wav (index 1)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 4 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        1, // kick2.wav
        100,
        scheduled,
      );

      // Third trigger — should wrap back to kick.wav (index 0)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 8 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenNthCalledWith(
        3,
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });

    it("[UC-29] round-robins by slot when two samples share a file name (RE-45)", () => {
      const params = {
        ...getDefaultParams(),
        sampleModes: { 1: "round-robin" as const },
        samples: { ...defaultSamples, 1: ["dup.wav", "dup.wav"] },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));
      act(() => {
        result.current.setIsSeqPlaying(true);
      });
      for (const step of [0, 4]) {
        act(() => {
          mockWorker.onmessage?.({
            data: { payload: { currentStep: step }, type: "STEP" },
          } as MessageEvent);
        });
      }

      const voice1Slots = mockOnPlaySample.mock.calls
        .filter(([voice]) => voice === 1)
        .map(([, slot]) => slot);
      expect(voice1Slots).toEqual([0, 1]);
    });

    it("skips an empty slot it lands on", () => {
      const params = {
        ...getDefaultParams(),
        samples: { ...defaultSamples, 1: ["", "kick.wav"] },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));
      act(() => {
        result.current.setIsSeqPlaying(true);
      });
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).not.toHaveBeenCalledWith(
        1,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it("should pass custom voiceVolumes to onPlaySample", () => {
      const params = {
        ...getDefaultParams(),
        voiceVolumes: { 1: 75, 2: 50 },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      // Voice 1 should be called with volume 75
      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        75,
        scheduled,
      );
    });

    it("should use default volume 100 when voiceVolumes not specified for a voice", () => {
      const params = {
        ...getDefaultParams(),
        voiceVolumes: { 1: 60 }, // Only voice 1 has a custom volume
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Voice 2 is on step 1
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 1 }, type: "STEP" },
        } as MessageEvent);
      });

      // Voice 2 should use default volume 100
      expect(mockOnPlaySample).toHaveBeenCalledWith(
        2,
        0, // snare.wav
        100,
        scheduled,
      );
    });

    it("should default to first mode when no sampleModes provided", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      // Should default to first sample
      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });
  });

  describe("[UC-30] Step Pattern Management", () => {
    it("should toggle step from 0 to 127", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      act(() => {
        result.current.toggleStep(0, 1); // Toggle voice 0, step 1 (currently 0)
      });

      expect(mockSetStepPattern).toHaveBeenCalledWith(
        expect.arrayContaining([
          [127, 127, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0], // Step 1 changed to 127
          defaultStepPattern[1],
          defaultStepPattern[2],
          defaultStepPattern[3],
        ]),
        {
          description: "Turn step 2 on voice 1 on",
          mergeKey: "step:0:1",
        },
      );
    });

    it("should toggle step from 127 to 0", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      act(() => {
        result.current.toggleStep(0, 0); // Toggle voice 0, step 0 (currently 127)
      });

      expect(mockSetStepPattern).toHaveBeenCalledWith(
        expect.arrayContaining([
          [0, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0], // Step 0 changed to 0
          defaultStepPattern[1],
          defaultStepPattern[2],
          defaultStepPattern[3],
        ]),
        expect.objectContaining({ description: "Turn step 1 on voice 1 off" }),
      );
    });

    it("should not toggle step when stepPattern is null", () => {
      const params = {
        ...getDefaultParams(),
        stepPattern: null,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.toggleStep(0, 0);
      });

      expect(mockSetStepPattern).not.toHaveBeenCalled();
    });
  });

  describe("Focus Navigation", () => {
    it("should move focus up", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      // Set initial focus to voice 2
      act(() => {
        result.current.setFocusedStep({ step: 0, voice: 2 });
      });

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowUp",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 1 });
    });

    it("should move focus down", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 1 });
    });

    it("should move focus left", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      // Set initial focus to step 5
      act(() => {
        result.current.setFocusedStep({ step: 5, voice: 0 });
      });

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowLeft",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 4, voice: 0 });
    });

    it("should move focus right", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 1, voice: 0 });
    });

    it("should not move focus beyond boundaries", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      // Test top boundary
      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowUp",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 0 });

      // Test left boundary
      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowLeft",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 0 });

      // Test bottom boundary
      act(() => {
        result.current.setFocusedStep({ step: 0, voice: 3 });
      });

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 3 });

      // Test right boundary
      act(() => {
        result.current.setFocusedStep({ step: 15, voice: 0 });
      });

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 15, voice: 0 });
    });
  });

  describe("Keyboard Interaction", () => {
    it("plays and stops on Space instead of toggling the step", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      const mockPreventDefault = vi.fn();
      const mockStopPropagation = vi.fn();
      const space = {
        key: " ",
        preventDefault: mockPreventDefault,
        stopPropagation: mockStopPropagation,
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      act(() => {
        result.current.handleStepGridKeyDown(space);
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      // Stopped so the sequencer-wide Space listener doesn't toggle again
      expect(mockStopPropagation).toHaveBeenCalled();
      expect(result.current.isSeqPlaying).toBe(true);
      expect(mockSetStepPattern).not.toHaveBeenCalled();

      act(() => {
        result.current.handleStepGridKeyDown(space);
      });
      expect(result.current.isSeqPlaying).toBe(false);
    });

    it("plays and stops on Space anywhere outside controls while open", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          sequencerOpen: true,
        }),
      );

      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: " " }),
        );
      });
      expect(result.current.isSeqPlaying).toBe(true);

      // A focused button keeps Space for itself
      const button = document.createElement("button");
      document.body.appendChild(button);
      act(() => {
        button.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: " " }),
        );
      });
      expect(result.current.isSeqPlaying).toBe(true);
      button.remove();
    });

    it("ignores keys from popovers portalled out of the grid", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          sequencerOpen: true,
        }),
      );
      const grid = document.createElement("div");
      const popoverButton = document.createElement("button");
      const preventDefault = vi.fn();

      act(() => {
        result.current.handleStepGridKeyDown({
          currentTarget: grid,
          key: "Enter",
          preventDefault,
          target: popoverButton,
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockSetStepPattern).not.toHaveBeenCalled();
    });

    it("leaves keys on the row controls to the controls", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          sequencerOpen: true,
        }),
      );
      const grid = document.createElement("div");
      const muteButton = document.createElement("button");
      const pad = document.createElement("button");
      pad.setAttribute("role", "gridcell");
      grid.append(muteButton, pad);
      const preventDefault = vi.fn();

      // Space on a mute button mutes; it doesn't start playback
      act(() => {
        result.current.handleStepGridKeyDown({
          currentTarget: grid,
          key: " ",
          preventDefault,
          stopPropagation: vi.fn(),
          target: muteButton,
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(result.current.isSeqPlaying).toBe(false);

      // The same key on a pad is the transport
      act(() => {
        result.current.handleStepGridKeyDown({
          currentTarget: grid,
          key: " ",
          preventDefault,
          stopPropagation: vi.fn(),
          target: pad,
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });
      expect(result.current.isSeqPlaying).toBe(true);
    });

    it("ignores Space while the sequencer is closed", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          sequencerOpen: false,
        }),
      );

      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: " " }),
        );
      });
      expect(result.current.isSeqPlaying).toBe(false);
    });

    it("should toggle step on Enter key", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      const mockPreventDefault = vi.fn();

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "Enter",
          preventDefault: mockPreventDefault,
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      expect(mockSetStepPattern).toHaveBeenCalled();
    });

    it("should not handle keys when sequencer is closed", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: false,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      const mockPreventDefault = vi.fn();

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowUp",
          preventDefault: mockPreventDefault,
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(mockPreventDefault).not.toHaveBeenCalled();
      expect(result.current.focusedStep).toEqual({ step: 0, voice: 0 }); // Unchanged
    });

    it("should ignore unhandled keys", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      const mockPreventDefault = vi.fn();

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "a",
          preventDefault: mockPreventDefault,
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(mockPreventDefault).not.toHaveBeenCalled();
    });
  });

  describe("Grid Focus Management", () => {
    it("should focus grid when sequencer opens", async () => {
      const grid = document.createElement("div");
      vi.spyOn(grid, "focus");
      const mockGridRef = { current: grid };

      const params = {
        ...getDefaultParams(),
        gridRef: mockGridRef,
        sequencerOpen: true,
      };

      renderHook(() => useKitStepSequencerLogic(params));

      // Wait for requestAnimationFrame to complete
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      expect(mockGridRef.current.focus).toHaveBeenCalled();
    });

    it("should use internal grid ref when none provided", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      expect(result.current.gridRefInternal).toBeDefined();
      expect(result.current.gridRefInternal.current).toBe(null);
    });

    it("should not focus when sequencer is closed", async () => {
      const grid = document.createElement("div");
      vi.spyOn(grid, "focus");
      const mockGridRef = { current: grid };

      const params = {
        ...getDefaultParams(),
        gridRef: mockGridRef,
        sequencerOpen: false,
      };

      renderHook(() => useKitStepSequencerLogic(params));

      // Wait a bit to ensure no focus happens
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockGridRef.current.focus).not.toHaveBeenCalled();
    });
  });

  describe("Constants and UI Styling", () => {
    it("should return correct UI constants", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      expect(result.current.NUM_VOICES).toBe(4);
      expect(result.current.NUM_STEPS).toBe(16);
      expect(result.current.ROW_COLORS).toHaveLength(4);
      expect(result.current.LED_GLOWS).toHaveLength(4);
    });

    it("should return proper row colors", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      expect(result.current.ROW_COLORS[0]).toContain("bg-voice-1");
      expect(result.current.ROW_COLORS[1]).toContain("bg-voice-2");
      expect(result.current.ROW_COLORS[2]).toContain("bg-voice-3");
      expect(result.current.ROW_COLORS[3]).toContain("bg-voice-4");
    });

    it("should return proper LED glow effects", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      result.current.LED_GLOWS.forEach((glow, i) => {
        expect(glow).toContain(`var(--voice-${i + 1})`);
      });
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle rapid step changes efficiently", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Simulate rapid step changes
      for (let i = 0; i < 16; i++) {
        act(() => {
          mockWorker.onmessage?.({
            data: { payload: { currentStep: i }, type: "STEP" },
          } as MessageEvent);
        });
      }

      expect(result.current.currentSeqStep).toBe(15);
    });

    it("should handle empty samples object", () => {
      const params = {
        ...getDefaultParams(),
        samples: {},
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      // Should not crash, no samples should be triggered
      expect(mockOnPlaySample).not.toHaveBeenCalled();
    });

    it("should handle step pattern with different velocity values", () => {
      const customPattern = [
        [64, 32, 127, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const params = {
        ...getDefaultParams(),
        stepPattern: customPattern,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Test step 0 (velocity 64)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );

      // Test step 3 (velocity 1)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 3 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });
  });

  describe("[UC-32] Voice Muting", () => {
    it("should skip muted voices during playback", () => {
      const params = {
        ...getDefaultParams(),
        voiceMutes: { 1: true, 2: false, 3: false, 4: false },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Step 0 has voice 1 active — but voice 1 is muted
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).not.toHaveBeenCalled();
    });

    it("should play unmuted voices normally", () => {
      const params = {
        ...getDefaultParams(),
        voiceMutes: { 1: true, 2: false, 3: false, 4: false },
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Step 1 has voice 2 active — voice 2 is not muted
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 1 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        2,
        0, // snare.wav
        100,
        scheduled,
      );
    });

    it("should not skip voices when voiceMutes is empty", () => {
      const params = {
        ...getDefaultParams(),
        voiceMutes: {},
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });
  });

  describe("Trigger Conditions", () => {
    it("should return cycleCount in hook output with initial value 0", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      expect(result.current.cycleCount).toBe(0);
    });

    it("should include cycleCount in the return interface", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      expect("cycleCount" in result.current).toBe(true);
      expect(typeof result.current.cycleCount).toBe("number");
    });
  });

  describe("Stereo Linking", () => {
    const stereoLinksV1V2 = {
      linkedSecondaries: new Set([2]),
      primaryLabels: { 1: "1+2" },
    };

    it("should not trigger samples on linked secondary voice", () => {
      // Use a pattern where only voice 2 is active at step 5 (no other voices)
      const onlyVoice2Pattern = [
        Array(16).fill(0),
        [0, 0, 0, 0, 0, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Voice 2 on step 5
        Array(16).fill(0),
        Array(16).fill(0),
      ];

      const params = {
        ...getDefaultParams(),
        stepPattern: onlyVoice2Pattern,
        stereoLinks: stereoLinksV1V2,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Advance to step 5 where only voice 2 is active — but voice 2 is linked secondary
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 5 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).not.toHaveBeenCalled();
    });

    it("should trigger samples normally on primary stereo voice", () => {
      const params = {
        ...getDefaultParams(),
        stereoLinks: stereoLinksV1V2,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      act(() => {
        result.current.setIsSeqPlaying(true);
      });

      // Step 0 has voice 1 active — voice 1 is the primary, should trigger
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 0 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });

    it("should skip linked secondary voice in keyboard navigation down", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true,
        stereoLinks: stereoLinksV1V2,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      // Start at voice 0 (voice 1), navigate down — should skip voice 1 (voice 2) to voice 2 (voice 3)
      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 2 });
    });

    it("should skip linked secondary voice in keyboard navigation up", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true,
        stereoLinks: stereoLinksV1V2,
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      // Start at voice 2 (voice 3), navigate up — should skip voice 1 (voice 2) to voice 0 (voice 1)
      act(() => {
        result.current.setFocusedStep({ step: 0, voice: 2 });
      });

      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowUp",
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 0 });
    });
  });

  describe("[UC-33] Slice mode", () => {
    const sliceOn = {
      1: { enabled: true, maxLength: 2, rollAmount: 100, varyLength: false },
    };

    function playStep(
      result: { current: ReturnType<typeof useKitStepSequencerLogic> },
      step: number,
    ) {
      act(() => {
        result.current.setIsSeqPlaying(true);
      });
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: step }, type: "STEP" },
        } as MessageEvent);
      });
    }

    it("plays the step's stored slice as a region of the sample", () => {
      const sliceSteps = Array.from({ length: 4 }, () =>
        new Array(16).fill(null),
      );
      // slice 5 of 16 (start tick 96), 2 slices long (48 ticks)
      sliceSteps[0][4] = {
        length: 48,
        locked: false,
        random: false,
        start: 96,
      };
      const onSliceTriggered = vi.fn();
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          onSliceTriggered,
          slicerDivision: 16,
          sliceSettings: sliceOn,
          sliceSteps,
        }),
      );

      playStep(result, 4);

      expect(mockOnPlaySample).toHaveBeenCalledWith(1, 0, 100, {
        region: { length: 2 / 16, start: 4 / 16 },
        startAt: expect.any(Number),
      });
      expect(onSliceTriggered).toHaveBeenCalledWith(1, {
        lengthSlices: 2,
        startSlice: 4,
      });
    });

    it("uses the sequential default when a step has no slice data", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          slicerDivision: 8,
          sliceSettings: sliceOn,
        }),
      );

      playStep(result, 8);

      // step 9 of 16 wraps to slice 1 of 8
      expect(mockOnPlaySample).toHaveBeenCalledWith(1, 0, 100, {
        region: { length: 1 / 8, start: 0 },
        startAt: expect.any(Number),
      });
    });

    it("plays whole samples for voices not in slice mode", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          sliceSettings: {
            1: { ...sliceOn[1], enabled: false },
          },
        }),
      );

      playStep(result, 0);

      expect(mockOnPlaySample).toHaveBeenCalledWith(
        1,
        0, // kick.wav
        100,
        scheduled,
      );
    });
  });

  describe("Extra grid keys", () => {
    it("lets the caller handle a key before the default handling", () => {
      const onGridKeyDown = vi.fn(() => true);
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({
          ...getDefaultParams(),
          onGridKeyDown,
          sequencerOpen: true,
        }),
      );
      const preventDefault = vi.fn();

      act(() => {
        result.current.handleStepGridKeyDown({
          key: " ",
          preventDefault,
        } as unknown as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(onGridKeyDown).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
      // Handled by the caller, so the step is not toggled
      expect(mockSetStepPattern).not.toHaveBeenCalled();
    });
  });

  describe("[UC-30] Scheduled timing", () => {
    it("schedules each step ahead of its ideal time from the worker", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );
      act(() => {
        result.current.setIsSeqPlaying(true);
      });
      mockOnPlaySample.mockClear();

      const ideal = performance.now() + 500;
      act(() => {
        mockWorker.onmessage?.({
          data: {
            payload: {
              at: performance.timeOrigin + ideal,
              currentStep: 1,
            },
            type: "STEP",
          },
        } as MessageEvent);
      });

      const options = mockOnPlaySample.mock.calls[0][3];
      expect(options?.startAt).toBeCloseTo(ideal + SCHEDULE_AHEAD_MS, 3);
    });

    it("uses an exact, unrounded step length", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic({ ...getDefaultParams(), bpm: 133 }),
      );
      act(() => {
        result.current.setIsSeqPlaying(true);
      });
      const start = mockWorker.postMessage.mock.calls.find(
        ([msg]) => msg.type === "START",
      )![0];
      expect(start.payload.stepDuration).toBeCloseTo(60000 / (133 * 4), 6);
    });
  });
});
