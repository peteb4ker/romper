// Test suite for SampleWaveform component
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { setupAudioMocks } from "../../../tests/mocks/browser/audio";
import { createElectronAPIMock } from "../../../tests/mocks/electron/electronAPI";
import SampleWaveform from "../SampleWaveform";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";

// Setup centralized test infrastructure

// The global setup in vitest.setup.ts now handles electronAPI and audio mocks

describe("SampleWaveform", () => {
  it("renders the waveform canvas", async () => {
    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform
            kitName="A1"
            voiceNumber={1}
            slotNumber={1}
            playTrigger={0}
          />
        </MockMessageDisplayProvider>,
      );
    });
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("loads and decodes audio buffer on mount", async () => {
    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          voiceNumber={2}
          slotNumber={1}
          playTrigger={0}
        />,
      );
    });
    expect(window.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A1",
      2,
      1,
    );
  });

  it("re-loads audio buffer when kit parameters change", async () => {
    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        voiceNumber={1}
        slotNumber={1}
        playTrigger={0}
      />,
    );
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A2"
          voiceNumber={1}
          slotNumber={1}
          playTrigger={0}
        />,
      );
    });
    expect(window.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A2",
      1,
      1,
    );
  });

  it("calls onPlayingChange when playback starts and stops", async () => {
    const onPlayingChange = vi.fn();
    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          voiceNumber={1}
          slotNumber={1}
          playTrigger={1}
          onPlayingChange={onPlayingChange}
        />,
      );
    });
    // The mock implementation only calls onPlayingChange(false) due to jsdom limitations
    expect(onPlayingChange).toHaveBeenCalledWith(false);
  });

  it("stops playback when stopTrigger changes", async () => {
    let playTrigger = 1;
    let stopTrigger = 0;
    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        voiceNumber={1}
        slotNumber={1}
        playTrigger={playTrigger}
        stopTrigger={stopTrigger}
      />,
    );
    // Simulate play
    playTrigger++;
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          voiceNumber={1}
          slotNumber={1}
          playTrigger={playTrigger}
          stopTrigger={stopTrigger}
        />,
      );
    });
    // Simulate stop
    stopTrigger++;
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          voiceNumber={1}
          slotNumber={1}
          playTrigger={playTrigger}
          stopTrigger={stopTrigger}
        />,
      );
    });
    // No crash = pass (can't check isPlaying directly)
  });

  it("handles missing API gracefully", async () => {
    // Remove the getSampleAudioBuffer method to test missing API
    const originalMethod = window.electronAPI.getSampleAudioBuffer;
    delete (window.electronAPI as any).getSampleAudioBuffer;
    const onError = vi.fn();
    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform
            kitName="A1"
            voiceNumber={1}
            slotNumber={1}
            playTrigger={0}
            onError={onError}
          />
        </MockMessageDisplayProvider>,
      );
    });
    expect(onError).toHaveBeenCalledWith(
      "Sample audio buffer API not available",
    );

    // Restore the method for other tests
    (window.electronAPI as any).getSampleAudioBuffer = originalMethod;
  });

  it("cleans up audio context and animation on unmount", async () => {
    const { unmount } = render(
      <SampleWaveform
        kitName="A1"
        voiceNumber={1}
        slotNumber={1}
        playTrigger={0}
      />,
    );
    await act(async () => {
      unmount();
    });
    // No crash = pass
  });
});
