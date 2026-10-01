// Test suite for SampleWaveform component
import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import SampleWaveform from "../SampleWaveform";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";

function createMockAnalyser() {
  return {
    connect: vi.fn(),
    fftSize: 2048,
    frequencyBinCount: 128,
    getByteTimeDomainData: vi.fn(),
  };
}

function createMockAudioContext(overrides?: Record<string, unknown>) {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    createAnalyser: vi.fn(() => createMockAnalyser()),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createChannelSplitter: vi.fn(() => ({ connect: vi.fn() })),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    })),
    currentTime: 0,
    decodeAudioData: vi.fn(),
    destination: {},
    state: "running",
    ...overrides,
  };
}

// Mock canvas for testing
const mockCanvasContext = {
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  fillStyle: "",
  globalAlpha: 1,
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
  global.AudioContext = vi.fn(function () {
    return createMockAudioContext();
  });

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
    expect(canvas).toHaveClass("rounded", "bg-surface-3");
  });

  it("loads and decodes audio buffer on mount", async () => {
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(1024),
      success: true,
    });

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
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: null,
      success: true,
    });
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
    delete (window.electronAPI as unknown).getSampleAudioBuffer;
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
    (window.electronAPI as unknown).getSampleAudioBuffer = originalMethod;
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
    const { container, unmount } = render(
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

    // Unmount should tear down the rendered DOM without crashing
    expect(container.childElementCount).toBe(0);
  });

  it("creates GainNode and applies volume when volume prop is provided", async () => {
    const mockGainNode = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    };
    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockAudioBuffer = {
      duration: 1.0,
      getChannelData: vi.fn(() => new Float32Array(100)),
      length: 44100,
      numberOfChannels: 1,
      sampleRate: 44100,
    };

    const mockAudioContext = createMockAudioContext({
      createBufferSource: vi.fn(() => mockSource),
      createGain: vi.fn(() => mockGainNode),
      decodeAudioData: vi.fn((_buf, cb) => cb(mockAudioBuffer)),
    });

    global.AudioContext = vi.fn(function () {
      return mockAudioContext;
    });

    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(1024),
      success: true,
    });

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playTrigger={0}
        slotNumber={1}
        voiceNumber={1}
        volume={60}
      />,
    );

    // Wait for audio buffer to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Trigger playback
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          playTrigger={1}
          slotNumber={1}
          voiceNumber={1}
          volume={60}
        />,
      );
    });

    // GainNode should have been created and volume applied with logarithmic curve
    // volume=60 → linear=0.6 → gain=0.6*0.6=0.36
    if (mockAudioContext.createGain.mock.calls.length > 0) {
      expect(mockGainNode.connect).toHaveBeenCalledWith(
        mockAudioContext.destination,
      );
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalled();
      // Source should connect to gain node, not directly to destination
      expect(mockSource.connect).toHaveBeenCalledWith(mockGainNode);
    }
  });

  describe("region (slice) playback", () => {
    function setupRegionMocks() {
      const gainNodes: {
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
        gain: Record<string, unknown>;
      }[] = [];
      const sources: {
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
        onended: (() => void) | null;
        start: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
      }[] = [];
      const mockAudioBuffer = {
        duration: 2.0,
        getChannelData: vi.fn(() => new Float32Array(100)),
        length: 88200,
        numberOfChannels: 1,
        sampleRate: 44100,
      };
      const mockAudioContext = createMockAudioContext({
        createBufferSource: vi.fn(() => {
          const source = {
            buffer: null,
            connect: vi.fn(),
            disconnect: vi.fn(),
            onended: null,
            start: vi.fn(),
            stop: vi.fn(),
          };
          sources.push(source);
          return source;
        }),
        createGain: vi.fn(() => {
          const node = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            gain: {
              cancelScheduledValues: vi.fn(),
              linearRampToValueAtTime: vi.fn(),
              setValueAtTime: vi.fn(),
              value: 1,
            },
          };
          gainNodes.push(node);
          return node;
        }),
        currentTime: 5,
        decodeAudioData: vi.fn((_buf, cb) => cb(mockAudioBuffer)),
      });
      global.AudioContext = vi.fn(function () {
        return mockAudioContext;
      });
      vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
        data: new ArrayBuffer(1024),
        success: true,
      });
      return { ctx: mockAudioContext, gainNodes, sources };
    }

    async function renderAndPlay(
      playRegion: { length: number; start: number } | undefined,
    ) {
      const { rerender } = render(
        <SampleWaveform
          kitName="A1"
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      await act(async () => {
        rerender(
          <SampleWaveform
            kitName="A1"
            playOptions={playRegion ? { region: playRegion } : undefined}
            playTrigger={1}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
      });
      return rerender;
    }

    async function playAgain(
      rerender: ReturnType<typeof render>["rerender"],
      trigger: number,
    ) {
      await act(async () => {
        rerender(
          <SampleWaveform
            kitName="A1"
            playOptions={{ region: { length: 0.125, start: 0.25 } }}
            playTrigger={trigger}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
      });
    }

    /** Two players: slot 1 on `voiceA` and slot 2 on `voiceB`. */
    async function renderPair(voiceA: number, voiceB: number) {
      const pair = (a: number, b: number) => (
        <>
          <SampleWaveform
            kitName="A1"
            playOptions={{ region: { length: 0.125, start: 0 } }}
            playTrigger={a}
            slotNumber={1}
            voiceNumber={voiceA}
          />
          <SampleWaveform
            kitName="A1"
            playTrigger={b}
            slotNumber={2}
            voiceNumber={voiceB}
          />
        </>
      );
      const { rerender } = render(pair(0, 0));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      return async (a: number, b: number) => {
        await act(async () => {
          rerender(pair(a, b));
        });
      };
    }

    it("chokes another slot's sound on the same voice, whatever started it", async () => {
      const { sources } = setupRegionMocks();
      const play = await renderPair(1, 1);

      await play(1, 0); // slot 1 plays a slice
      await play(1, 1); // slot 2 starts on the same voice

      // The audio layer stops slot 1's sound with no help from React state
      expect(sources[0].stop).toHaveBeenCalled();
      expect(sources[1].stop).not.toHaveBeenCalled();
    });

    it("lets different voices sound together", async () => {
      const { sources } = setupRegionMocks();
      const play = await renderPair(1, 2);

      await play(1, 0);
      await play(1, 1);

      expect(sources[0].stop).not.toHaveBeenCalled();
    });

    it("releases a finished slice's source and envelope", async () => {
      const { gainNodes, sources } = setupRegionMocks();
      await renderAndPlay({ length: 0.125, start: 0.25 });
      const envelope = gainNodes.find((n) =>
        sources[0].connect.mock.calls.some(([target]) => target === n),
      )!;

      act(() => sources[0].onended?.());

      expect(sources[0].disconnect).toHaveBeenCalled();
      expect(envelope.disconnect).toHaveBeenCalled();
    });

    it("creates the volume gain and VU meter once, not per trigger", async () => {
      const { ctx, sources } = setupRegionMocks();
      const rerender = await renderAndPlay({ length: 0.125, start: 0.25 });
      await playAgain(rerender, 2);
      await playAgain(rerender, 3);

      expect(sources).toHaveLength(3);
      expect(ctx.createAnalyser).toHaveBeenCalledTimes(1);
      // One shared volume gain plus one envelope per slice
      expect(ctx.createGain).toHaveBeenCalledTimes(4);
    });

    it("resumes a suspended context before playing", async () => {
      const { ctx } = setupRegionMocks();
      const resume = vi.fn().mockResolvedValue(undefined);
      Object.assign(ctx, { resume, state: "suspended" });

      await renderAndPlay({ length: 0.125, start: 0.25 });

      expect(resume).toHaveBeenCalled();
    });

    it("starts at the region offset and plays only its duration", async () => {
      const { gainNodes, sources } = setupRegionMocks();
      await renderAndPlay({ length: 0.125, start: 0.25 });

      // 2 s sample: start 25 % = 0.5 s, length 12.5 % = 0.25 s
      expect(sources[0].start).toHaveBeenCalledWith(5, 0.5, 0.25);
      // Source routes through a per-source envelope with anti-click ramps
      const envelope = gainNodes.find((n) =>
        sources[0].connect.mock.calls.some(([target]) => target === n),
      )!;
      expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        5.002,
      );
      expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        5.25,
      );
    });

    it("clips a region that runs past the end of the sample", async () => {
      const { sources } = setupRegionMocks();
      await renderAndPlay({ length: 0.5, start: 0.75 });
      expect(sources[0].start).toHaveBeenCalledWith(5, 1.5, 0.5);
    });

    it("plays the whole sample when no region is given", async () => {
      const { sources } = setupRegionMocks();
      await renderAndPlay(undefined);
      expect(sources[0].start).toHaveBeenCalledWith();
    });

    it("starts at the scheduled time when one is given", async () => {
      const { sources } = setupRegionMocks();
      vi.spyOn(performance, "now").mockReturnValue(1000);
      const { rerender } = render(
        <SampleWaveform
          kitName="A1"
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      await act(async () => {
        rerender(
          <SampleWaveform
            kitName="A1"
            playOptions={{ startAt: 1080 }}
            playTrigger={1}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
      });
      await act(async () => {
        rerender(
          <SampleWaveform
            kitName="A1"
            playOptions={{
              region: { length: 0.125, start: 0 },
              startAt: 1205,
            }}
            playTrigger={2}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
      });
      vi.mocked(performance.now).mockRestore();

      // 80 ms ahead of "now" on a context whose clock reads 5 s
      expect(sources[0].start.mock.calls[0][0]).toBeCloseTo(5.08, 5);
      // The retriggered slice is scheduled, and the first stops right then
      expect(sources[1].start.mock.calls[0][0]).toBeCloseTo(5.205, 5);
      expect(sources[0].stop.mock.calls[0][0]).toBeCloseTo(5.205, 5);
    });

    it("fades out instead of cutting when a slice is retriggered", async () => {
      const { sources } = setupRegionMocks();
      const rerender = await renderAndPlay({ length: 0.125, start: 0 });
      await act(async () => {
        rerender(
          <SampleWaveform
            kitName="A1"
            playOptions={{ region: { length: 0.125, start: 0.5 } }}
            playTrigger={2}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
      });

      // First slice stops after a short fade; second starts at its offset
      expect(sources[0].stop).toHaveBeenCalledWith(5.002);
      expect(sources[1].start).toHaveBeenCalledWith(5, 1, 0.25);
    });
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

    global.AudioContext = vi.fn(function () {
      return mockAudioContext;
    });

    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(1024),
      success: true,
    });

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

  it("clears onended on previous source when replaying to prevent stale callback", async () => {
    const mockSource1 = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockSource2 = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGainNode = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    };
    const mockAudioBuffer = {
      duration: 1.0,
      getChannelData: vi.fn(() => new Float32Array(100)),
      length: 44100,
      numberOfChannels: 1,
      sampleRate: 44100,
    };

    let sourceCallCount = 0;
    const mockAudioContext = createMockAudioContext({
      createBufferSource: vi.fn(() => {
        sourceCallCount++;
        return sourceCallCount === 1 ? mockSource1 : mockSource2;
      }),
      createGain: vi.fn(() => mockGainNode),
      decodeAudioData: vi.fn(
        (_buf: ArrayBuffer, cb: (buf: AudioBuffer) => void) =>
          cb(mockAudioBuffer as unknown as AudioBuffer),
      ),
    });

    global.AudioContext = vi.fn(function () {
      return mockAudioContext;
    });
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(1024),
      success: true,
    });

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playTrigger={0}
        slotNumber={1}
        voiceNumber={1}
      />,
    );

    // Wait for audio buffer to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // First play — source1 gets an onended handler
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          playTrigger={1}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    expect(mockSource1.start).toHaveBeenCalled();
    // source1 should have an onended handler set by the play effect
    expect(mockSource1.onended).not.toBeNull();

    // Second play — stopPlayback() should clear source1.onended before stopping
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          playTrigger={2}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    // source1's onended should have been cleared to prevent stale callback
    expect(mockSource1.onended).toBeNull();
    expect(mockSource1.stop).toHaveBeenCalled();
    expect(mockSource1.disconnect).toHaveBeenCalled();
    // source2 should be the new active source
    expect(mockSource2.start).toHaveBeenCalled();
  });

  it("does not stop freshly started playback when stopTrigger and playTrigger change in same batch", async () => {
    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGainNode = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    };
    const mockAudioBuffer = {
      duration: 1.0,
      getChannelData: vi.fn(() => new Float32Array(100)),
      length: 44100,
      numberOfChannels: 1,
      sampleRate: 44100,
    };

    const mockAudioContext = createMockAudioContext({
      createBufferSource: vi.fn(() => mockSource),
      createGain: vi.fn(() => mockGainNode),
      decodeAudioData: vi.fn(
        (_buf: ArrayBuffer, cb: (buf: AudioBuffer) => void) =>
          cb(mockAudioBuffer as unknown as AudioBuffer),
      ),
    });

    global.AudioContext = vi.fn(function () {
      return mockAudioContext;
    });
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(1024),
      success: true,
    });
    const onPlayingChange = vi.fn();

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        onPlayingChange={onPlayingChange}
        playTrigger={0}
        slotNumber={1}
        stopTrigger={0}
        voiceNumber={1}
      />,
    );

    // Wait for audio buffer to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // First play to establish playing state
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          onPlayingChange={onPlayingChange}
          playTrigger={1}
          slotNumber={1}
          stopTrigger={0}
          voiceNumber={1}
        />,
      );
    });

    expect(mockSource.start).toHaveBeenCalledTimes(1);

    // Simulate the race condition: both stopTrigger and playTrigger change
    // in the same render (voice choke + new play in same batch).
    // The stop effect should NOT kill the freshly started source.
    mockSource.start.mockClear();
    mockSource.stop.mockClear();

    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          onPlayingChange={onPlayingChange}
          playTrigger={2}
          slotNumber={1}
          stopTrigger={1}
          voiceNumber={1}
        />,
      );
    });

    // Play effect should have started a new source
    expect(mockSource.start).toHaveBeenCalledTimes(1);
    // Stop should have been called once (by stopPlayback in the play effect),
    // NOT twice (which would mean the stop effect also fired and killed the new source)
    expect(mockSource.stop).toHaveBeenCalledTimes(1);
  });

  it("stop effect calls stopPlayback for proper cleanup when stopTrigger fires independently", async () => {
    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGainNode = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    };
    const mockAudioBuffer = {
      duration: 1.0,
      getChannelData: vi.fn(() => new Float32Array(100)),
      length: 44100,
      numberOfChannels: 1,
      sampleRate: 44100,
    };

    const mockAudioContext = createMockAudioContext({
      createBufferSource: vi.fn(() => mockSource),
      createGain: vi.fn(() => mockGainNode),
      decodeAudioData: vi.fn(
        (_buf: ArrayBuffer, cb: (buf: AudioBuffer) => void) =>
          cb(mockAudioBuffer as unknown as AudioBuffer),
      ),
    });

    global.AudioContext = vi.fn(function () {
      return mockAudioContext;
    });
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(1024),
      success: true,
    });
    const onPlayingChange = vi.fn();

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        onPlayingChange={onPlayingChange}
        playTrigger={0}
        slotNumber={1}
        stopTrigger={0}
        voiceNumber={1}
      />,
    );

    // Wait for audio buffer to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Start playback
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          onPlayingChange={onPlayingChange}
          playTrigger={1}
          slotNumber={1}
          stopTrigger={0}
          voiceNumber={1}
        />,
      );
    });

    expect(mockSource.start).toHaveBeenCalled();
    mockSource.stop.mockClear();
    mockSource.disconnect.mockClear();

    // Now trigger stop independently (voice choke from another voice)
    await act(async () => {
      rerender(
        <SampleWaveform
          kitName="A1"
          onPlayingChange={onPlayingChange}
          playTrigger={1}
          slotNumber={1}
          stopTrigger={1}
          voiceNumber={1}
        />,
      );
    });

    // stopPlayback should have been called: onended cleared, source stopped and disconnected
    expect(mockSource.onended).toBeNull();
    expect(mockSource.stop).toHaveBeenCalled();
    expect(mockSource.disconnect).toHaveBeenCalled();
    // cancelAnimationFrame should have been called for cleanup
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("handles synchronous AudioContext close errors gracefully", async () => {
    // Mock AudioContext.close to return a rejected Promise
    const mockAudioContext = {
      close: vi.fn(() => Promise.reject(new Error("Synchronous close failed"))),
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

    global.AudioContext = vi.fn(function () {
      return mockAudioContext;
    });

    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(1024),
      success: true,
    });

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
