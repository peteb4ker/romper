// Test suite for useKitPlayback hook
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDLE_SLOT } from "../slotPlaybackStore";
import { useKitPlayback } from "../useKitPlayback";

type Playback = { current: ReturnType<typeof useKitPlayback> };

/** A slot's playback, as its waveform reads it */
function slotOf(result: Playback, key: string) {
  return result.current.slotPlayback.get(key);
}

describe("useKitPlayback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes state correctly", () => {
    const { result } = renderHook(() => useKitPlayback());
    expect(result.current.playbackError).toBeNull();
    expect(slotOf(result, "1:0")).toBe(IDLE_SLOT);
  });

  it("handlePlay triggers play and clears error", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(slotOf(result, "1:0").playTrigger).toBe(1);
    expect(result.current.playbackError).toBeNull();
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(slotOf(result, "1:0").playTrigger).toBe(2);
  });

  it("handleStop triggers stop and marks the slot not playing", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleStop(2, 1);
    });
    expect(slotOf(result, "2:1").stopTrigger).toBe(1);
    expect(slotOf(result, "2:1").playing).toBe(false);
  });

  it("handleWaveformPlayingChange sets the slot playing", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(3, 2, true);
    });
    expect(slotOf(result, "3:2").playing).toBe(true);
    act(() => {
      result.current.handleWaveformPlayingChange(3, 2, false);
    });
    expect(slotOf(result, "3:2").playing).toBe(false);
  });

  it("sets the volume when volume is provided", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0, 75);
    });
    expect(slotOf(result, "1:0").volume).toBe(75);
  });

  it("does not set a volume when volume is omitted", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(slotOf(result, "1:0").volume).toBeUndefined();
  });

  it("updates the volume on subsequent calls with different volumes", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0, 100);
    });
    expect(slotOf(result, "1:0").volume).toBe(100);
    act(() => {
      result.current.handlePlay(1, 0, 50);
    });
    expect(slotOf(result, "1:0").volume).toBe(50);
  });

  it("keeps a volume until a play gives another", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0, 60);
      result.current.handlePlay(1, 0);
    });
    expect(slotOf(result, "1:0").volume).toBe(60);
  });

  it("chokes other playing samples on the same voice", () => {
    const { result } = renderHook(() => useKitPlayback());
    // Mark sample A on voice 1 as playing
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
    });
    expect(slotOf(result, "1:0").playing).toBe(true);

    // Play sample B on voice 1 — should stop sample A
    const prevStopTrigger = slotOf(result, "1:0").stopTrigger;
    act(() => {
      result.current.handlePlay(1, 1);
    });
    expect(slotOf(result, "1:0").stopTrigger).toBeGreaterThan(prevStopTrigger);
    // New sample should have its play trigger incremented
    expect(slotOf(result, "1:1").playTrigger).toBe(1);
  });

  it("does not choke samples on other voices", () => {
    const { result } = renderHook(() => useKitPlayback());
    // Mark samples playing on voice 1 and voice 2
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
      result.current.handleWaveformPlayingChange(2, 1, true);
    });

    // Play a new sample on voice 1 — should NOT stop voice 2
    const voice2StopBefore = slotOf(result, "2:1").stopTrigger;
    act(() => {
      result.current.handlePlay(1, 2);
    });
    expect(slotOf(result, "2:1").stopTrigger).toBe(voice2StopBefore);
  });

  it("does not choke the same sample being replayed", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
    });

    // Replay same sample — SampleWaveform handles its own restart,
    // no extra stop trigger needed for the same key
    const stopBefore = slotOf(result, "1:0").stopTrigger;
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(slotOf(result, "1:0").stopTrigger).toBe(stopBefore);
  });

  it("records play options for a play, and clears them for a plain play", () => {
    const { result } = renderHook(() => useKitPlayback());
    const options = { region: { length: 0.0625, start: 0.25 }, startAt: 1000 };
    act(() => {
      result.current.handlePlay(2, 0, 80, options);
    });
    expect(slotOf(result, "2:0").options).toEqual(options);

    act(() => {
      result.current.handlePlay(2, 0);
    });
    expect(slotOf(result, "2:0").options).toBeUndefined();
  });

  it("stops a choked sample when the choking sound is scheduled to start", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
    });
    act(() => {
      result.current.handlePlay(1, 1, 100, { startAt: 2500 });
    });
    expect(slotOf(result, "1:0").stopTrigger).toBe(1);
    expect(slotOf(result, "1:0").options?.stopAt).toBe(2500);
  });

  describe("[UC-29] keyed by slot, not file name (RE-45)", () => {
    // Slots 0 and 1 of voice 1 hold two files with the same name (dropped
    // from different folders); voice 2 slot 0 holds a third
    it("plays only the triggered slot when two slots share a file name", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
      });
      expect(slotOf(result, "1:0").playTrigger).toBe(1);
      expect(slotOf(result, "1:1").playTrigger).toBe(0);
    });

    it("chokes the other slot with the same file name on the voice", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
        result.current.handleWaveformPlayingChange(1, 0, true);
      });
      act(() => {
        result.current.handlePlay(1, 1);
      });
      expect(slotOf(result, "1:0").stopTrigger).toBe(1);
      expect(slotOf(result, "1:1").playTrigger).toBe(1);
      expect(slotOf(result, "1:1").stopTrigger).toBe(0);
    });

    it("tracks playing state per slot", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handleWaveformPlayingChange(1, 1, true);
      });
      expect(slotOf(result, "1:1").playing).toBe(true);
      expect(slotOf(result, "1:0").playing).toBe(false);
      expect(slotOf(result, "2:0").playing).toBe(false);
    });
  });

  describe("[UC-29] voice choke tracking (RE-13)", () => {
    it("keeps choking across re-renders, such as a kit reload", () => {
      const { rerender, result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
        result.current.handleWaveformPlayingChange(1, 0, true);
      });

      // An edit reloads the kit, which re-renders the editor
      rerender();
      rerender();
      expect(slotOf(result, "1:0").playTrigger).toBe(1);
      expect(slotOf(result, "1:0").playing).toBe(true);

      act(() => {
        result.current.handlePlay(1, 1);
      });
      expect(slotOf(result, "1:0").stopTrigger).toBe(1);
    });

    it("chokes a sample triggered moments ago, before it reports playing", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0, 100, { startAt: 1000 });
        result.current.handlePlay(1, 1, 100, { startAt: 1125 });
      });

      expect(slotOf(result, "1:0").stopTrigger).toBe(1);
      expect(slotOf(result, "1:0").options?.stopAt).toBe(1125);
    });

    it("leaves a sample alone once it has finished", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
        result.current.handleWaveformPlayingChange(1, 0, true);
        result.current.handleWaveformPlayingChange(1, 0, false);
      });
      act(() => {
        result.current.handlePlay(1, 1);
      });

      expect(slotOf(result, "1:0").stopTrigger).toBe(0);
    });

    it("leaves a sample alone once it was stopped", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
        result.current.handleStop(1, 0);
      });
      act(() => {
        result.current.handlePlay(1, 1);
      });

      // One stop from handleStop, none from the choke
      expect(slotOf(result, "1:0").stopTrigger).toBe(1);
    });

    it("chokes each sample only once", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
        result.current.handlePlay(1, 1);
        result.current.handlePlay(1, 2);
      });

      expect(slotOf(result, "1:0").stopTrigger).toBe(1);
      expect(slotOf(result, "1:1").stopTrigger).toBe(1);
      expect(slotOf(result, "1:2").stopTrigger).toBe(0);
    });
  });
});

describe("[Q-01] [UC-29] useKitPlayback re-renders nothing on a trigger (#482)", () => {
  it("keeps its handlers and doesn't re-render the editor that holds it", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useKitPlayback();
    });
    const first = result.current;
    renders = 0;

    act(() => {
      result.current.handlePlay(1, 0, 100, { startAt: 1000 });
      result.current.handleWaveformPlayingChange(1, 0, true);
      result.current.handlePlay(1, 1);
      result.current.handleStop(1, 1);
    });

    expect(renders).toBe(0);
    expect(result.current.handlePlay).toBe(first.handlePlay);
    expect(result.current.handleStop).toBe(first.handleStop);
    expect(result.current.handleWaveformPlayingChange).toBe(
      first.handleWaveformPlayingChange,
    );
    expect(result.current.slotPlayback).toBe(first.slotPlayback);
  });
});
