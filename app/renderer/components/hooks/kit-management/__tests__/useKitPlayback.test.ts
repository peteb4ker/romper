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
      result.current.handlePlay(1, "kick.wav");
    });
    expect(result.current.playTriggers["1:kick.wav"]).toBe(1);
    expect(result.current.playbackError).toBeNull();
    act(() => {
      result.current.handlePlay(1, "kick.wav");
    });
    expect(result.current.playTriggers["1:kick.wav"]).toBe(2);
  });

  it("handleStop triggers stop and sets samplePlaying false", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleStop(2, "snare.wav");
    });
    expect(result.current.stopTriggers["2:snare.wav"]).toBe(1);
    expect(result.current.samplePlaying["2:snare.wav"]).toBe(false);
  });

  it("handleWaveformPlayingChange sets samplePlaying", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(3, "hat.wav", true);
    });
    expect(result.current.samplePlaying["3:hat.wav"]).toBe(true);
    act(() => {
      result.current.handleWaveformPlayingChange(3, "hat.wav", false);
    });
    expect(result.current.samplePlaying["3:hat.wav"]).toBe(false);
  });

  it("sets playVolumes when volume is provided", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, "kick.wav", 75);
    });
    expect(result.current.playVolumes["1:kick.wav"]).toBe(75);
  });

  it("does not set playVolumes when volume is omitted", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, "kick.wav");
    });
    expect(result.current.playVolumes["1:kick.wav"]).toBeUndefined();
  });

  it("updates playVolumes on subsequent calls with different volumes", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handlePlay(1, "kick.wav", 100);
    });
    expect(result.current.playVolumes["1:kick.wav"]).toBe(100);
    act(() => {
      result.current.handlePlay(1, "kick.wav", 50);
    });
    expect(result.current.playVolumes["1:kick.wav"]).toBe(50);
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
      result.current.handleWaveformPlayingChange(1, "kick.wav", true);
    });
    expect(result.current.samplePlaying["1:kick.wav"]).toBe(true);

    // Play sample B on voice 1 — should stop sample A
    const prevStopTrigger = result.current.stopTriggers["1:kick.wav"] || 0;
    act(() => {
      result.current.handlePlay(1, "snare.wav");
    });
    expect(result.current.stopTriggers["1:kick.wav"]).toBeGreaterThan(
      prevStopTrigger,
    );
    // New sample should have its play trigger incremented
    expect(result.current.playTriggers["1:snare.wav"]).toBe(1);
  });

  it("does not choke samples on other voices", () => {
    const { result } = renderHook(() => useKitPlayback());
    // Mark samples playing on voice 1 and voice 2
    act(() => {
      result.current.handleWaveformPlayingChange(1, "kick.wav", true);
      result.current.handleWaveformPlayingChange(2, "snare.wav", true);
    });

    // Play a new sample on voice 1 — should NOT stop voice 2
    const voice2StopBefore = result.current.stopTriggers["2:snare.wav"] || 0;
    act(() => {
      result.current.handlePlay(1, "hat.wav");
    });
    expect(result.current.stopTriggers["2:snare.wav"] || 0).toBe(
      voice2StopBefore,
    );
  });

  it("does not choke the same sample being replayed", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(1, "kick.wav", true);
    });

    // Replay same sample — SampleWaveform handles its own restart,
    // no extra stop trigger needed for the same key
    const stopBefore = result.current.stopTriggers["1:kick.wav"] || 0;
    act(() => {
      result.current.handlePlay(1, "kick.wav");
    });
    expect(result.current.stopTriggers["1:kick.wav"] || 0).toBe(stopBefore);
  });

  it("records play options for a play, and clears them for a plain play", () => {
    const { result } = renderHook(() => useKitPlayback());
    const options = { region: { length: 0.0625, start: 0.25 }, startAt: 1000 };
    act(() => {
      result.current.handlePlay(2, "break.wav", 80, options);
    });
    expect(result.current.playOptions["2:break.wav"]).toEqual(options);

    act(() => {
      result.current.handlePlay(2, "break.wav");
    });
    expect(result.current.playOptions["2:break.wav"]).toBeUndefined();
  });

  it("stops a choked sample when the choking sound is scheduled to start", () => {
    const { result } = renderHook(() => useKitPlayback());
    act(() => {
      result.current.handleWaveformPlayingChange(1, "kick.wav", true);
    });
    act(() => {
      result.current.handlePlay(1, "kick2.wav", 100, { startAt: 2500 });
    });
    expect(result.current.stopTriggers["1:kick.wav"]).toBe(1);
    expect(result.current.playOptions["1:kick.wav"]?.stopAt).toBe(2500);
  });

  describe("voice choke tracking (RE-13)", () => {
    it("keeps choking across re-renders, such as a kit reload", () => {
      const { rerender, result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, "kick.wav");
        result.current.handleWaveformPlayingChange(1, "kick.wav", true);
      });

      // An edit reloads the kit, which re-renders the editor
      rerender();
      rerender();
      expect(result.current.playTriggers["1:kick.wav"]).toBe(1);
      expect(result.current.samplePlaying["1:kick.wav"]).toBe(true);

      act(() => {
        result.current.handlePlay(1, "snare.wav");
      });
      expect(result.current.stopTriggers["1:kick.wav"]).toBe(1);
    });

    it("chokes a sample triggered moments ago, before it reports playing", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, "kick.wav", 100, { startAt: 1000 });
        result.current.handlePlay(1, "snare.wav", 100, { startAt: 1125 });
      });

      expect(result.current.stopTriggers["1:kick.wav"]).toBe(1);
      expect(result.current.playOptions["1:kick.wav"]?.stopAt).toBe(1125);
    });

    it("leaves a sample alone once it has finished", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, "kick.wav");
        result.current.handleWaveformPlayingChange(1, "kick.wav", true);
        result.current.handleWaveformPlayingChange(1, "kick.wav", false);
      });
      act(() => {
        result.current.handlePlay(1, "snare.wav");
      });

      expect(result.current.stopTriggers["1:kick.wav"]).toBeUndefined();
    });

    it("leaves a sample alone once it was stopped", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, "kick.wav");
        result.current.handleStop(1, "kick.wav");
      });
      act(() => {
        result.current.handlePlay(1, "snare.wav");
      });

      // One stop from handleStop, none from the choke
      expect(result.current.stopTriggers["1:kick.wav"]).toBe(1);
    });

    it("chokes each sample only once", () => {
      const { result } = renderHook(() => useKitPlayback());
      act(() => {
        result.current.handlePlay(1, "kick.wav");
        result.current.handlePlay(1, "snare.wav");
        result.current.handlePlay(1, "hat.wav");
      });

      expect(result.current.stopTriggers["1:kick.wav"]).toBe(1);
      expect(result.current.stopTriggers["1:snare.wav"]).toBe(1);
      expect(result.current.stopTriggers["1:hat.wav"]).toBeUndefined();
    });
  });
});
