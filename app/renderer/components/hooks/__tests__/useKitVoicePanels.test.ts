import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KitWithRelations } from "../../../../../shared/db/schema";
import type { VoiceSamples } from "../../kitTypes";

import { useKitVoicePanels } from "../useKitVoicePanels";

// Mock kit data
const mockKit: KitWithRelations = {
  alias: null,
  artist: null,
  bank_letter: "A",
  editable: false,
  locked: false,
  modified_since_sync: false,
  name: "TestKit",
  step_pattern: null,
  voices: [],
};

// Mock voice samples
const mockSamples: VoiceSamples = {
  1: ["kick1.wav", "kick2.wav"],
  2: ["snare1.wav"],
  3: ["hihat1.wav", "hihat2.wav", "hihat3.wav"],
  4: [],
};

const defaultProps = {
  kit: mockKit,
  kitName: "TestKit",
  onPlay: vi.fn(),
  onRescanVoiceName: vi.fn(),
  onSampleSelect: vi.fn(),
  onSaveVoiceName: vi.fn(),
  onStop: vi.fn(),
  onWaveformPlayingChange: vi.fn(),
  playTriggers: {},
  samplePlaying: {},
  samples: mockSamples,
  selectedSampleIdx: 0,
  selectedVoice: 1,
  setSelectedSampleIdx: vi.fn(),
  setSelectedVoice: vi.fn(),
  stopTriggers: {},
};

