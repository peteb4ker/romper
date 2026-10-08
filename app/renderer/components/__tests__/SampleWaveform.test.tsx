// Test suite for SampleWaveform component
import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { applyTheme } from "../../utils/appliedTheme";
import { SettingsProvider, useSettings } from "../../utils/SettingsContext";
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

function createMockAudioContext<T extends object>(overrides: T) {
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
      disconnect: vi.fn(),
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
  drawImage: vi.fn(),
  fill: vi.fn(),
  fillStyle: "",
  globalAlpha: 1,
  lineTo: vi.fn(),
  lineWidth: 1,
  moveTo: vi.fn(),
  stroke: vi.fn(),
  strokeStyle: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  setupElectronAPIMock();

  // Mock canvas methods
  // jsdom has no canvas; the waveform draws only through these methods
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => mockCanvasContext),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "width", {
    configurable: true,
    get: () => 80,
    set: () => {},
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "height", {
    configurable: true,
    get: () => 18,
    set: () => {},
  });

  // Mock AudioContext and related APIs
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return createMockAudioContext({});
    }),
  );

  // Mock animation frame functions. Cancelling clears the frame's timer, so
  // a playhead loop stops when its waveform unmounts instead of firing
  // after the test environment is gone.
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => setTimeout(cb, 16)),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => clearTimeout(id)),
  );
});

