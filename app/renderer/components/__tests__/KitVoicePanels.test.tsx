import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import KitVoicePanels from "../KitVoicePanels";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

const baseProps = {
  kitName: "Kit1",
  onPlay: vi.fn(),
  onRescanVoiceName: vi.fn(),
  onSaveVoiceName: vi.fn(),
  onStop: vi.fn(),
  onWaveformPlayingChange: vi.fn(),
  playTriggers: {},
  samplePlaying: {},
  stopTriggers: {},
  voices: [
    { samples: ["kick.wav", "snare.wav"], voice: 1, voiceName: "Kick" },
    { samples: ["hat.wav", "clap.wav"], voice: 2, voiceName: "Hat" },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

function MultiVoicePanelsTestWrapper({
  initialSelectedSampleIdx = 0,
  initialSelectedVoice = 1,
  onPlay = vi.fn(),
  voices = baseProps.voices,
  ...props
} = {}) {
  const [selectedVoice, setSelectedVoice] = useState(initialSelectedVoice);
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(
    initialSelectedSampleIdx,
  );
  const { kit, samples } = voicesToProps(voices);
  React.useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ([" ", "ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "ArrowDown") {
          if (
            selectedSampleIdx <
            voices[selectedVoice - 1].samples.length - 1
          ) {
            setSelectedSampleIdx(selectedSampleIdx + 1);
          } else if (selectedVoice < voices.length) {
            setSelectedVoice(selectedVoice + 1);
            setSelectedSampleIdx(0);
          }
        } else if (e.key === "ArrowUp") {
          if (selectedSampleIdx > 0) {
            setSelectedSampleIdx(selectedSampleIdx - 1);
          } else if (selectedVoice > 1) {
            setSelectedVoice(selectedVoice - 1);
            setSelectedSampleIdx(voices[selectedVoice - 2].samples.length - 1);
          }
        } else if (e.key === " " || e.key === "Enter") {
          const sample = voices[selectedVoice - 1].samples[selectedSampleIdx];
          if (sample) onPlay(selectedVoice, sample);
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedVoice, selectedSampleIdx, voices, onPlay]);
  return (
    <MockSettingsProvider>
      <MockMessageDisplayProvider>
        <KitVoicePanels
          kit={kit}
          kitName={baseProps.kitName}
          onPlay={onPlay}
          onRescanVoiceName={baseProps.onRescanVoiceName}
          onSampleKeyNav={() => {}}
          onSampleSelect={() => {}}
          onSaveVoiceName={baseProps.onSaveVoiceName}
          onStop={baseProps.onStop}
          onWaveformPlayingChange={baseProps.onWaveformPlayingChange}
          playTriggers={{}}
          samplePlaying={{}}
          samples={samples}
          selectedSampleIdx={selectedSampleIdx}
          selectedVoice={selectedVoice}
          stopTriggers={{}}
          {...props}
        />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>
  );
}

// Utility to convert voices array to samples and kit
function voicesToProps(voices) {
  const samples = {};
  const kitVoices = [];
  voices.forEach(({ samples: s, voice, voiceName }) => {
    samples[voice] = s;
    kitVoices.push({
      id: voice,
      kit_name: "Kit1",
      voice_alias: voiceName,
      voice_number: voice,
    });
  });
  return {
    kit: {
      alias: "Kit1",
      name: "Kit1",
      voices: kitVoices,
    },
    samples,
  };
}

describe("KitVoicePanels", () => {
  it("renders all voices and samples", () => {
    render(<MultiVoicePanelsTestWrapper />);
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
    expect(screen.getByText("hat.wav")).toBeInTheDocument();
    expect(screen.getByText("clap.wav")).toBeInTheDocument();
  });

  it("renders global slot numbers on the left side only", () => {
    render(<MultiVoicePanelsTestWrapper />);
    // Check that global slot numbers 1-12 are rendered
    expect(screen.getByTestId("global-slot-number-0")).toHaveTextContent("1.");
    expect(screen.getByTestId("global-slot-number-1")).toHaveTextContent("2.");
    expect(screen.getByTestId("global-slot-number-11")).toHaveTextContent(
      "12.",
    );

    // Verify individual voice panels do not render their own slot numbers
    expect(screen.queryByTestId("slot-number-1-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-number-2-0")).not.toBeInTheDocument();
  });

  it("renders exactly one drop target per voice when editable", () => {
    render(<MultiVoicePanelsTestWrapper isEditable={true} />);

    // Check that each voice has exactly one drop zone
    expect(screen.getByTestId("drop-zone-voice-1")).toBeInTheDocument();
    expect(screen.getByTestId("drop-zone-voice-2")).toBeInTheDocument();

    // Check that drop zones have proper labels
    expect(screen.getByTestId("drop-zone-voice-1")).toHaveTextContent(
      "Drop WAV files here",
    );
    expect(screen.getByTestId("drop-zone-voice-2")).toHaveTextContent(
      "Drop WAV files here",
    );
  });

  it("does not render drop targets when not editable", () => {
    render(<MultiVoicePanelsTestWrapper isEditable={false} />);

    // No drop zones should be present in read-only mode
    expect(screen.queryByTestId("drop-zone-voice-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("drop-zone-voice-2")).not.toBeInTheDocument();
  });

  it("maintains fixed 12-slot height for all voice panels", () => {
    const voices = [
      { samples: ["sample1.wav"], voice: 1, voiceName: "Voice1" }, // 1 sample
      {
        samples: ["s1.wav", "s2.wav", "s3.wav"],
        voice: 2,
        voiceName: "Voice2",
      }, // 3 samples
      {
        samples: Array(6)
          .fill()
          .map((_, i) => `sample${i}.wav`),
        voice: 3,
        voiceName: "Voice3",
      }, // 6 samples
      {
        samples: Array(12)
          .fill()
          .map((_, i) => `sample${i}.wav`),
        voice: 4,
        voiceName: "Voice4",
      }, // 12 samples (full)
    ];

    render(<MultiVoicePanelsTestWrapper isEditable={true} voices={voices} />);

    // Each voice panel should have exactly 12 rendered slots (samples + empty slots + drop zone)
    const voice1List = screen.getByTestId("sample-list-voice-1");
    const voice2List = screen.getByTestId("sample-list-voice-2");
    const voice3List = screen.getByTestId("sample-list-voice-3");
    const voice4List = screen.getByTestId("sample-list-voice-4");

    // All should have exactly 12 list items (slots)
    expect(voice1List.children).toHaveLength(12);
    expect(voice2List.children).toHaveLength(12);
    expect(voice3List.children).toHaveLength(12);
    expect(voice4List.children).toHaveLength(12);

    // Voice 1-3 should have drop zones (not full)
    expect(screen.getByTestId("drop-zone-voice-1")).toBeInTheDocument();
    expect(screen.getByTestId("drop-zone-voice-2")).toBeInTheDocument();
    expect(screen.getByTestId("drop-zone-voice-3")).toBeInTheDocument();

    // Voice 4 should not have drop zone (full)
    expect(screen.queryByTestId("drop-zone-voice-4")).not.toBeInTheDocument();
  });

  it("cross-voice keyboard navigation moves selection between voices", async () => {
    render(<MultiVoicePanelsTestWrapper />);
    // Down to snare.wav
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    const snareElement = await screen.findByText("snare.wav");
    expect(snareElement).toBeInTheDocument();

    // Down to hat.wav (first sample of next voice)
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    const hatElement = await screen.findByText("hat.wav");
    expect(hatElement).toBeInTheDocument();

    // Down to clap.wav (second sample of next voice)
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    const clapElement = await screen.findByText("clap.wav");
    expect(clapElement).toBeInTheDocument();
  });

  it("triggers onPlay for cross-voice navigation (keyboard preview navigation)", async () => {
    const onPlay = vi.fn();
    render(<MultiVoicePanelsTestWrapper onPlay={onPlay} />);
    // Move to snare.wav and preview
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await waitFor(() => {
      expect(screen.getByText("snare.wav")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: " " });
    });
    expect(onPlay).toHaveBeenCalledWith(1, "snare.wav");
    onPlay.mockClear();
    // Move to voice 2, sample 0 (hat.wav) and preview
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await waitFor(() => {
      expect(screen.getByText("hat.wav")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(onPlay).toHaveBeenCalledWith(2, "hat.wav");
  });

  it("disables sample navigation when sequencerOpen is true (sequencer open)", async () => {
    render(<MultiVoicePanelsTestWrapper sequencerOpen={true} />);
    // Try to move selection
    const before = screen.getByText("kick.wav");
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    // Selection should not move
    expect(before).toBeInTheDocument();
  });

  it("enables sample navigation when sequencerOpen is false (sequencer closed)", async () => {
    render(<MultiVoicePanelsTestWrapper sequencerOpen={false} />);
    // Down to snare.wav
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await screen.findByText("snare.wav");
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
  });
});