describe("useKitVoicePanels", () => {
  describe("basic functionality", () => {
    it("should return all passed props", () => {
      const { result } = renderHook(() => useKitVoicePanels(defaultProps));

      expect(result.current.kit).toBe(mockKit);
      expect(result.current.kitName).toBe("TestKit");
      expect(result.current.onPlay).toBe(defaultProps.onPlay);
      expect(result.current.onRescanVoiceName).toBe(
        defaultProps.onRescanVoiceName,
      );
      expect(result.current.onSampleSelect).toBe(defaultProps.onSampleSelect);
      expect(result.current.onSaveVoiceName).toBe(defaultProps.onSaveVoiceName);
      expect(result.current.onStop).toBe(defaultProps.onStop);
      expect(result.current.onWaveformPlayingChange).toBe(
        defaultProps.onWaveformPlayingChange,
      );
      expect(result.current.playTriggers).toBe(defaultProps.playTriggers);
      expect(result.current.samplePlaying).toBe(defaultProps.samplePlaying);
      expect(result.current.samples).toBe(mockSamples);
      expect(result.current.selectedSampleIdx).toBe(0);
      expect(result.current.selectedVoice).toBe(1);
      expect(result.current.stopTriggers).toBe(defaultProps.stopTriggers);
    });

    it("should provide onSampleKeyNav function", () => {
      const { result } = renderHook(() => useKitVoicePanels(defaultProps));

      expect(typeof result.current.onSampleKeyNav).toBe("function");
    });

    it("should handle sequencerOpen default value", () => {
      const { result } = renderHook(() => useKitVoicePanels(defaultProps));

      // Should work normally when sequencer is not explicitly set (defaults to false)
      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(defaultProps.setSelectedSampleIdx).toHaveBeenCalled();
    });

    it("should handle explicit sequencerOpen value", () => {
      const setSelectedSampleIdx = vi.fn();
      const setSelectedVoice = vi.fn();
      const props = {
        ...defaultProps,
        sequencerOpen: true,
        setSelectedSampleIdx,
        setSelectedVoice,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      // Should not navigate when sequencer is open
      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(setSelectedSampleIdx).not.toHaveBeenCalled();
      expect(setSelectedVoice).not.toHaveBeenCalled();
    });
  });

  describe("sample navigation - down direction", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should navigate to next sample in same voice", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 0, // First sample of voice 1 (has 2 samples)
        selectedVoice: 1,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(props.setSelectedSampleIdx).toHaveBeenCalledWith(1);
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
    });

    it("should navigate to next voice when at last sample of current voice", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 1, // Last sample of voice 1
        selectedVoice: 1,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(props.setSelectedVoice).toHaveBeenCalledWith(2);
      expect(props.setSelectedSampleIdx).toHaveBeenCalledWith(0);
    });

    it("should not navigate when at last sample of last voice", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 2, // Last sample of voice 3 (last voice with samples)
        selectedVoice: 3,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
    });

    it("should not navigate to empty voices when navigating down", () => {
      const samplesWithGap: VoiceSamples = {
        1: ["kick1.wav"],
        2: [], // Empty voice
        3: ["hihat1.wav"],
        4: [],
      };
      const props = {
        ...defaultProps,
        samples: samplesWithGap,
        selectedSampleIdx: 0, // Last sample of voice 1
        selectedVoice: 1,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("down");
      });

      // Should not navigate because voice 2 is empty
      // The implementation only checks voice + 1, not beyond
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
    });
  });

  describe("sample navigation - up direction", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should navigate to previous sample in same voice", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 1, // Second sample of voice 1
        selectedVoice: 1,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("up");
      });

      expect(props.setSelectedSampleIdx).toHaveBeenCalledWith(0);
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
    });

    it("should navigate to previous voice when at first sample of current voice", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 0, // First sample of voice 2
        selectedVoice: 2,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("up");
      });

      expect(props.setSelectedVoice).toHaveBeenCalledWith(1);
      expect(props.setSelectedSampleIdx).toHaveBeenCalledWith(1); // Last sample of voice 1
    });

    it("should not navigate when at first sample of first voice", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 0, // First sample of voice 1
        selectedVoice: 1,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("up");
      });

      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
    });

    it("should not navigate to empty voices when navigating up", () => {
      const samplesWithGap: VoiceSamples = {
        1: ["kick1.wav", "kick2.wav"],
        2: [], // Empty voice
        3: ["hihat1.wav"],
        4: [],
      };
      const props = {
        ...defaultProps,
        samples: samplesWithGap,
        selectedSampleIdx: 0, // First sample of voice 3
        selectedVoice: 3,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("up");
      });

      // Should not navigate because voice 2 is empty
      // The implementation only checks voice - 1, not beyond
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
    });
  });

  describe("sequencer disabled navigation", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should disable navigation when sequencer is open", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 0,
        selectedVoice: 1,
        sequencerOpen: true,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
      expect(props.setSelectedVoice).not.toHaveBeenCalled();

      act(() => {
        result.current.onSampleKeyNav("up");
      });

      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
    });

    it("should allow navigation when sequencer is explicitly closed", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 0,
        selectedVoice: 1,
        sequencerOpen: false,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(props.setSelectedSampleIdx).toHaveBeenCalledWith(1);
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle empty samples object", () => {
      const props = {
        ...defaultProps,
        samples: {},
        selectedSampleIdx: 0,
        selectedVoice: 1,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("down");
      });

      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
    });

    it("should handle null kit", () => {
      const props = {
        ...defaultProps,
        kit: null,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      expect(result.current.kit).toBeNull();
      expect(typeof result.current.onSampleKeyNav).toBe("function");
    });

    it("should handle invalid direction", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 0,
        selectedVoice: 1,
      };
      const { result } = renderHook(() => useKitVoicePanels(props));

      act(() => {
        result.current.onSampleKeyNav("invalid" as any);
      });

      expect(props.setSelectedSampleIdx).not.toHaveBeenCalled();
      expect(props.setSelectedVoice).not.toHaveBeenCalled();
    });

    it("should memoize navigation functions correctly", () => {
      const props = {
        ...defaultProps,
        selectedSampleIdx: 0,
        selectedVoice: 1,
      };
      const { rerender, result } = renderHook(() => useKitVoicePanels(props));

      const firstNavFunction = result.current.onSampleKeyNav;

      // Rerender with same props
      rerender();

      // Function should be memoized
      expect(result.current.onSampleKeyNav).toBe(firstNavFunction);
    });
  });
});
