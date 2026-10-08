import type {
  DbResult,
  KitWithRelations,
  Sample,
} from "@romper/shared/db/schema";

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

const failedA0 = "Couldn't load the samples for kit A0. Try reopening it.";

// kick.wav in voice 1 slot 1, with its saved gain
const kickWithGain = (gainDb: number): DbResult<Sample[]> => ({
  data: [
    createMockSample({
      filename: "kick.wav",
      gain_db: gainDb,
      kit_name: "A0",
      source_path: "/store/A0/kick.wav",
    }),
  ],
  success: true,
});

/** Kit A0; each call is a new object, as a reload of the kit gives */
const kitA0 = () => createMockKitWithRelations({ editable: true, name: "A0" });

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

describe("[UC-29] previewing a sample whose gain can't be read (#636)", () => {
  const onMessage = vi.fn();
  const getAllSamplesForKit = () =>
    vi.mocked(globalThis.electronAPI.getAllSamplesForKit);

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

  const failRead = () =>
    getAllSamplesForKit().mockResolvedValue({
      error: "database is locked",
      success: false,
    });

  it("plays nothing on a click or Space once the read has failed", async () => {
    failRead();
    render(<Editor kit={kitA0()} onMessage={onMessage} />);
    await waitFor(() =>
      expect(onMessage).toHaveBeenCalledWith(failedA0, "error"),
    );
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

  it("plays at 0 dB while the kit's details are being read", async () => {
    getAllSamplesForKit().mockReturnValue(new Promise(() => {}));
    render(<Editor kit={kitA0()} onMessage={onMessage} />);
    await waitForAudio();

    await act(async () => {
      clickPlay();
    });

    expect(audio.started).toHaveLength(1);
    expect(audio.gains).toEqual([linear(0)]);
  });

  it("plays the saved gain once a reload reads the details", async () => {
    failRead();
    const { rerender } = render(<Editor kit={kitA0()} onMessage={onMessage} />);
    await waitFor(() =>
      expect(onMessage).toHaveBeenCalledWith(failedA0, "error"),
    );
    await waitForAudio();
    await act(async () => {
      clickPlay();
    });
    expect(audio.started).toHaveLength(0);

    getAllSamplesForKit().mockResolvedValue(kickWithGain(-6));
    rerender(<Editor kit={kitA0()} onMessage={onMessage} />);
    await waitFor(() => expect(knob()).toHaveAttribute("aria-valuenow", "-6"));

    // The click made while it failed doesn't play now; a new one does
    expect(audio.started).toHaveLength(0);
    await act(async () => {
      pressSpace();
    });
    expect(audio.started).toHaveLength(1);
    expect(audio.gains).toEqual([linear(-6)]);
  });
});