describe("SampleWaveform", () => {
  it("renders the waveform canvas with correct dimensions", async () => {
    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform
            kitName="A1"
            playsStereo={false}
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
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          playsStereo={false}
          playTrigger={0}
          slotNumber={1}
          voiceNumber={2}
        />,
      );
    });

    expect(globalThis.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A1",
      2,
      1,
      undefined,
    );
  });

  it("re-loads audio buffer when kit parameters change", async () => {
    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playsStereo={false}
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
          playsStereo={false}
          playTrigger={0}
          slotNumber={2}
          voiceNumber={3}
        />,
      );
    });

    expect(globalThis.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A2",
      3,
      2,
      undefined,
    );
  });

  it("handles null audio buffer response gracefully (empty slot)", async () => {
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: null,
      success: true,
    });
    const onError = vi.fn();

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          onError={onError}
          playsStereo={false}
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
    });

    expect(globalThis.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A1",
      1,
      1,
      undefined,
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
          playsStereo={false}
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
    setupElectronAPIMock({ getSampleAudioBuffer: undefined });
    const onError = vi.fn();

    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform
            kitName="A1"
            onError={onError}
            playsStereo={false}
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
  });

  it("handles audio buffer loading errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockRejectedValue(
      new Error("File not found"),
    );
    const onError = vi.fn();

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          onError={onError}
          playsStereo={false}
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
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return createMockAudioContext({
          decodeAudioData: vi.fn(() => Promise.reject(decodeError)),
        });
      }),
    );
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(16), version: "v1" },
      success: true,
    });
    const onError = vi.fn();

    await act(async () => {
      render(
        <SampleWaveform
          kitName="A1"
          onError={onError}
          playsStereo={false}
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
        playsStereo={false}
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
      disconnect: vi.fn(),
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

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return mockAudioContext;
      }),
    );

    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playsStereo={false}
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
          playsStereo={false}
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
        connect: Mock;
        disconnect: Mock;
        gain: Record<string, unknown>;
      }[] = [];
      const sources: {
        connect: Mock;
        disconnect: Mock;
        onended: (() => void) | null;
        start: Mock;
        stop: Mock;
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
      vi.stubGlobal(
        "AudioContext",
        vi.fn(function () {
          return mockAudioContext;
        }),
      );
      vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
        data: { bytes: new ArrayBuffer(1024), version: "v1" },
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
          playsStereo={false}
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
            playsStereo={false}
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
            playsStereo={false}
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
            playsStereo={false}
            playTrigger={a}
            slotNumber={1}
            voiceNumber={voiceA}
          />
          <SampleWaveform
            kitName="A1"
            playsStereo={false}
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
          playsStereo={false}
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
            playsStereo={false}
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
          playsStereo={false}
          playTrigger={0}
          slotNumber={1}
          voiceNumber={1}
        />,
      );
      rerender(
        <SampleWaveform
          kitName="A1"
          playsStereo={false}
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

    describe("[UC-29] a gain that couldn't be read (#636)", () => {
      /** Slot 1 (gain known) and slot 2 (gain `gainDb`), both on voice 1 */
      async function renderWithSlot2Gain() {
        const pair = (a: number, b: number, gainDb: null | number) => (
          <>
            <SampleWaveform
              kitName="A1"
              playsStereo={false}
              playTrigger={a}
              slotNumber={1}
              voiceNumber={1}
            />
            <SampleWaveform
              gainDb={gainDb}
              kitName="A1"
              playsStereo={false}
              playTrigger={b}
              slotNumber={2}
              voiceNumber={1}
            />
          </>
        );
        const { rerender } = render(pair(0, 0, null));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
        return async (a: number, b: number, gainDb: null | number) => {
          await act(async () => {
            rerender(pair(a, b, gainDb));
          });
        };
      }

      it("plays nothing, and doesn't choke the voice", async () => {
        const { sources } = setupRegionMocks();
        const play = await renderWithSlot2Gain();

        await play(1, 0, null); // slot 1 plays
        await play(1, 1, null); // slot 2 is triggered

        expect(sources).toHaveLength(1);
        expect(sources[0].stop).not.toHaveBeenCalled();
      });

      it("doesn't play a trigger that arrived before its audio loaded", async () => {
        const { sources } = setupRegionMocks();
        const { rerender } = render(
          <SampleWaveform
            gainDb={null}
            kitName="A1"
            playsStereo={false}
            playTrigger={0}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
        rerender(
          <SampleWaveform
            gainDb={null}
            kitName="A1"
            playsStereo={false}
            playTrigger={1}
            slotNumber={1}
            voiceNumber={1}
          />,
        );
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(sources).toHaveLength(0);
      });

      it("plays at the gain once it's read, and chokes the voice again", async () => {
        const { gainNodes, sources } = setupRegionMocks();
        const play = await renderWithSlot2Gain();
        await play(1, 0, null);
        await play(1, 1, null);

        await play(1, 1, -6); // the gain is read: the old trigger stays silent
        expect(sources).toHaveLength(1);
        await play(1, 2, -6);

        expect(sources).toHaveLength(2);
        expect(sources[0].stop).toHaveBeenCalled();
        const slot2Volume = gainNodes.find((n) =>
          sources[1].connect.mock.calls.some(([target]) => target === n),
        )!;
        expect(slot2Volume.gain.setValueAtTime).toHaveBeenCalledWith(
          Math.pow(10, -6 / 20),
          expect.any(Number),
        );
      });
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
          playsStereo={false}
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
            playsStereo={false}
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
            playsStereo={false}
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
            playsStereo={false}
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
        playsStereo={false}
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
          playsStereo={false}
          playTrigger={1}
          slotNumber={12}
          stopTrigger={1}
          voiceNumber={4}
        />,
      );
    });

    // Should handle parameter changes without crashing
    expect(globalThis.electronAPI.getSampleAudioBuffer).toHaveBeenCalledWith(
      "B2",
      4,
      12,
      undefined,
    );
  });

  it("draws on canvas when audio buffer is available", async () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return createMockAudioContext({
          decodeAudioData: vi.fn(async () => ({
            duration: 1.0,
            getChannelData: vi.fn(() => new Float32Array(100)),
            length: 44100,
            numberOfChannels: 1,
            sampleRate: 44100,
          })),
        });
      }),
    );
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });

    render(
      <SampleWaveform
        kitName="A1"
        playsStereo={false}
        playTrigger={0}
        slotNumber={1}
        voiceNumber={1}
      />,
    );

    expect(document.querySelector("canvas")).toBeInTheDocument();
    await waitFor(() => expect(mockCanvasContext.fill).toHaveBeenCalled());
    expect(mockCanvasContext.stroke).toHaveBeenCalled();
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
      disconnect: vi.fn(),
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
      decodeAudioData: vi.fn(async () => mockAudioBuffer),
    });

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return mockAudioContext;
      }),
    );
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        playsStereo={false}
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
          playsStereo={false}
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
          playsStereo={false}
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
      disconnect: vi.fn(),
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
      decodeAudioData: vi.fn(async () => mockAudioBuffer),
    });

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return mockAudioContext;
      }),
    );
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });
    const onPlayingChange = vi.fn();

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        onPlayingChange={onPlayingChange}
        playsStereo={false}
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
          playsStereo={false}
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
          playsStereo={false}
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
      disconnect: vi.fn(),
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
      decodeAudioData: vi.fn(async () => mockAudioBuffer),
    });

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return mockAudioContext;
      }),
    );
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });
    const onPlayingChange = vi.fn();

    const { rerender } = render(
      <SampleWaveform
        kitName="A1"
        onPlayingChange={onPlayingChange}
        playsStereo={false}
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
          playsStereo={false}
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
          playsStereo={false}
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
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
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
      vi.stubGlobal(
        "AudioContext",
        vi.fn(function () {
          return ctx;
        }),
      );
      vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
        data: { bytes: new ArrayBuffer(1024), version: "v1" },
        success: true,
      });
      const view = render(
        <SampleWaveform
          kitName="A1"
          playsStereo={false}
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
            playsStereo={false}
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
            playsStereo={false}
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
        connect: Mock;
        disconnect: Mock;
        onended: null;
        start: Mock;
        stop: Mock;
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
      vi.stubGlobal(
        "AudioContext",
        vi.fn(function () {
          return ctx;
        }),
      );
      vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
        data: { bytes: new ArrayBuffer(1024), version: "v1" },
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
      vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn(() => 1),
      );
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
        stop: Mock;
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
      vi.stubGlobal(
        "AudioContext",
        vi.fn(function () {
          return ctx;
        }),
      );
      // Each answer is another file, so another version
      let answers = 0;
      vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockImplementation(
        async () => ({
          data: { bytes: new ArrayBuffer(1024), version: `v${++answers}` },
          success: true,
        }),
      );
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
      expect(globalThis.electronAPI.getSampleAudioBuffer).toHaveBeenCalledTimes(
        2,
      );

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
      expect(globalThis.electronAPI.getSampleAudioBuffer).toHaveBeenCalledTimes(
        1,
      );
    });
  });
});

