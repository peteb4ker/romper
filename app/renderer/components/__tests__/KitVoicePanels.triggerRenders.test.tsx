import { act, render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayOptions } from "../kitTypes";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { createMockSample } from "../../../../tests/factories/sample.factory";
import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { useKitPlayback } from "../hooks/kit-management/useKitPlayback";
import KitVoicePanels from "../KitVoicePanels";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

// Renders per slot ("voice:slot") of the waveform and the gain knob
const waveformRenders = new Map<string, number>();
let knobRenders = 0;
let editorRenders = 0;
// What each slot's waveform was last asked to do
const waveformProps = new Map<
  string,
  { playOptions?: PlayOptions; playTrigger: number; stopTrigger: number }
>();

vi.mock("../SampleWaveform", () => ({
  default: (props: {
    playOptions?: PlayOptions;
    playTrigger: number;
    slotNumber: number;
    stopTrigger: number;
    voiceNumber: number;
  }) => {
    const key = `${props.voiceNumber}:${props.slotNumber}`;
    waveformRenders.set(key, (waveformRenders.get(key) ?? 0) + 1);
    waveformProps.set(key, {
      playOptions: props.playOptions,
      playTrigger: props.playTrigger,
      stopTrigger: props.stopTrigger,
    });
    return <span data-testid={`waveform-${key}`} />;
  },
}));

vi.mock("../GainKnob", () => ({
  default: () => {
    knobRenders++;
    return <span />;
  },
}));

// A full kit: 12 samples in each of the 4 voices, 48 slots
const samples = Object.fromEntries(
  [1, 2, 3, 4].map((voice) => [
    voice,
    Array.from({ length: 12 }, (_, i) => `v${voice}-${i}.wav`),
  ]),
);
const kit = createMockKitWithRelations({
  editable: true,
  name: "A0",
  samples: Object.entries(samples).flatMap(([voice, names]) =>
    names.map((filename, slot) =>
      createMockSample({
        filename,
        kit_name: "A0",
        slot_number: slot,
        source_path: `/store/A0/${filename}`,
        voice_number: Number(voice),
      }),
    ),
  ),
});
const noop = () => {};

let playback: ReturnType<typeof useKitPlayback>;

/** The kit editor's panels, with its playback state */
function Editor() {
  const kitPlayback = useKitPlayback();
  // Runs after each render of the editor itself
  React.useEffect(() => {
    editorRenders++;
    playback = kitPlayback;
  });
  const { handlePlay, handleStop, handleWaveformPlayingChange, slotPlayback } =
    kitPlayback;
  return (
    <MockSettingsProvider>
      <MockMessageDisplayProvider>
        <KitVoicePanels
          isEditable
          kit={kit}
          kitName="A0"
          onPlay={handlePlay}
          onSampleSelect={noop}
          onSaveVoiceName={noop}
          onStop={handleStop}
          onWaveformPlayingChange={handleWaveformPlayingChange}
          samples={samples}
          selectedSampleIdx={0}
          selectedVoice={1}
          sequencerOpen={false}
          setSelectedSampleIdx={noop}
          setSelectedVoice={noop}
          slotPlayback={slotPlayback}
        />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>
  );
}

/** Slots whose waveform rendered since the counts were reset */
function renderedSlots(): string[] {
  return [...waveformRenders.keys()].sort((a, b) => a.localeCompare(b));
}

function resetCounts() {
  waveformRenders.clear();
  knobRenders = 0;
  editorRenders = 0;
}

describe("[Q-01] [UC-29] a trigger re-renders only the slots it plays or stops (#482)", () => {
  beforeEach(async () => {
    setupElectronAPIMock();
    waveformProps.clear();
    render(<Editor />);
    // Let the panels settle (their details come with the kit, #452)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(waveformRenders.size).toBe(48);
    resetCounts();
  });

  it("re-renders the one slot a trigger plays, not the editor or the other 47", async () => {
    await act(async () => {
      playback.handlePlay(2, 3);
    });

    expect(renderedSlots()).toEqual(["2:3"]);
    expect(waveformRenders.get("2:3")).toBe(1);
    expect(waveformProps.get("2:3")?.playTrigger).toBe(1);
    expect(knobRenders).toBe(1); // the played slot's own knob
    expect(editorRenders).toBe(0);
  });

  it("re-renders the slot its waveform reports playing, and no other", async () => {
    await act(async () => {
      playback.handleWaveformPlayingChange(2, 3, true);
    });

    expect(renderedSlots()).toEqual(["2:3"]);
    expect(editorRenders).toBe(0);
  });

  it("re-renders the slot a choke stops, with the stop time", async () => {
    await act(async () => {
      playback.handlePlay(1, 0, 100, { startAt: 1000 });
      playback.handleWaveformPlayingChange(1, 0, true);
    });
    resetCounts();

    await act(async () => {
      playback.handlePlay(1, 1, 100, { startAt: 1125 });
    });

    expect(renderedSlots()).toEqual(["1:0", "1:1"]);
    expect(waveformProps.get("1:0")).toMatchObject({
      playOptions: { startAt: 1000, stopAt: 1125 },
      stopTrigger: 1,
    });
    expect(waveformProps.get("1:1")).toMatchObject({
      playOptions: { startAt: 1125 },
      playTrigger: 1,
    });
    expect(editorRenders).toBe(0);
  });

  it("re-renders each slot once for a sequencer step that plays all four voices", async () => {
    await act(async () => {
      for (const voice of [1, 2, 3, 4]) {
        playback.handlePlay(voice, 0, 100, { startAt: 1000 });
      }
    });

    expect(renderedSlots()).toEqual(["1:0", "2:0", "3:0", "4:0"]);
    for (const key of renderedSlots()) {
      expect(waveformRenders.get(key)).toBe(1);
    }
    expect(editorRenders).toBe(0);
  });

  it("re-renders nothing when a slot reports what it already showed", async () => {
    await act(async () => {
      playback.handleWaveformPlayingChange(3, 5, false);
    });

    expect(renderedSlots()).toEqual([]);
  });
});
