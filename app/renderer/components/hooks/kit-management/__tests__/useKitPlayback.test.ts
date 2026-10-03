// Test suite for useKitPlayback hook
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useKitPlayback } from "../useKitPlayback";

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
    expect(result.current.playTriggers).toEqual({});
    expect(result.current.stopTriggers).toEqual({});
    expect(result.current.samplePlaying).toEqual({});
  });

  it("handlePlay triggers play and clears error", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(result.current.playTriggers["1:0"]).toBe(1);
    expect(result.current.playbackError).toBeNull();
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(result.current.playTriggers["1:0"]).toBe(2);
  });

  it("handleStop triggers stop and sets samplePlaying false", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleStop(2, 1);
    });
    expect(result.current.stopTriggers["2:1"]).toBe(1);
    expect(result.current.samplePlaying["2:1"]).toBe(false);
  });

  it("handleWaveformPlayingChange sets samplePlaying", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(3, 2, true);
    });
    expect(result.current.samplePlaying["3:2"]).toBe(true);
    act(() => {
      result.current.handleWaveformPlayingChange(3, 2, false);
    });
    expect(result.current.samplePlaying["3:2"]).toBe(false);
  });

  it("sets playVolumes when volume is provided", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0, 75);
    });
    expect(result.current.playVolumes["1:0"]).toBe(75);
  });

  it("does not set playVolumes when volume is omitted", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(result.current.playVolumes["1:0"]).toBeUndefined();
  });

  it("updates playVolumes on subsequent calls with different volumes", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, 0, 100);
    });
    expect(result.current.playVolumes["1:0"]).toBe(100);
    act(() => {
      result.current.handlePlay(1, 0, 50);
    });
    expect(result.current.playVolumes["1:0"]).toBe(50);
  });

  it("returns playVolumes in hook interface", () => {
    const { result } = renderHook(() => useKitPlayback());
    expect(result.current).toHaveProperty("playVolumes");
    expect(result.current.playVolumes).toEqual({});
  });

  it("chokes other playing samples on the same voice", () => {
    const { result } = renderHook(() => useKitPlayback());
    // Mark sample A on voice 1 as playing
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
    });
    expect(result.current.samplePlaying["1:0"]).toBe(true);

    // Play sample B on voice 1 — should stop sample A
    const prevStopTrigger = result.current.stopTriggers["1:0"] || 0;
    act(() => {
      result.current.handlePlay(1, 1);
    });
    expect(result.current.stopTriggers["1:0"]).toBeGreaterThan(prevStopTrigger);
    // New sample should have its play trigger incremented
    expect(result.current.playTriggers["1:1"]).toBe(1);
  });

  it("does not choke samples on other voices", () => {
    const { result } = renderHook(() => useKitPlayback());
    // Mark samples playing on voice 1 and voice 2
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
      result.current.handleWaveformPlayingChange(2, 1, true);
    });

    // Play a new sample on voice 1 — should NOT stop voice 2
    const voice2StopBefore = result.current.stopTriggers["2:1"] || 0;
    act(() => {
      result.current.handlePlay(1, 2);
    });
    expect(result.current.stopTriggers["2:1"] || 0).toBe(voice2StopBefore);
  });

  it("does not choke the same sample being replayed", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
    });

    // Replay same sample — SampleWaveform handles its own restart,
    // no extra stop trigger needed for the same key
    const stopBefore = result.current.stopTriggers["1:0"] || 0;
    act(() => {
      result.current.handlePlay(1, 0);
    });
    expect(result.current.stopTriggers["1:0"] || 0).toBe(stopBefore);
  });

  it("records play options for a play, and clears them for a plain play", () => {
    const { result } = renderHook(() => useKitPlayback());
    const options = { region: { length: 0.0625, start: 0.25 }, startAt: 1000 };
    act(() => {
      result.current.handlePlay(2, 0, 80, options);
    });
    expect(result.current.playOptions["2:0"]).toEqual(options);

    act(() => {
      result.current.handlePlay(2, 0);
    });
    expect(result.current.playOptions["2:0"]).toBeUndefined();
  });

  it("stops a choked sample when the choking sound is scheduled to start", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(1, 0, true);
    });
    act(() => {
      result.current.handlePlay(1, 1, 100, { startAt: 2500 });
    });
    expect(result.current.stopTriggers["1:0"]).toBe(1);
    expect(result.current.playOptions["1:0"]?.stopAt).toBe(2500);
  });

  describe("[UC-29] keyed by slot, not file name (RE-45)", () => {
    // Slots 0 and 1 of voice 1 hold two files with the same name (dropped
    // from different folders); voice 2 slot 0 holds a third
    it("plays only the triggered slot when two slots share a file name", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
      });
      expect(result.current.playTriggers["1:0"]).toBe(1);
      expect(result.current.playTriggers["1:1"]).toBeUndefined();
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
      expect(result.current.stopTriggers["1:0"]).toBe(1);
      expect(result.current.playTriggers["1:1"]).toBe(1);
      expect(result.current.stopTriggers["1:1"]).toBeUndefined();
    });

    it("tracks playing state per slot", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handleWaveformPlayingChange(1, 1, true);
      });
      expect(result.current.samplePlaying["1:1"]).toBe(true);
      expect(result.current.samplePlaying["1:0"]).toBeUndefined();
      expect(result.current.samplePlaying["2:0"]).toBeUndefined();
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
      expect(result.current.playTriggers["1:0"]).toBe(1);
      expect(result.current.samplePlaying["1:0"]).toBe(true);

      act(() => {
        result.current.handlePlay(1, 1);
      });
      expect(result.current.stopTriggers["1:0"]).toBe(1);
    });

    it("chokes a sample triggered moments ago, before it reports playing", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0, 100, { startAt: 1000 });
        result.current.handlePlay(1, 1, 100, { startAt: 1125 });
      });

      expect(result.current.stopTriggers["1:0"]).toBe(1);
      expect(result.current.playOptions["1:0"]?.stopAt).toBe(1125);
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

      expect(result.current.stopTriggers["1:0"]).toBeUndefined();
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
      expect(result.current.stopTriggers["1:0"]).toBe(1);
    });

    it("chokes each sample only once", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, 0);
        result.current.handlePlay(1, 1);
        result.current.handlePlay(1, 2);
      });

      expect(result.current.stopTriggers["1:0"]).toBe(1);
      expect(result.current.stopTriggers["1:1"]).toBe(1);
      expect(result.current.stopTriggers["1:2"]).toBeUndefined();
    });
  });
});
