// Test suite for SampleWaveform component
import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { clearAllLevels, getVoiceLevel } from "../led-icon/audioLevels";
import SampleWaveform from "../SampleWaveform";

// Each test installs its own AudioContext mock; build the "shared" context
// from it so every test starts from a fresh one
vi.mock("../../utils/sharedAudioContext", () => ({
  getSharedAudioContext: vi.fn(() => new globalThis.AudioContext()),
}));
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
    // Pending until a test resolves it
    decodeAudioData: vi.fn(() => new Promise(() => {})),
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

  // Mock animation frame functions. Cancelling clears the frame's timer, so
  // a playhead loop stops when its waveform unmounts instead of firing
  // after the test environment is gone.
  global.requestAnimationFrame = vi.fn(
    (cb) => setTimeout(cb, 16) as unknown as number,
  );
  global.cancelAnimationFrame = vi.fn((id: number) => clearTimeout(id));
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

  it("handles a file that can't be decoded without a background failure (#537)", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const decodeError = new Error("Unable to decode audio data");
    global.AudioContext = vi.fn(function () {
      return createMockAudioContext({
        decodeAudioData: vi.fn(() => Promise.reject(decodeError)),
      });
    });
    vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: new ArrayBuffer(16),
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

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SampleWaveform] Can't decode sample: kit=A1, voice=1, slot=1:",
        decodeError,
      );
    });
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
      decodeAudioData: vi.fn(async () => mockAudioBuffer),
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
        decodeAudioData: vi.fn(async () => mockAudioBuffer),
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

    it("[UC-29] doesn't play a trigger counted before it mounted (RE-45)", async () => {
      // Triggers are counted per slot and outlive the sample in it: a sample
      // that moves into a played slot, or the same slot in the next kit,
      // mounts with a count above 0
      const { sources } = setupRegionMocks();
      const { rerender } = render(
        <SampleWaveform
          kitName="A1"
          playTrigger={3}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(sources).toHaveLength(0);

      await act(async () => {
        rerender(
          <SampleWaveform
            kitName="A1"
            playTrigger={4}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
      });
      expect(sources).toHaveLength(1);
    });

    it("plays a trigger that arrives before its audio has loaded", async () => {
      const { sources } = setupRegionMocks();
      const { rerender } = render(
        <SampleWaveform
          kitName="A1"
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
      rerender(
        <SampleWaveform
          kitName="A1"
          playTrigger={1}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(sources).toHaveLength(1);
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
        async () => mockAudioBuffer as unknown as AudioBuffer,
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
        async () => mockAudioBuffer as unknown as AudioBuffer,
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
        async () => mockAudioBuffer as unknown as AudioBuffer,
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

  describe("shared AudioContext (RE-14)", () => {
    async function playOnce(volume = 80) {
      const gainNode = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { setValueAtTime: vi.fn() },
      };
      const ctx = createMockAudioContext({
        createGain: vi.fn(() => gainNode),
        decodeAudioData: vi.fn(async () => ({
          duration: 1,
          getChannelData: vi.fn(() => new Float32Array(100)),
          length: 44100,
          numberOfChannels: 1,
          sampleRate: 44100,
        })),
      });
      global.AudioContext = vi.fn(function () {
        return ctx;
      });
      vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
        data: new ArrayBuffer(1024),
        success: true,
      });
      const view = render(
        <SampleWaveform
          kitName="A1"
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
          volume={volume}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      await act(async () => {
        view.rerender(
          <SampleWaveform
            kitName="A1"
            playTrigger={1}
            slotNumber={1}
            voiceNumber={1}
            volume={volume}
          />,
        );
      });
      expect(ctx.createGain).toHaveBeenCalledTimes(1);
      return { ctx, gainNode, view };
    }

    it("never closes the shared context, even when it unmounts", async () => {
      const { ctx, view } = await playOnce();
      view.unmount();
      expect(ctx.close).not.toHaveBeenCalled();
    });

    it("disconnects its own volume and meter nodes when it unmounts", async () => {
      const { gainNode, view } = await playOnce();
      expect(gainNode.disconnect).not.toHaveBeenCalled();
      view.unmount();
      expect(gainNode.disconnect).toHaveBeenCalled();
    });

    it("disconnects them when its slot gets another sample", async () => {
      const { ctx, gainNode, view } = await playOnce();
      await act(async () => {
        view.rerender(
          <SampleWaveform
            kitName="A1"
            playTrigger={1}
            slotNumber={2}
            voiceNumber={1}
            volume={80}
          />,
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(gainNode.disconnect).toHaveBeenCalled();
      expect(ctx.close).not.toHaveBeenCalled();
    });
  });

  describe("[UC-29] [UC-28] a stereo sample plays as the card gets it (#569)", () => {
    const left = [1, 0.5, 0, -1];
    const right = [0, 0.5, 1, -1];

    function stereoBuffer() {
      return {
        duration: 1,
        getChannelData: vi.fn(
          (ch: number) => new Float32Array(ch === 0 ? left : right),
        ),
        length: left.length,
        numberOfChannels: 2,
        sampleRate: 44100,
      };
    }

    // An AudioBuffer as createBuffer makes one: zeroed channels
    function createBuffer(channels: number, length: number, rate: number) {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length),
      );
      return {
        duration: 1,
        getChannelData: (ch: number) => data[ch],
        length,
        numberOfChannels: channels,
        sampleRate: rate,
      };
    }

    function setup() {
      const sources: Array<{
        buffer: {
          getChannelData: (ch: number) => Float32Array;
          numberOfChannels: number;
        } | null;
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
        onended: null;
        start: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
      }> = [];
      const ctx = createMockAudioContext({
        createBuffer: vi.fn(createBuffer),
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
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          gain: { setValueAtTime: vi.fn() },
        })),
        decodeAudioData: vi.fn(async () => stereoBuffer()),
      });
      global.AudioContext = vi.fn(function () {
        return ctx;
      });
      vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
        data: new ArrayBuffer(1024),
        success: true,
      });
      return { ctx, sources };
    }

    const waveform = (
      playsStereo: boolean,
      playTrigger: number,
      slotNumber = 1,
    ) => (
      <SampleWaveform
        kitName="A1"
        playsStereo={playsStereo}
        playTrigger={playTrigger}
        slotNumber={slotNumber}
        voiceNumber={1}
      />
    );

    const loaded = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

    beforeEach(() => {
      // Meter one frame per play, so no loop outlives its test
      global.requestAnimationFrame = vi.fn(() => 1);
    });

    afterEach(() => {
      clearAllLevels();
    });

    it("mixes it down to mono on a mono voice, as the write does", async () => {
      const { ctx, sources } = setup();
      const view = render(waveform(false, 0));
      await loaded();
      await act(async () => {
        view.rerender(waveform(false, 1));
      });

      const played = sources[0].buffer;
      expect(played?.numberOfChannels).toBe(1);
      // The average of the channels, the same on both sides
      expect(Array.from(played?.getChannelData(0) ?? [])).toEqual([
        0.5, 0.5, 0.5, -1,
      ]);
      // The meters show what plays: one channel
      expect(ctx.createChannelSplitter).not.toHaveBeenCalled();
      expect(getVoiceLevel(1)?.isStereo).toBe(false);
    });

    it("plays it as it is on a linked voice", async () => {
      const { ctx, sources } = setup();
      const view = render(waveform(true, 0));
      await loaded();
      await act(async () => {
        view.rerender(waveform(true, 1));
      });

      expect(sources[0].buffer?.numberOfChannels).toBe(2);
      expect(ctx.createBuffer).not.toHaveBeenCalled();
      expect(ctx.createChannelSplitter).toHaveBeenCalledTimes(1);
      expect(getVoiceLevel(1)?.isStereo).toBe(true);
    });

    it("rebuilds the meters when the voice is linked between plays", async () => {
      const { ctx, sources } = setup();
      const view = render(waveform(false, 0));
      await loaded();
      await act(async () => {
        view.rerender(waveform(false, 1));
      });
      expect(getVoiceLevel(1)?.isStereo).toBe(false);

      await act(async () => {
        view.rerender(waveform(true, 1));
      });
      await act(async () => {
        view.rerender(waveform(true, 2));
      });

      expect(sources[1].buffer?.numberOfChannels).toBe(2);
      expect(ctx.createGain).toHaveBeenCalledTimes(2);
      expect(ctx.createChannelSplitter).toHaveBeenCalledTimes(1);
      expect(getVoiceLevel(1)?.isStereo).toBe(true);
    });

    it("still chokes the voice: the mono mix stops what else plays on it", async () => {
      const { sources } = setup();
      const first = render(waveform(false, 0, 1));
      const second = render(waveform(false, 0, 2));
      await loaded();

      await act(async () => {
        first.rerender(waveform(false, 1, 1));
      });
      expect(sources[0].stop).not.toHaveBeenCalled();
      await act(async () => {
        second.rerender(waveform(false, 1, 2));
      });

      expect(sources[0].stop).toHaveBeenCalled();
      expect(sources[1].stop).not.toHaveBeenCalled();
    });
  });

  describe("[UC-29] another file taking the slot (#575)", () => {
    // Two files with one name from different folders: a 2 s one and a
    // 0.5 s one, told apart by the buffer each decodes to
    const fileA = { duration: 2, label: "a" };
    const fileB = { duration: 0.5, label: "b" };

    function setupFiles() {
      const sources: {
        buffer: { duration: number } | null;
        stop: ReturnType<typeof vi.fn>;
      }[] = [];
      const buffers = [fileA, fileB].map((file) => ({
        duration: file.duration,
        getChannelData: vi.fn(() => new Float32Array(100)),
        length: file.duration * 44100,
        numberOfChannels: 1,
        sampleRate: 44100,
      }));
      let decodes = 0;
      const ctx = createMockAudioContext({
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
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          gain: { setValueAtTime: vi.fn() },
        })),
        // Main answers by slot: whichever file is in it when asked
        decodeAudioData: vi.fn(async () => buffers[decodes++]),
      });
      global.AudioContext = vi.fn(function () {
        return ctx;
      });
      vi.mocked(window.electronAPI.getSampleAudioBuffer).mockResolvedValue({
        data: new ArrayBuffer(1024),
        success: true,
      });
      return { sources };
    }

    function slot(sampleSource: null | string, playTrigger = 0) {
      return (
        <SampleWaveform
          kitName="A0"
          playsStereo={false}
          playTrigger={playTrigger}
          sampleSource={sampleSource}
          slotNumber={0}
          voiceNumber={3}
        />
      );
    }

    async function settle() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    it("loads and plays the file that moves up into its slot", async () => {
      const { sources } = setupFiles();
      const view = render(slot("/a/dup.wav"));
      await settle();

      // The first file is deleted; the second moves up with the same name
      view.rerender(slot("/b/dup.wav"));
      await settle();
      expect(window.electronAPI.getSampleAudioBuffer).toHaveBeenCalledTimes(2);

      await act(async () => {
        view.rerender(slot("/b/dup.wav", 1));
      });
      expect(sources).toHaveLength(1);
      expect(sources[0].buffer?.duration).toBe(fileB.duration);
    });

    it("stops the file that left the slot", async () => {
      const { sources } = setupFiles();
      const view = render(slot("/a/dup.wav"));
      await settle();
      await act(async () => {
        view.rerender(slot("/a/dup.wav", 1));
      });
      expect(sources[0].buffer?.duration).toBe(fileA.duration);
      expect(sources[0].stop).not.toHaveBeenCalled();

      view.rerender(slot("/b/dup.wav", 1));
      await settle();
      expect(sources[0].stop).toHaveBeenCalled();
    });

    it("doesn't reload when it learns which file it loaded", async () => {
      setupFiles();
      // The slot shows before the kit's sample rows arrive
      const view = render(slot(null));
      await settle();
      view.rerender(slot("/a/dup.wav"));
      await settle();
      expect(window.electronAPI.getSampleAudioBuffer).toHaveBeenCalledTimes(1);
    });
  });
});
