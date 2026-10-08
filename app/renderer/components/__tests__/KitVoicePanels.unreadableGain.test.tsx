import type { KitWithRelations, Sample } from "@romper/shared/db/schema";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { createMockSample } from "../../../../tests/factories/sample.factory";
import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { useKitEditorKeyboardNav } from "../hooks/kit-management/useKitEditorKeyboardNav";
import { useKitPlayback } from "../hooks/kit-management/useKitPlayback";
import KitVoicePanels from "../KitVoicePanels";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

// The one audio context every slot plays through, rebuilt for each test
let audio: ReturnType<typeof createAudio>;
vi.mock("../../utils/sharedAudioContext", () => ({
  getSharedAudioContext: () => audio.ctx,
}));

/** A stand-in audio context that records each sound started and its gain */
function createAudio() {
  const started: number[] = [];
  const gains: number[] = [];
  const buffer = {
    duration: 1,
    getChannelData: () => new Float32Array(100),
    length: 44100,
    numberOfChannels: 1,
    sampleRate: 44100,
  };
  const ctx = {
    createAnalyser: () => ({
      connect: vi.fn(),
      fftSize: 256,
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    }),
    createBufferSource: () => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
      start: () => started.push(started.length),
      stop: vi.fn(),
    }),
    createGain: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        setValueAtTime: (value: number) => gains.push(value),
      },
    }),
    currentTime: 0,
    decodeAudioData: vi.fn(async () => buffer),
    destination: {},
    state: "running",
  };
  return { ctx, gains, started };
}

// kick.wav in voice 1 slot 1, with its saved gain
const kickWithGain = (gainDb: number): Sample[] => [
  createMockSample({
    filename: "kick.wav",
    gain_db: gainDb,
    kit_name: "A0",
    source_path: "/store/A0/kick.wav",
  }),
];

/**
 * Kit A0 with its rows, or listed without them (#605); each call is a new
 * object, as a reload of the kit gives
 */
const kitA0 = (rows?: Sample[]) =>
  createMockKitWithRelations({ editable: true, name: "A0", samples: rows });

const samples = { 1: ["kick.wav"], 2: [], 3: [], 4: [] };
const noop = () => {};

/** The kit editor's panels, played through its playback state and Space */
function Editor({
  kit,
  onMessage,
}: {
  kit: KitWithRelations;
  onMessage: (text: string, type?: string) => void;
}) {
  const playback = useKitPlayback();
  useKitEditorKeyboardNav({
    isEditable: true,
    onInferVoiceNames: noop,
    onPlaySample: playback.handlePlay,
    onSampleKeyNav: noop,
    onScanKit: noop,
    samples,
    selectedSampleIdx: 0,
    selectedVoice: 1,
    sequencerOpen: false,
    setSequencerOpen: noop,
  });
  return (
    <MockSettingsProvider>
      <MockMessageDisplayProvider>
        <KitVoicePanels
          isEditable
          kit={kit}
          kitName="A0"
          onMessage={onMessage}
          onPlay={playback.handlePlay}
          onSampleSelect={noop}
          onSaveVoiceName={noop}
          onStop={playback.handleStop}
          onWaveformPlayingChange={playback.handleWaveformPlayingChange}
          samples={samples}
          selectedSampleIdx={0}
          selectedVoice={1}
          sequencerOpen={false}
          setSelectedSampleIdx={noop}
          setSelectedVoice={noop}
          slotPlayback={playback.slotPlayback}
        />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>
  );
}

const knob = () => screen.getByRole("slider");
const clickPlay = () =>
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
const pressSpace = () => fireEvent.keyDown(document.body, { key: " " });

/** Linear gain for a gain in dB, as the preview sets it */
const linear = (db: number) => Math.pow(10, db / 20);

// The gains come from the kit's rows (#452). A kit listed without them
// has no gains to play until reopening it loads them (#605).
describe("[UC-29] previewing a sample whose gain can't be read (#636)", () => {
  const onMessage = vi.fn();

  beforeEach(() => {
    audio = createAudio();
    setupElectronAPIMock();
    vi.mocked(globalThis.electronAPI.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.requestAnimationFrame = vi.fn(() => 0);
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    onMessage.mockReset();
  });

  /** Wait for the slot's audio to be decoded, so a trigger can play */
  const waitForAudio = () =>
    waitFor(() => expect(audio.ctx.decodeAudioData).toHaveBeenCalled());

  it("plays nothing on a click or Space for a kit listed without its rows", async () => {
    render(<Editor kit={kitA0()} onMessage={onMessage} />);
    await waitForAudio();

    await act(async () => {
      clickPlay();
    });
    await act(async () => {
      pressSpace();
    });

    expect(audio.started).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("[Q-01] plays the saved gain as soon as the kit opens with its rows", async () => {
    render(<Editor kit={kitA0(kickWithGain(-6))} onMessage={onMessage} />);
    await waitForAudio();

    await act(async () => {
      clickPlay();
    });

    expect(audio.started).toHaveLength(1);
    expect(audio.gains).toEqual([linear(-6)]);
    expect(globalThis.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
  });

  it("plays the saved gain once the kit's rows load", async () => {
    const { rerender } = render(<Editor kit={kitA0()} onMessage={onMessage} />);
    await waitForAudio();
    await act(async () => {
      clickPlay();
    });
    expect(audio.started).toHaveLength(0);

    rerender(<Editor kit={kitA0(kickWithGain(-6))} onMessage={onMessage} />);
    await waitFor(() => expect(knob()).toHaveAttribute("aria-valuenow", "-6"));

    // The click made before doesn't play now; a new one does
    expect(audio.started).toHaveLength(0);
    await act(async () => {
      pressSpace();
    });
    expect(audio.started).toHaveLength(1);
    expect(audio.gains).toEqual([linear(-6)]);
  });
});
