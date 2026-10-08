import type { Sample } from "@romper/shared/db/schema";

import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { createMockSample } from "../../../../tests/factories/sample.factory";
import { createMockVoice } from "../../../../tests/factories/voice.factory";
import { createSlotPlaybackStore } from "../hooks/kit-management/slotPlaybackStore";
import KitVoicePanels from "../KitVoicePanels";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

// Stand in for the waveform, showing what the panels ask it to play
vi.mock("../SampleWaveform", () => ({
  default: ({
    playsStereo,
    slotNumber,
    voiceNumber,
  }: {
    playsStereo: boolean;
    slotNumber: number;
    voiceNumber: number;
  }) => (
    <span
      data-plays-stereo={String(playsStereo)}
      data-testid={`waveform-${voiceNumber}-${slotNumber}`}
    />
  ),
}));

interface VoiceSpec {
  samples: string[];
  stereo_choice?: "mono" | "stereo" | null;
  stereo_mode?: boolean;
  voice: number;
}

/** The kit's rows, as main stores them */
let kitRows: Sample[] = [];

function renderPanels(voices: VoiceSpec[]) {
  const samples: Record<number, string[]> = {};
  for (const v of voices) samples[v.voice] = v.samples;
  const kit = createMockKitWithRelations({
    alias: "Kit1",
    name: "Kit1",
    samples: kitRows,
    voices: voices.map((v) =>
      createMockVoice({
        id: v.voice,
        kit_name: "Kit1",
        stereo_choice: v.stereo_choice ?? null,
        stereo_mode: v.stereo_mode ?? false,
        voice_alias: null,
        voice_number: v.voice,
      }),
    ),
  });
  return render(
    <MockSettingsProvider>
      <MockMessageDisplayProvider>
        <KitVoicePanels
          isEditable
          kit={kit}
          kitName="Kit1"
          onPlay={vi.fn()}
          onSampleSelect={vi.fn()}
          onSaveVoiceName={vi.fn()}
          onStop={vi.fn()}
          onWaveformPlayingChange={vi.fn()}
          samples={samples}
          selectedSampleIdx={0}
          selectedVoice={1}
          sequencerOpen={false}
          setSelectedSampleIdx={vi.fn()}
          setSelectedVoice={vi.fn()}
          slotPlayback={createSlotPlaybackStore()}
        />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>,
  );
}

/** The kit's samples as main stores them, with each file's channel count */
function storedSamples(rows: Array<[number, string, number]>) {
  kitRows = rows.map(([voice, filename, channels]) =>
    createMockSample({
      filename,
      gain_db: 0,
      kit_name: "Kit1",
      slot_number: 0,
      source_path: `/src/${filename}`,
      voice_number: voice,
      wav_channels: channels,
    }),
  );
}

const playsStereo = (voice: number) =>
  screen.getByTestId(`waveform-${voice}-0`).getAttribute("data-plays-stereo");

describe("[UC-29] [UC-28] previewing a sample plays what the card gets (#569)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plays a stereo sample on a mono voice as mono", async () => {
    // Keep mono was chosen, so the write mixes it down
    storedSamples([
      [1, "pad.wav", 2],
      [2, "kick.wav", 1],
    ]);
    renderPanels([
      { samples: ["pad.wav"], stereo_choice: "mono", voice: 1 },
      { samples: ["kick.wav"], voice: 2 },
      { samples: [], voice: 3 },
      { samples: [], voice: 4 },
    ]);

    await waitFor(() => expect(playsStereo(1)).toBe("false"));
    expect(playsStereo(2)).toBe("false");
  });

  it("plays a sample on a linked voice in stereo", async () => {
    storedSamples([[1, "pad.wav", 2]]);
    renderPanels([
      { samples: ["pad.wav"], stereo_mode: true, voice: 1 },
      { samples: [], voice: 2 },
      { samples: [], voice: 3 },
      { samples: [], voice: 4 },
    ]);

    await waitFor(() => expect(playsStereo(1)).toBe("true"));
  });

  it("plays a stereo sample in stereo when the write will link its voice", async () => {
    // Voice 3 isn't linked yet, but rule 2 links it at write (#537)
    storedSamples([[3, "pad.wav", 2]]);
    renderPanels([
      { samples: [], voice: 1 },
      { samples: [], voice: 2 },
      { samples: ["pad.wav"], voice: 3 },
      { samples: [], voice: 4 },
    ]);

    await waitFor(() => expect(playsStereo(3)).toBe("true"));
  });
});