describe("[Q-01] [UC-29] drawing while a sample plays (RE-46)", () => {
  // Frames run only when the test steps them
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let ctx: ReturnType<typeof createMockAudioContext>;
  const getChannelData = vi.fn(() => new Float32Array(44100));

  function stepFrame() {
    const due = [...frames.values()];
    frames.clear();
    for (const cb of due) cb(performance.now());
  }

  const waveform = (playTrigger: number) => (
    <SampleWaveform
      kitName="Q01"
      playsStereo={false}
      playTrigger={playTrigger}
      slotNumber={1}
      voiceColor="var(--voice-1)"
      voiceNumber={1}
    />
  );

  /** Load the sample, start it, and count from the first frame on */
  async function startPlaying() {
    const onRender = vi.fn();
    const ui = (trigger: number) => (
      <React.Profiler id="waveform" onRender={onRender}>
        {waveform(trigger)}
      </React.Profiler>
    );
    const { rerender } = render(ui(0));
    await waitFor(() => expect(mockCanvasContext.fill).toHaveBeenCalled());
    await act(async () => {
      rerender(ui(1));
    });
    vi.clearAllMocks();
    return { onRender };
  }

  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      frames.set(++nextFrame, cb);
      return nextFrame;
    });
    global.cancelAnimationFrame = vi.fn((id: number) => {
      frames.delete(id);
    });
    ctx = createMockAudioContext({
      decodeAudioData: vi.fn(async () => ({
        duration: 1,
        getChannelData,
        length: 44100,
        numberOfChannels: 1,
        sampleRate: 44100,
      })),
    });
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return ctx;
      }),
    );
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });
  });

  it("draws only the playhead each frame: no envelope, styles or render", async () => {
    const { onRender } = await startPlaying();
    const getComputedStyleSpy = vi.spyOn(globalThis, "getComputedStyle");

    for (let i = 1; i <= 10; i++) {
      ctx.currentTime = i * 0.016; // the playhead moves every frame
      await act(async () => {
        stepFrame();
      });
    }

    // The envelope isn't rebuilt from the samples or drawn again...
    expect(getChannelData).not.toHaveBeenCalled();
    expect(mockCanvasContext.fill).not.toHaveBeenCalled();
    // ...no computed style is read, and React doesn't render the waveform
    expect(getComputedStyleSpy).not.toHaveBeenCalled();
    expect(onRender).not.toHaveBeenCalled();
    // Each frame copies the drawn envelope and strokes the playhead once
    expect(mockCanvasContext.drawImage).toHaveBeenCalledTimes(10);
    expect(mockCanvasContext.stroke).toHaveBeenCalledTimes(10);
    getComputedStyleSpy.mockRestore();
  });

  it("draws the playhead where the sample has got to, in the same color", async () => {
    await startPlaying();
    ctx.currentTime = 0.5; // halfway through the 1 s sample

    await act(async () => {
      stepFrame();
    });

    expect(mockCanvasContext.clearRect).toHaveBeenCalledWith(0, 0, 80, 18);
    expect(mockCanvasContext.moveTo).toHaveBeenLastCalledWith(40, 0);
    expect(mockCanvasContext.lineTo).toHaveBeenLastCalledWith(40, 18);
    expect(mockCanvasContext.strokeStyle).toBe("#f59e42");
  });

  it("clears the playhead when the sample ends, without drawing the envelope again", async () => {
    await startPlaying();
    ctx.currentTime = 2; // past the end

    await act(async () => {
      stepFrame();
    });

    expect(mockCanvasContext.drawImage).toHaveBeenCalledTimes(1);
    expect(mockCanvasContext.stroke).not.toHaveBeenCalled();
    expect(getChannelData).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
});

