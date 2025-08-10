import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitStepSequencerLogic } from "../useKitStepSequencerLogic";

// Mock the worker
const mockWorker = {
  onmessage: null as ((e: MessageEvent) => void) | null,
  postMessage: vi.fn(),
  terminate: vi.fn(),
};

global.Worker = vi.fn().mockImplementation(() => mockWorker);
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

  let mockOnPlaySample: ReturnType<typeof vi.fn>;
  let mockSetStepPattern: ReturnType<typeof vi.fn>;
  let mockSetSequencerOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnPlaySample = vi.fn();
    mockSetStepPattern = vi.fn();
    mockSetSequencerOpen = vi.fn();

    // Reset console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  const getDefaultParams = () => ({
    onPlaySample: mockOnPlaySample,
    samples: defaultSamples,
    sequencerOpen: false,
    setSequencerOpen: mockSetSequencerOpen,
    setStepPattern: mockSetStepPattern,
    stepPattern: defaultStepPattern,
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

      expect(global.Worker).toHaveBeenCalledWith(expect.any(URL), {
        type: "module",
      });
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

      expect(mockOnPlaySample).toHaveBeenCalledWith(1, "kick.wav");
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

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("No sample available for voice 2"),
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

      expect(mockOnPlaySample).toHaveBeenCalledWith(1, "kick.wav");
      expect(mockOnPlaySample).toHaveBeenCalledWith(2, "snare.wav");
      expect(mockOnPlaySample).toHaveBeenCalledTimes(2);
    });
  });

  describe("Step Pattern Management", () => {
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
        } as any);
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
        } as any);
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
        } as any);
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
        } as any);
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
        } as any);
      });

      expect(result.current.focusedStep).toEqual({ step: 0, voice: 0 });

      // Test left boundary
      act(() => {
        result.current.handleStepGridKeyDown({
          key: "ArrowLeft",
          preventDefault: vi.fn(),
        } as any);
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
        } as any);
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
        } as any);
      });

      expect(result.current.focusedStep).toEqual({ step: 15, voice: 0 });
    });
  });

  describe("Keyboard Interaction", () => {
    it("should toggle step on Space key", () => {
      const params = {
        ...getDefaultParams(),
        sequencerOpen: true, // Need sequencer open for keyboard handling
      };

      const { result } = renderHook(() => useKitStepSequencerLogic(params));

      const mockPreventDefault = vi.fn();

      act(() => {
        result.current.handleStepGridKeyDown({
          key: " ",
          preventDefault: mockPreventDefault,
        } as any);
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      expect(mockSetStepPattern).toHaveBeenCalled();
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
        } as any);
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
        } as any);
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
        } as any);
      });

      expect(mockPreventDefault).not.toHaveBeenCalled();
    });
  });

  describe("Grid Focus Management", () => {
    it("should focus grid when sequencer opens", async () => {
      const mockGridRef = {
        current: {
          focus: vi.fn(),
        },
      };

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
      const mockGridRef = {
        current: {
          focus: vi.fn(),
        },
      };

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

      expect(result.current.ROW_COLORS[0]).toContain("bg-red-500");
      expect(result.current.ROW_COLORS[1]).toContain("bg-green-500");
      expect(result.current.ROW_COLORS[2]).toContain("bg-yellow-400");
      expect(result.current.ROW_COLORS[3]).toContain("bg-purple-500");
    });

    it("should return proper LED glow effects", () => {
      const { result } = renderHook(() =>
        useKitStepSequencerLogic(getDefaultParams()),
      );

      expect(result.current.LED_GLOWS[0]).toContain("rgba(239,68,68,0.7)");
      expect(result.current.LED_GLOWS[1]).toContain("rgba(34,197,94,0.7)");
      expect(result.current.LED_GLOWS[2]).toContain("rgba(234,179,8,0.7)");
      expect(result.current.LED_GLOWS[3]).toContain("rgba(168,85,247,0.7)");
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

      expect(mockOnPlaySample).toHaveBeenCalledWith(1, "kick.wav");

      // Test step 3 (velocity 1)
      act(() => {
        mockWorker.onmessage?.({
          data: { payload: { currentStep: 3 }, type: "STEP" },
        } as MessageEvent);
      });

      expect(mockOnPlaySample).toHaveBeenCalledWith(1, "kick.wav");
    });
  });
});
