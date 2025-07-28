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
  voices: [
    { voice: 1, samples: ["kick.wav", "snare.wav"], voiceName: "Kick" },
    { voice: 2, samples: ["hat.wav", "clap.wav"], voiceName: "Hat" },
  ],
  onSaveVoiceName: vi.fn(),
  onRescanVoiceName: vi.fn(),
  samplePlaying: {},
  playTriggers: {},
  stopTriggers: {},
  onPlay: vi.fn(),
  onStop: vi.fn(),
  onWaveformPlayingChange: vi.fn(),
  kitName: "Kit1",
};

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

// Utility to convert voices array to samples and kit
function voicesToProps(voices) {
  const samples = {};
  const kitVoices = [];
  voices.forEach(({ voice, samples: s, voiceName }) => {
    samples[voice] = s;
    kitVoices.push({
      id: voice,
      kit_name: "Kit1",
      voice_number: voice,
      voice_alias: voiceName,
    });
  });
  return {
    samples,
    kit: {
      name: "Kit1",
      alias: "Kit1",
      voices: kitVoices,
    },
  };
}

function MultiVoicePanelsTestWrapper({
  initialSelectedVoice = 1,
  initialSelectedSampleIdx = 0,
  onPlay = vi.fn(),
  voices = baseProps.voices,
  ...props
} = {}) {
  const [selectedVoice, setSelectedVoice] = useState(initialSelectedVoice);
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(
    initialSelectedSampleIdx,
  );
  const { samples, kit } = voicesToProps(voices);
  React.useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (["ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) {
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
          samples={samples}
          kit={kit}
          selectedVoice={selectedVoice}
          selectedSampleIdx={selectedSampleIdx}
          onSaveVoiceName={baseProps.onSaveVoiceName}
          onRescanVoiceName={baseProps.onRescanVoiceName}
          samplePlaying={{}}
          playTriggers={{}}
          stopTriggers={{}}
          onPlay={onPlay}
          onStop={baseProps.onStop}
          onWaveformPlayingChange={baseProps.onWaveformPlayingChange}
          kitName={baseProps.kitName}
          onSampleKeyNav={() => {}}
          onSampleSelect={() => {}}
          {...props}
        />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>
  );
}

describe("KitVoicePanels", () => {
  it("renders all voices and samples", () => {
    render(<MultiVoicePanelsTestWrapper />);
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
    expect(screen.getByText("hat.wav")).toBeInTheDocument();
    expect(screen.getByText("clap.wav")).toBeInTheDocument();
  });

  it("cross-voice keyboard navigation moves selection between voices", async () => {
    render(<MultiVoicePanelsTestWrapper />);
    // Down to snare.wav
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await screen.findByText("snare.wav");
    // Down to hat.wav (first sample of next voice)
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await screen.findByText("hat.wav");
    // Down to clap.wav (second sample of next voice)
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await screen.findByText("clap.wav");
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
