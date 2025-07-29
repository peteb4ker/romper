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
    const { result } = renderHook(() => useKitPlayback({}));
    expect(result.current.playbackError).toBeNull();
    expect(result.current.playTriggers).toEqual({});
    expect(result.current.stopTriggers).toEqual({});
    expect(result.current.samplePlaying).toEqual({});
  });

  it("handlePlay triggers play and clears error", () => {
    const { result } = renderHook(() => useKitPlayback({}));
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
    const { result } = renderHook(() => useKitPlayback({}));
    act(() => {
      result.current.handleStop(2, "snare.wav");
    });
    expect(result.current.stopTriggers["2:snare.wav"]).toBe(1);
    expect(result.current.samplePlaying["2:snare.wav"]).toBe(false);
  });

  it("handleWaveformPlayingChange sets samplePlaying", () => {
    const { result } = renderHook(() => useKitPlayback({}));
    act(() => {
      result.current.handleWaveformPlayingChange(3, "hat.wav", true);
    });
    expect(result.current.samplePlaying["3:hat.wav"]).toBe(true);
    act(() => {
      result.current.handleWaveformPlayingChange(3, "hat.wav", false);
    });
    expect(result.current.samplePlaying["3:hat.wav"]).toBe(false);
  });

  it("sets playbackError on error event", () => {
    let errorHandler: any;
    vi.mocked(window.electronAPI.onSamplePlaybackError).mockImplementation(
      (cb) => {
        errorHandler = cb;
      },
    );
    const { result } = renderHook(() => useKitPlayback({}));
    act(() => {
      errorHandler("fail!");
    });
    expect(result.current.playbackError).toBe("fail!");
  });
});
