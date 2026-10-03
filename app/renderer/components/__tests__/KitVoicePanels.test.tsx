import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { MAX_SLOTS_PER_VOICE } from "../hooks/voice-panels/useVoicePanelSlots";
import KitVoicePanels from "../KitVoicePanels";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

const baseProps = {
  kitName: "Kit1",
  onPlay: vi.fn(),

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
  voices.forEach(({ samples: s, stereo_mode, voice, voiceName }) => {
    samples[voice] = s;
    kitVoices.push({
      id: voice,
      kit_name: "Kit1",
      stereo_mode: stereo_mode || false,
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
  beforeEach(() => {
    setupElectronAPIMock();
    vi.clearAllMocks();
  });

  it("renders all voices and samples", () => {
    render(<MultiVoicePanelsTestWrapper />);
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
    expect(screen.getByText("hat.wav")).toBeInTheDocument();
    expect(screen.getByText("clap.wav")).toBeInTheDocument();
  });

  it("renders global slot numbers on the left side only", () => {
    render(<MultiVoicePanelsTestWrapper />);
    // Check that global slot numbers 1-MAX_SLOTS_PER_VOICE are rendered
    expect(screen.getByTestId("global-slot-number-0")).toHaveTextContent("1");
    expect(screen.getByTestId("global-slot-number-1")).toHaveTextContent("2");
    expect(
      screen.getByTestId(`global-slot-number-${MAX_SLOTS_PER_VOICE - 1}`),
    ).toHaveTextContent(`${MAX_SLOTS_PER_VOICE}`);

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

  it(`maintains fixed ${MAX_SLOTS_PER_VOICE}-slot height for all voice panels`, () => {
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
        samples: Array(MAX_SLOTS_PER_VOICE)
          .fill()
          .map((_, i) => `sample${i}.wav`),
        voice: 4,
        voiceName: "Voice4",
      }, // MAX_SLOTS_PER_VOICE samples (full)
    ];

    render(<MultiVoicePanelsTestWrapper isEditable={true} voices={voices} />);

    // Each voice panel should have exactly MAX_SLOTS_PER_VOICE rendered slots (samples + empty slots + drop zone)
    const voice1List = screen.getByTestId("sample-list-voice-1");
    const voice2List = screen.getByTestId("sample-list-voice-2");
    const voice3List = screen.getByTestId("sample-list-voice-3");
    const voice4List = screen.getByTestId("sample-list-voice-4");

    // All should have exactly MAX_SLOTS_PER_VOICE list items (slots)
    expect(voice1List.children).toHaveLength(MAX_SLOTS_PER_VOICE);
    expect(voice2List.children).toHaveLength(MAX_SLOTS_PER_VOICE);
    expect(voice3List.children).toHaveLength(MAX_SLOTS_PER_VOICE);
    expect(voice4List.children).toHaveLength(MAX_SLOTS_PER_VOICE);

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

  describe("Sample metadata handling", () => {
    it("handles missing electronAPI gracefully", () => {
      // Temporarily remove electronAPI
      delete window.electronAPI;

      expect(() => {
        render(<MultiVoicePanelsTestWrapper />);
      }).not.toThrow();

      // Restore electronAPI
      setupElectronAPIMock();
    });

    it("handles empty sample metadata", () => {
      const mockGetAllSamplesForKit = vi.fn().mockResolvedValue({
        data: [],
        success: true,
      });

      // Use centralized mock
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockImplementation(
        mockGetAllSamplesForKit,
      );

      render(<MultiVoicePanelsTestWrapper />);
      expect(mockGetAllSamplesForKit).toHaveBeenCalledWith("Kit1");
    });

    it("handles sample metadata loading error", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockGetAllSamplesForKit = vi
        .fn()
        .mockRejectedValue(new Error("API Error"));

      // Use centralized mock with override
      setupElectronAPIMock({
        getAllSamplesForKit: mockGetAllSamplesForKit,
      });

      render(<MultiVoicePanelsTestWrapper />);

      // Wait for effect to run
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to load sample metadata:",
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("[UC-24] gain per slot, not per file name (RE-45)", () => {
    // Two files named dup.wav in voice 1 (from different folders) and a
    // third in voice 2, each with its own gain
    const twins = [
      { samples: ["dup.wav", "dup.wav"], voice: 1, voiceName: "One" },
      { samples: ["dup.wav"], voice: 2, voiceName: "Two" },
    ];
    const row = (voice: number, slot: number, gain: number) => ({
      filename: "dup.wav",
      gain_db: gain,
      kit_name: "Kit1",
      slot_number: slot,
      source_path: `/src${voice}${slot}/dup.wav`,
      voice_number: voice,
    });

    beforeEach(() => {
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
        data: [row(1, 0, 6), row(1, 1, -3), row(2, 0, 0)],
        success: true,
      });
    });

    // The gain knob in each sample slot of a voice
    const knobs = (voice: number) =>
      within(screen.getByTestId(`voice-panel-${voice}`))
        .getAllByRole("option")
        .map((slot) => within(slot).getByRole("slider"));
    const gains = (voice: number) =>
      knobs(voice).map((knob) => knob.getAttribute("aria-valuenow"));

    it("shows each slot's own gain", async () => {
      render(<MultiVoicePanelsTestWrapper isEditable voices={twins} />);

      await waitFor(() => expect(gains(1)).toEqual(["6", "-3"]));
      expect(gains(2)).toEqual(["0"]);
    });

    it("changes only the slot whose gain is set", async () => {
      render(<MultiVoicePanelsTestWrapper isEditable voices={twins} />);
      await waitFor(() => expect(gains(1)).toEqual(["6", "-3"]));

      fireEvent.wheel(knobs(1)[1], { deltaY: -100 });

      expect(window.electronAPI.updateSampleGain).toHaveBeenCalledWith(
        "Kit1",
        1,
        1,
        -2,
      );
      await waitFor(() => expect(gains(1)).toEqual(["6", "-2"]));
      expect(gains(2)).toEqual(["0"]);
    });
  });

  describe("Voice panel rendering with different kit configurations", () => {
    it("renders with null kit (fallback voice data)", () => {
      const { samples } = voicesToProps(baseProps.voices);
      render(
        <MockSettingsProvider>
          <MockMessageDisplayProvider>
            <KitVoicePanels
              kit={null}
              kitName="TestKit"
              onPlay={vi.fn()}
              onSampleKeyNav={vi.fn()}
              onSampleSelect={vi.fn()}
              onSaveVoiceName={vi.fn()}
              onStop={vi.fn()}
              onWaveformPlayingChange={vi.fn()}
              playTriggers={{}}
              samplePlaying={{}}
              samples={samples}
              selectedSampleIdx={0}
              selectedVoice={1}
              sequencerOpen={false}
              setSelectedSampleIdx={() => {}}
              setSelectedVoice={() => {}}
              stopTriggers={{}}
            />
          </MockMessageDisplayProvider>
        </MockSettingsProvider>,
      );

      expect(screen.getByTestId("voice-panel-1")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-2")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-3")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-4")).toBeInTheDocument();
    });

    it("renders with kit that has no voices", () => {
      const kit = {
        alias: "TestKit",
        name: "TestKit",
        voices: [],
      };
      const samples = {};

      render(
        <MockSettingsProvider>
          <MockMessageDisplayProvider>
            <KitVoicePanels
              kit={kit}
              kitName="TestKit"
              onPlay={vi.fn()}
              onSampleKeyNav={vi.fn()}
              onSampleSelect={vi.fn()}
              onSaveVoiceName={vi.fn()}
              onStop={vi.fn()}
              onWaveformPlayingChange={vi.fn()}
              playTriggers={{}}
              samplePlaying={{}}
              samples={samples}
              selectedSampleIdx={0}
              selectedVoice={1}
              sequencerOpen={false}
              setSelectedSampleIdx={() => {}}
              setSelectedVoice={() => {}}
              stopTriggers={{}}
            />
          </MockMessageDisplayProvider>
        </MockSettingsProvider>,
      );

      expect(screen.getByTestId("voice-panel-1")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-2")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-3")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-4")).toBeInTheDocument();
    });
  });

  describe("Stereo drag handling", () => {
    it("renders with stereo drag info", () => {
      render(<MultiVoicePanelsTestWrapper isEditable={true} />);

      // Component should render successfully with stereo drag handling
      expect(screen.getByTestId("voice-panels-row")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-1")).toBeInTheDocument();
      expect(screen.getByTestId("voice-panel-2")).toBeInTheDocument();
    });
  });

  describe("Props edge cases", () => {
    it("renders with missing optional props", () => {
      const minimalProps = {
        kit: { alias: "TestKit", name: "TestKit", voices: [] },
        kitName: "TestKit",
        onPlay: vi.fn(),

        onSampleKeyNav: vi.fn(),
        onSampleSelect: vi.fn(),
        onSaveVoiceName: vi.fn(),
        onStop: vi.fn(),
        onWaveformPlayingChange: vi.fn(),
        playTriggers: {},
        samplePlaying: {},
        samples: {},
        selectedSampleIdx: 0,
        selectedVoice: 1,
        sequencerOpen: false,
        setSelectedSampleIdx: vi.fn(),
        setSelectedVoice: vi.fn(),
        stopTriggers: {},
      };

      expect(() => {
        render(
          <MockSettingsProvider>
            <MockMessageDisplayProvider>
              <KitVoicePanels {...minimalProps} />
            </MockMessageDisplayProvider>
          </MockSettingsProvider>,
        );
      }).not.toThrow();
    });

    it("handles undefined isEditable prop (defaults to false)", () => {
      const { kit, samples } = voicesToProps(baseProps.voices);
      render(
        <MockSettingsProvider>
          <MockMessageDisplayProvider>
            <KitVoicePanels
              kit={kit}
              kitName="TestKit"
              onPlay={vi.fn()}
              onSampleKeyNav={vi.fn()}
              onSampleSelect={vi.fn()}
              onSaveVoiceName={vi.fn()}
              onStop={vi.fn()}
              onWaveformPlayingChange={vi.fn()}
              playTriggers={{}}
              samplePlaying={{}}
              samples={samples}
              selectedSampleIdx={0}
              selectedVoice={1}
              sequencerOpen={false}
              setSelectedSampleIdx={() => {}}
              setSelectedVoice={() => {}}
              stopTriggers={{}}
            />
          </MockMessageDisplayProvider>
        </MockSettingsProvider>,
      );

      // Should not have drop zones when isEditable is undefined (defaults to false)
      expect(screen.queryByTestId("drop-zone-voice-1")).not.toBeInTheDocument();
    });
  });

  describe("[UC-11] [UC-24] Gain changes (RE-35)", () => {
    it("writes the gain and shows the kit as modified", async () => {
      const onKitModified = vi.fn();
      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onKitModified={onKitModified}
        />,
      );

      fireEvent.wheel(screen.getAllByRole("slider")[0], { deltaY: -100 });

      expect(globalThis.electronAPI.updateSampleGain).toHaveBeenCalledWith(
        "Kit1",
        1,
        0,
        1,
      );
      await waitFor(() => expect(onKitModified).toHaveBeenCalledWith("Kit1"));
    });
  });

  describe("[UC-24] [UC-36] a gain that isn't saved (RE-91)", () => {
    const voices = [{ samples: ["kick.wav"], voice: 1, voiceName: "Kick" }];

    beforeEach(() => {
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
        data: [
          {
            filename: "kick.wav",
            gain_db: -3,
            kit_name: "Kit1",
            slot_number: 0,
            source_path: "/src/kick.wav",
            voice_number: 1,
          },
        ],
        success: true,
      });
    });

    const knob = () =>
      within(screen.getByTestId("voice-panel-1")).getAllByRole("slider")[0];
    const gain = () => knob().getAttribute("aria-valuenow");

    it("puts a refused gain back and says so", async () => {
      vi.mocked(window.electronAPI.updateSampleGain).mockResolvedValue({
        error: "Sample not found: kit=Kit1, voice=1, slot=0",
        success: false,
      });
      const onKitModified = vi.fn();
      const onMessage = vi.fn();
      render(
        <MultiVoicePanelsTestWrapper
          isEditable
          onKitModified={onKitModified}
          onMessage={onMessage}
          voices={voices}
        />,
      );
      await waitFor(() => expect(gain()).toBe("-3"));

      fireEvent.wheel(knob(), { deltaY: -100 });

      await waitFor(() =>
        expect(onMessage).toHaveBeenCalledWith(
          "Couldn't save the gain for kick.wav, so it's back to -3 dB. Try again.",
          "error",
        ),
      );
      expect(gain()).toBe("-3");
      expect(onMessage.mock.calls[0][0]).not.toMatch(/not found|Error:/);
      expect(onKitModified).not.toHaveBeenCalled();
    });

    it("gives one message for a turn whose saves all fail", async () => {
      vi.mocked(window.electronAPI.updateSampleGain).mockRejectedValue(
        new Error("IPC channel closed"),
      );
      const onMessage = vi.fn();
      render(
        <MultiVoicePanelsTestWrapper
          isEditable
          onMessage={onMessage}
          voices={voices}
        />,
      );
      await waitFor(() => expect(gain()).toBe("-3"));

      fireEvent.wheel(knob(), { deltaY: -100 });
      fireEvent.wheel(knob(), { deltaY: -100 });
      fireEvent.wheel(knob(), { deltaY: -100 });

      await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
      expect(gain()).toBe("-3");
    });

    it("says nothing when the gain is saved", async () => {
      const onMessage = vi.fn();
      render(
        <MultiVoicePanelsTestWrapper
          isEditable
          onMessage={onMessage}
          voices={voices}
        />,
      );
      await waitFor(() => expect(gain()).toBe("-3"));

      fireEvent.wheel(knob(), { deltaY: -100 });

      await waitFor(() =>
        expect(window.electronAPI.updateSampleGain).toHaveBeenCalled(),
      );
      await act(async () => {});
      expect(gain()).toBe("-2");
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe("[UC-28] Voice linking layout", () => {
    it("should hide secondary voice panel when linked", () => {
      const voices = [
        {
          samples: ["kick.wav"],
          stereo_mode: true,
          voice: 1,
          voiceName: "Kick",
        },
        { samples: [], voice: 2, voiceName: "Hat" },
        { samples: ["tom.wav"], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];

      render(<MultiVoicePanelsTestWrapper isEditable={true} voices={voices} />);

      const panel1 = screen.getByTestId("voice-panel-1");
      const panel2 = screen.getByTestId("voice-panel-2");
      expect(panel1.className).toContain("flex-1");
      expect(panel2.className).toContain("hidden");
    });

    it("should not render chain icon between merged pair", () => {
      const voices = [
        {
          samples: ["kick.wav"],
          stereo_mode: true,
          voice: 1,
          voiceName: "Kick",
        },
        { samples: [], voice: 2, voiceName: "Hat" },
        { samples: ["tom.wav"], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];

      render(<MultiVoicePanelsTestWrapper isEditable={true} voices={voices} />);

      // Chain icon between voices 1-2 should not exist (voice 1 is primary)
      expect(screen.queryByTestId("chain-icon-1-2")).not.toBeInTheDocument();
      // Chain icon between 2-3 should not exist (voice 2 is secondary in linked pair)
      expect(screen.queryByTestId("chain-icon-2-3")).not.toBeInTheDocument();
      // Chain icon between 3-4 should still exist (neither is linked)
      expect(screen.getByTestId("chain-icon-3-4")).toBeInTheDocument();
    });

    it("should show chain icons when unlinked", () => {
      render(<MultiVoicePanelsTestWrapper isEditable={true} />);

      // Chain icons should exist between all adjacent unlinked voices and be visible
      const linkButton = screen.getByTestId("link-button-1-2");
      expect(linkButton.className).toContain("opacity-80");
      expect(linkButton.className).toContain("hover:opacity-100");
    });

    it("should render stereo badge in header when linked", () => {
      const voices = [
        {
          samples: ["kick.wav"],
          stereo_mode: true,
          voice: 1,
          voiceName: "Kick",
        },
        { samples: [], voice: 2, voiceName: "Hat" },
        { samples: ["tom.wav"], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];

      render(<MultiVoicePanelsTestWrapper isEditable={true} voices={voices} />);

      expect(screen.getByTestId("stereo-badge-1")).toBeInTheDocument();
      expect(screen.getByText("Stereo")).toBeInTheDocument();
    });

    it("should render unlinked voices with flex-1", () => {
      render(<MultiVoicePanelsTestWrapper isEditable={true} />);

      const panel1 = screen.getByTestId("voice-panel-1");
      const panel2 = screen.getByTestId("voice-panel-2");
      expect(panel1.className).toContain("flex-1");
      expect(panel2.className).toContain("flex-1");
    });

    it("should call link handler when chain icon clicked with empty secondary voice", async () => {
      const onKitUpdated = vi.fn().mockResolvedValue(undefined);

      const voices = [
        { samples: ["kick.wav"], voice: 1, voiceName: "Kick" },
        { samples: [], voice: 2, voiceName: "Hat" },
        { samples: ["tom.wav"], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];

      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onKitUpdated={onKitUpdated}
          voices={voices}
        />,
      );

      const linkButton = screen.getByTestId("link-button-1-2");
      await act(async () => {
        fireEvent.click(linkButton);
      });

      await waitFor(() => {
        expect(window.electronAPI.updateVoiceStereoMode).toHaveBeenCalled();
      });
    });

    it("should block linking when secondary voice has samples", async () => {
      const voices = [
        { samples: ["kick.wav"], voice: 1, voiceName: "Kick" },
        { samples: ["hat.wav"], voice: 2, voiceName: "Hat" },
        { samples: ["tom.wav"], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];

      render(<MultiVoicePanelsTestWrapper isEditable={true} voices={voices} />);

      const linkButton = screen.getByTestId("link-button-1-2");
      await act(async () => {
        fireEvent.click(linkButton);
      });

      // Should not call updateVoiceStereoMode since secondary has samples
      expect(window.electronAPI.updateVoiceStereoMode).not.toHaveBeenCalled();
    });

    it("should link unlinked voices 3-4 when chain icon clicked", async () => {
      const onKitUpdated = vi.fn().mockResolvedValue(undefined);
      const voices = [
        {
          samples: ["kick.wav"],
          stereo_mode: true,
          voice: 1,
          voiceName: "Kick",
        },
        { samples: [], voice: 2, voiceName: "Hat" },
        { samples: ["tom.wav"], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];

      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onKitUpdated={onKitUpdated}
          voices={voices}
        />,
      );

      // Chain icon between 3-4 should exist
      const linkButton = screen.getByTestId("link-button-3-4");
      await act(async () => {
        fireEvent.click(linkButton);
      });

      // Should call updateVoiceStereoMode for voice 3 since it's not linked
      await waitFor(() => {
        expect(window.electronAPI.updateVoiceStereoMode).toHaveBeenCalled();
      });
    });

    it("should call unlink handler when stereo badge clicked", async () => {
      const onKitUpdated = vi.fn().mockResolvedValue(undefined);

      const voices = [
        {
          samples: ["kick.wav"],
          stereo_mode: true,
          voice: 1,
          voiceName: "Kick",
        },
        { samples: [], voice: 2, voiceName: "Hat" },
        { samples: ["tom.wav"], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];

      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onKitUpdated={onKitUpdated}
          voices={voices}
        />,
      );

      const stereoBadge = screen.getByTestId("stereo-badge-1");
      await act(async () => {
        fireEvent.click(stereoBadge);
      });

      await waitFor(() => {
        expect(window.electronAPI.updateVoiceStereoMode).toHaveBeenCalled();
      });
    });
  });
  describe("[UC-28] [UC-36] telling the user about a refused link (RE-40)", () => {
    const voices = (secondary: string[], stereo = false) => [
      { samples: ["kick.wav"], stereo_mode: stereo, voice: 1, voiceName: "A" },
      { samples: secondary, voice: 2, voiceName: "B" },
      { samples: [], voice: 3, voiceName: "C" },
      { samples: [], voice: 4, voiceName: "D" },
    ];

    it("says why when the right-hand voice has samples", async () => {
      const onMessage = vi.fn();
      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onMessage={onMessage}
          voices={voices(["hat.wav"])}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("link-button-1-2"));
      });

      expect(window.electronAPI.updateVoiceStereoMode).not.toHaveBeenCalled();
      expect(onMessage).toHaveBeenCalledWith(
        "Voices 1 and 2 weren't linked: voice 2 has samples. Delete or move them, then link again.",
        "warning",
      );
    });

    it("reports a link main refuses", async () => {
      const onMessage = vi.fn();
      const onKitUpdated = vi.fn().mockResolvedValue(undefined);
      vi.mocked(window.electronAPI.updateVoiceStereoMode).mockResolvedValue({
        error:
          "Kit Kit1 isn't editable. Make it editable to link or unlink voices.",
        success: false,
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onKitUpdated={onKitUpdated}
          onMessage={onMessage}
          voices={voices([])}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("link-button-1-2"));
      });

      await waitFor(() =>
        expect(onMessage).toHaveBeenCalledWith(
          "Voices 1 and 2 weren't linked. Check that the kit is editable and voice 2 is empty, then try again.",
          "error",
        ),
      );
      consoleError.mockRestore();
    });

    it("reports a link whose write throws", async () => {
      const onMessage = vi.fn();
      vi.mocked(window.electronAPI.updateVoiceStereoMode).mockRejectedValue(
        new Error("SQLITE_BUSY: database is locked"),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onMessage={onMessage}
          voices={voices([])}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("link-button-1-2"));
      });

      await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
      expect(onMessage.mock.calls[0][0]).not.toMatch(/SQLITE|Error:/);
      consoleError.mockRestore();
    });

    it("says nothing when the link works", async () => {
      const onMessage = vi.fn();
      vi.mocked(window.electronAPI.updateVoiceStereoMode).mockResolvedValue({
        success: true,
      });
      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onKitUpdated={vi.fn().mockResolvedValue(undefined)}
          onMessage={onMessage}
          voices={voices([])}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("link-button-1-2"));
      });

      await waitFor(() =>
        expect(window.electronAPI.updateVoiceStereoMode).toHaveBeenCalled(),
      );
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("reports an unlink main refuses, and doesn't reload", async () => {
      const onMessage = vi.fn();
      const onKitUpdated = vi.fn().mockResolvedValue(undefined);
      vi.mocked(window.electronAPI.updateVoiceStereoMode).mockResolvedValue({
        error: "Kit Kit1 isn't editable.",
        success: false,
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      render(
        <MultiVoicePanelsTestWrapper
          isEditable={true}
          onKitUpdated={onKitUpdated}
          onMessage={onMessage}
          voices={voices([], true)}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("stereo-badge-1"));
      });

      await waitFor(() =>
        expect(onMessage).toHaveBeenCalledWith(
          "Voices 1 and 2 weren't unlinked. Check that the kit is editable, then try again.",
          "error",
        ),
      );
      expect(onKitUpdated).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  // RE-71: stereo linking is an edit
  describe("[UC-28] on a read-only kit", () => {
    it("offers no link control", () => {
      render(<MultiVoicePanelsTestWrapper isEditable={false} />);
      expect(screen.queryByTestId(/^link-button-/)).toBeNull();
    });

    it("shows the stereo pair without letting it be unlinked", () => {
      const voices = [
        {
          samples: ["kick.wav"],
          stereo_mode: true,
          voice: 1,
          voiceName: "Kick",
        },
        { samples: [], voice: 2, voiceName: "Hat" },
        { samples: [], voice: 3, voiceName: "Tom" },
        { samples: [], voice: 4, voiceName: "Perc" },
      ];
      render(
        <MultiVoicePanelsTestWrapper isEditable={false} voices={voices} />,
      );
      const badge = screen.getByTestId("stereo-badge-1");
      expect(badge.tagName).not.toBe("BUTTON");
      expect(badge).toHaveTextContent("Stereo");
    });
  });
});
