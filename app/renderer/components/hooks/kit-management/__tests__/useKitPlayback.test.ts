// Test suite for useKitPlayback hook
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useKitPlayback } from "../useKitPlayback";

describe("useKitPlayback", () => {
  const mockSamples = { 1: [], 2: [], 3: [], 4: [] };

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes state correctly", () => {
    const { result } = renderHook(() => useKitPlayback(mockSamples));
    expect(result.current.playbackError).toBeNull();
    expect(result.current.playTriggers).toEqual({});
    expect(result.current.stopTriggers).toEqual({});
    expect(result.current.samplePlaying).toEqual({});
  });

  it("handlePlay triggers play and clears error", () => {
    const { result } = renderHook(() => useKitPlayback(mockSamples));
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
    const { result } = renderHook(() => useKitPlayback(mockSamples));
    act(() => {
      result.current.handleStop(2, "snare.wav");
    });
    expect(result.current.stopTriggers["2:snare.wav"]).toBe(1);
    expect(result.current.samplePlaying["2:snare.wav"]).toBe(false);
  });

  it("handleWaveformPlayingChange sets samplePlaying", () => {
    const { result } = renderHook(() => useKitPlayback(mockSamples));
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
    const { result } = renderHook(() => useKitPlayback(mockSamples));
    act(() => {
      result.current.handlePlay(1, "kick.wav", 75);
    });
    expect(result.current.playVolumes["1:kick.wav"]).toBe(75);
  });

  it("does not set playVolumes when volume is omitted", () => {
    const { result } = renderHook(() => useKitPlayback(mockSamples));
    act(() => {
      result.current.handlePlay(1, "kick.wav");
    });
    expect(result.current.playVolumes["1:kick.wav"]).toBeUndefined();
  });

  it("updates playVolumes on subsequent calls with different volumes", () => {
    const { result } = renderHook(() => useKitPlayback(mockSamples));
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
    const { result } = renderHook(() => useKitPlayback(mockSamples));
    expect(result.current).toHaveProperty("playVolumes");
    expect(result.current.playVolumes).toEqual({});
  });

  it("chokes other playing samples on the same voice", () => {
    const { result } = renderHook(() => useKitPlayback(mockSamples));
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
    const { result } = renderHook(() => useKitPlayback(mockSamples));
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
    const { result } = renderHook(() => useKitPlayback(mockSamples));
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

  it("sets playbackError on error event", () => {
    let errorHandler: unknown;
    vi.mocked(window.electronAPI.onSamplePlaybackError).mockImplementation(
      (cb) => {
        errorHandler = cb;
      },
    );
    const { result } = renderHook(() => useKitPlayback(mockSamples));
    act(() => {
      errorHandler("fail!");
    });
    expect(result.current.playbackError).toBe("fail!");
  });
});
