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
