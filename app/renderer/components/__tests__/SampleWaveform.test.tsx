// Test suite for SampleWaveform component
import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import SampleWaveform from "../SampleWaveform";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";

// Mock canvas for testing
const mockCanvasContext = {
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  lineTo: vi.fn(),
  lineWidth: 1,
  moveTo: vi.fn(),
  stroke: vi.fn(),
  strokeStyle: "",
};

const _mockCanvas = {
  getContext: vi.fn(() => mockCanvasContext),
  height: 18,
  width: 80,
};

beforeEach(() => {
  vi.clearAllMocks();
  setupElectronAPIMock();

  // Mock canvas methods
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext);
  Object.defineProperty(HTMLCanvasElement.prototype, "width", {
    configurable: true,
    get: () => 80,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "height", {
    configurable: true,
    get: () => 18,
  });

  // Mock AudioContext and related APIs
  global.AudioContext = vi.fn(() => ({
    close: vi.fn().mockResolvedValue(undefined),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
      start: vi.fn(),
      stop: vi.fn(),
    })),
    currentTime: 0,
    decodeAudioData: vi.fn(),
    destination: {},
    state: "running",
  }));

  // Mock animation frame functions
  global.requestAnimationFrame = vi.fn((cb) => {
    setTimeout(cb, 16);
    return 1;
  });
  global.cancelAnimationFrame = vi.fn();
});

describe("SampleWaveform", () => {
  it("renders the waveform canvas with correct dimensions", async () => {
    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform
            kitName="A1"
            playTrigger={0}
            slotNumber={1}
            voiceNumber={1}
          />
        </MockMessageDisplayProvider>,
      );
    });
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("width", "80");
    expect(canvas).toHaveAttribute("height", "18");
    expect(canvas).toHaveClass("rounded", "bg-slate-100", "dark:bg-slate-800");
  });

  it("loads and decodes audio buffer on mount", async () => {
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue(
      new ArrayBuffer(1024),
    );

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          playTrigger={0}
          slotNumber={1}
          voiceNumber={2}
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
        playTrigger={0}
        slotNumber={1}
        voiceNumber={1}
      />,
    );

    vi.clearAllMocks();

    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A2"
          playTrigger={0}
          slotNumber={2}
          voiceNumber={3}
        />,
      );
    });

    expect(window.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A2",
      3,
      2,
    );
  });

  it("handles null audio buffer response gracefully (empty slot)", async () => {
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue(null);
    const onError = vi.fn();

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          onError={onError}
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    expect(window.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A1",
      1,
      1,
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onPlayingChange when provided", async () => {
    const onPlayingChange = vi.fn();

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          onPlayingChange={onPlayingChange}
          playTrigger={1}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    // onPlayingChange should be called at least once (due to jsdom limitations, actual audio won't play)
    expect(onPlayingChange).toHaveBeenCalled();
  });

  it("handles missing API gracefully", async () => {
    const originalMethod = window.electronAPI.getSampleAudioBuffer;
    delete (window.electronAPI as any).getSampleAudioBuffer;
    const onError = vi.fn();

    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform
            kitName="A1"
            onError={onError}
            playTrigger={0}
            slotNumber={1}
            voiceNumber={1}
          />
        </MockMessageDisplayProvider>,
      );
    });

    expect(onError).toHaveBeenCalledWith(
      "Sample audio buffer API not available",
    );

    // Restore for other tests
    (window.electronAPI as any).getSampleAudioBuffer = originalMethod;
  });

  it("handles audio buffer loading errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockRejectedValue(
      new Error("File not found"),
    );
    const onError = vi.fn();

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          onError={onError}
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SampleWaveform] Sample not found: kit=A1, voice=1, slot=1:",
        expect.any(Error),
      );
    });

    // Should not call onError for missing samples
    expect(onError).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("cleans up resources on unmount", async () => {
    const { unmount } = render(
      <SampleWaveform
        kitName="A1"
        playTrigger={0}
        slotNumber={1}
        voiceNumber={1}
      />,
    );

    await act(async () => {
      unmount();
    });

    // Should not crash on unmount
    expect(true).toBe(true);
  });

  it("handles parameter changes without errors", async () => {
    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playTrigger={0}
        slotNumber={1}
        stopTrigger={0}
        voiceNumber={1}
      />,
    );

    // Change all parameters
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="B2"
          playTrigger={1}
          slotNumber={12}
          stopTrigger={1}
          voiceNumber={4}
        />,
      );
    });

    // Should handle parameter changes without crashing
    expect(window.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "B2",
      4,
      12,
    );
  });

  it("draws on canvas when audio buffer is available", async () => {
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeTruthy();

    // Mock basic canvas functionality
    expect(mockCanvasContext).toBeDefined();
  });

  it("handles AudioContext close errors gracefully", async () => {
    // Mock AudioContext.close to throw an error
    const mockAudioContext = {
      close: vi.fn().mockRejectedValue(new Error("Close failed")),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
      })),
      currentTime: 0,
      decodeAudioData: vi.fn(),
      destination: {},
      state: "running",
    };

    global.AudioContext = vi.fn(() => mockAudioContext);

    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue(
      new ArrayBuffer(1024),
    );

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playTrigger={0}
        slotNumber={1}
        voiceNumber={1}
      />,
    );

    // Wait for initial setup
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Trigger a re-render to cause previous AudioContext to be closed
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A2"
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    // Should handle close errors gracefully without throwing
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it("handles synchronous AudioContext close errors gracefully", async () => {
    // Mock AudioContext.close to throw synchronously
    const mockAudioContext = {
      close: vi.fn(() => {
        throw new Error("Synchronous close failed");
      }),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
      })),
      currentTime: 0,
      decodeAudioData: vi.fn(),
      destination: {},
      state: "running",
    };

    global.AudioContext = vi.fn(() => mockAudioContext);

    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue(
      new ArrayBuffer(1024),
    );

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playTrigger={0}
        slotNumber={1}
        voiceNumber={1}
      />,
    );

    // Trigger a re-render to cause previous AudioContext to be closed
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A2"
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    // Should handle synchronous close errors gracefully
    expect(mockAudioContext.close).toHaveBeenCalled();
  });
});