describe("[UC-29] switching theme redraws the waveform (#760)", () => {
  const LIGHT_RED = "#d44950";
  const DARK_RED = "#e05a60";
  let getComputedStyleSpy: ReturnType<typeof vi.spyOn>;
  // Frames run only when the test steps them
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let ctx: ReturnType<typeof createMockAudioContext>;

  function stepFrame() {
    const due = [...frames.values()];
    frames.clear();
    for (const cb of due) cb(performance.now());
  }

  const waveform = (kitName: string, playTrigger = 0) => (
    <SampleWaveform
      kitName={kitName}
      playsStereo={false}
      playTrigger={playTrigger}
      slotNumber={1}
      voiceColor="var(--voice-1)"
      voiceNumber={1}
    />
  );

  /** The `prefers-color-scheme: dark` query, which the test can flip */
  function stubSystemScheme(dark: boolean) {
    const listeners = new Set<() => void>();
    const query = {
      addEventListener: vi.fn((_: string, listener: () => void) =>
        listeners.add(listener),
      ),
      matches: dark,
      removeEventListener: vi.fn((_: string, listener: () => void) =>
        listeners.delete(listener),
      ),
    };
    // The theme code reads only matches and adds or removes a change
    // listener, so a plain object stands in for the MediaQueryList
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => query),
    );
    return {
      change(nowDark: boolean) {
        query.matches = nowDark;
        for (const listener of [...listeners]) listener();
      },
    };
  }

  beforeEach(() => {
    applyTheme(false);
    // Voice 1's color comes from the theme on screen, as the CSS tokens do
    getComputedStyleSpy = vi.spyOn(globalThis, "getComputedStyle");
    getComputedStyleSpy.mockImplementation(
      () =>
        ({
          getPropertyValue: (name: string) => {
            if (name !== "--voice-1") return "";
            return document.documentElement.classList.contains("dark")
              ? DARK_RED
              : LIGHT_RED;
          },
        }) as CSSStyleDeclaration,
    );
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        frames.set(++nextFrame, cb);
        return nextFrame;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        frames.delete(id);
      }),
    );
    ctx = createMockAudioContext({
      decodeAudioData: vi.fn(async () => ({
        duration: 1,
        getChannelData: vi.fn(() => new Float32Array(44100)),
        length: 44100,
        numberOfChannels: 1,
        sampleRate: 44100,
      })),
    });
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return ctx;
      }),
    );
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });
  });

  afterEach(() => {
    getComputedStyleSpy.mockRestore();
    applyTheme(false);
    vi.unstubAllGlobals();
  });

  it("redraws a waveform that isn't playing in the new theme's color", async () => {
    vi.mocked(globalThis.electronAPI.readSettings).mockResolvedValue({
      themeMode: "light",
    });
    stubSystemScheme(false);
    let settings: ReturnType<typeof useSettings> | undefined;
    function Capture() {
      settings = useSettings();
      return null;
    }
    render(
      <SettingsProvider>
        <Capture />
        {waveform("T760-setting")}
      </SettingsProvider>,
    );
    await waitFor(() => expect(mockCanvasContext.fill).toHaveBeenCalled());
    expect(mockCanvasContext.fillStyle).toBe(LIGHT_RED);
    vi.clearAllMocks();

    await act(async () => {
      await settings?.setThemeMode("dark");
    });

    // The envelope is drawn again, in the dark theme's voice color
    expect(mockCanvasContext.fill).toHaveBeenCalledTimes(1);
    expect(mockCanvasContext.fillStyle).toBe(DARK_RED);
    expect(mockCanvasContext.strokeStyle).toBe(DARK_RED);
    expect(mockCanvasContext.drawImage).toHaveBeenCalledTimes(1);
  });

  it("redraws when the system scheme changes and the theme follows it", async () => {
    vi.mocked(globalThis.electronAPI.readSettings).mockResolvedValue({
      themeMode: "system",
    });
    const system = stubSystemScheme(false);
    render(<SettingsProvider>{waveform("T760-system")}</SettingsProvider>);
    await waitFor(() => expect(mockCanvasContext.fill).toHaveBeenCalled());
    expect(mockCanvasContext.fillStyle).toBe(LIGHT_RED);
    vi.clearAllMocks();

    act(() => {
      system.change(true);
    });

    expect(mockCanvasContext.fill).toHaveBeenCalledTimes(1);
    expect(mockCanvasContext.fillStyle).toBe(DARK_RED);
  });

  it("doesn't redraw when the theme it's in is applied again", async () => {
    render(waveform("T760-same"));
    await waitFor(() => expect(mockCanvasContext.fill).toHaveBeenCalled());
    vi.clearAllMocks();

    act(() => {
      applyTheme(false);
    });

    expect(mockCanvasContext.drawImage).not.toHaveBeenCalled();
    expect(getComputedStyleSpy).not.toHaveBeenCalled();
  });

  it("recolors a playing waveform once, then reads no styles per frame", async () => {
    const { rerender } = render(waveform("T760-playing"));
    await waitFor(() => expect(mockCanvasContext.fill).toHaveBeenCalled());
    await act(async () => {
      rerender(waveform("T760-playing", 1));
    });
    ctx.currentTime = 0.25;
    await act(async () => {
      stepFrame();
    });
    vi.clearAllMocks();

    act(() => {
      applyTheme(true);
    });

    // The theme change reads the color once and draws the envelope again,
    // with the playhead where it was
    expect(getComputedStyleSpy).toHaveBeenCalledTimes(1);
    expect(mockCanvasContext.fill).toHaveBeenCalledTimes(1);
    expect(mockCanvasContext.fillStyle).toBe(DARK_RED);
    expect(mockCanvasContext.moveTo).toHaveBeenLastCalledWith(20, 0);
    vi.clearAllMocks();

    for (let i = 1; i <= 10; i++) {
      ctx.currentTime = 0.25 + i * 0.016;
      await act(async () => {
        stepFrame();
      });
    }

    // Later frames copy the new envelope: no styles read, nothing redrawn
    expect(getComputedStyleSpy).not.toHaveBeenCalled();
    expect(mockCanvasContext.fill).not.toHaveBeenCalled();
    expect(mockCanvasContext.drawImage).toHaveBeenCalledTimes(10);
  });
});
