import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { slotKey } from "../../utils/slotKey";
import { createSlotPlaybackStore } from "../hooks/kit-management/slotPlaybackStore";
import KitVoicePanel from "../KitVoicePanel";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

const baseProps = {
  isActive: false,
  isEditable: true,
  kitName: "Kit1",
  onPlay: vi.fn(),
  onSampleAdd: vi.fn(),
  onSampleDelete: vi.fn(),
  onSampleMove: vi.fn(),
  onSampleSelect: vi.fn(),
  onSaveVoiceName: vi.fn(),
  onStop: vi.fn(),
  onWaveformPlayingChange: vi.fn(),
  playsStereo: false,
  samples: ["kick.wav", "snare.wav"],
  slotPlayback: createSlotPlaybackStore(),
  voice: 1,
  voiceName: "Voice 1",
};

const renderKitVoicePanel = (props = {}) => {
  const finalProps = { ...baseProps, ...props };
  return render(
    <MockSettingsProvider>
      <MockMessageDisplayProvider>
        <KitVoicePanel {...finalProps} />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>,
  );
};

describe("KitVoicePanel", () => {
  beforeEach(() => {
    setupElectronAPIMock();
    vi.clearAllMocks();
  });

  it("renders voice panel with voice name", () => {
    renderKitVoicePanel();
    expect(screen.getByTestId("voice-name-1")).toHaveTextContent("Voice 1");
  });

  it("renders samples", () => {
    renderKitVoicePanel();
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
  });

  it("renders drop zone when not full", () => {
    renderKitVoicePanel();
    expect(screen.getByTestId("drop-zone-voice-1")).toBeInTheDocument();
  });

  it("does not render drop zone when voice is full", () => {
    const fullSamples = Array(12)
      .fill(0)
      .map((_, i) => `sample${i + 1}.wav`);
    renderKitVoicePanel({ samples: fullSamples });
    expect(screen.queryByTestId("drop-zone-voice-1")).not.toBeInTheDocument();
  });

  it("does not render slot numbers (now handled by parent)", () => {
    renderKitVoicePanel();
    expect(screen.queryByTestId("slot-number-1-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slot-number-1-1")).not.toBeInTheDocument();
  });

  it("renders samples with interaction elements when editable", () => {
    renderKitVoicePanel({ isEditable: true });
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
  });

  it("renders voice panel as read-only when not editable", () => {
    renderKitVoicePanel({ isEditable: false });
    expect(screen.queryByTestId("drop-zone-voice-1")).not.toBeInTheDocument();
  });

  describe("Voice linking functionality", () => {
    it("renders Stereo badge when isLinkedPrimary", () => {
      renderKitVoicePanel({
        isLinkedPrimary: true,
        linkedWith: 2,
        onVoiceUnlink: vi.fn(),
        voice: 1,
      });
      expect(screen.getByTestId("stereo-badge-1")).toBeInTheDocument();
      expect(screen.getByText("Stereo")).toBeInTheDocument();
    });

    it("calls onVoiceUnlink when Stereo badge clicked", async () => {
      const onVoiceUnlink = vi.fn();
      renderKitVoicePanel({
        isLinkedPrimary: true,
        linkedWith: 2,
        onVoiceUnlink,
        voice: 1,
      });
      const badge = screen.getByTestId("stereo-badge-1");
      badge.click();
      expect(onVoiceUnlink).toHaveBeenCalledWith(1);
    });

    it("does not render Stereo badge when not linked", () => {
      renderKitVoicePanel({
        isLinkedPrimary: false,
        voice: 1,
      });
      expect(screen.queryByTestId("stereo-badge-1")).not.toBeInTheDocument();
    });

    it("does not render Stereo badge when isLinkedPrimary is not set", () => {
      renderKitVoicePanel({ voice: 2 });
      expect(screen.queryByTestId("stereo-badge-2")).not.toBeInTheDocument();
    });
  });

  describe("Voice panel styling based on linking status", () => {
    it("applies standard styling for linked primary voice", () => {
      const { container } = renderKitVoicePanel({
        isLinkedPrimary: true,
        linkedWith: 2,
        onVoiceUnlink: vi.fn(),
      });
      // Panel should render with card-grain class
      const voicePanel = container.querySelector('[class*="card-grain"]');
      expect(voicePanel).toBeInTheDocument();
    });

    it("renders panel content when not linked", () => {
      const { container } = renderKitVoicePanel({
        isLinkedPrimary: false,
      });
      const voicePanel = container.querySelector('[class*="card-grain"]');
      expect(voicePanel).toBeInTheDocument();
    });
  });

  describe("Sample list keyboard navigation", () => {
    it("sets proper tabIndex when voice is active", () => {
      renderKitVoicePanel({ isActive: true });
      const sampleList = screen.getByTestId("sample-list-voice-1");
      expect(sampleList).toHaveAttribute("tabIndex", "0");
    });

    it("sets proper tabIndex when voice is not active", () => {
      renderKitVoicePanel({ isActive: false });
      const sampleList = screen.getByTestId("sample-list-voice-1");
      expect(sampleList).toHaveAttribute("tabIndex", "-1");
    });
  });

  // #522: each sample row was a listbox option, which can't contain the
  // row's buttons and gain knob, so screen readers couldn't reach them
  describe("[Q-06] sample rows are a grid of rows and cells", () => {
    const grid = () =>
      screen.getByRole("grid", { name: "Sample slots for voice 1" });
    const sampleRow = (name: string, slot: number) =>
      within(grid()).getByRole("row", {
        name: `Sample ${name} in slot ${slot}`,
      });

    it("names the grid and gives each sample its own row", () => {
      renderKitVoicePanel();
      expect(grid()).toBe(screen.getByTestId("sample-list-voice-1"));
      expect(sampleRow("kick.wav", 1)).toBeInTheDocument();
      expect(sampleRow("snare.wav", 2)).toBeInTheDocument();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
    });

    it("[UC-24] puts a row's play button, gain knob and delete button in cells", () => {
      renderKitVoicePanel();
      const row = sampleRow("kick.wav", 1);
      const cells = within(row).getAllByRole("gridcell");
      expect(cells).toHaveLength(4);

      const play = within(row).getByRole("button", { name: "Play" });
      const name = within(row).getByRole("gridcell", { name: "kick.wav" });
      const gain = within(row).getByRole("slider", { name: "Gain: 0 dB" });
      const remove = within(row).getByRole("button", {
        name: "Delete sample",
      });
      // Each control is inside a cell of the row, in the order they show
      expect(cells[0]).toContainElement(play);
      expect(cells[1]).toBe(name);
      expect(cells[2]).toContainElement(gain);
      expect(cells[3]).toContainElement(remove);
    });

    it("gives a locked kit's row its play button and name only", () => {
      renderKitVoicePanel({ isEditable: false });
      const row = sampleRow("kick.wav", 1);
      expect(within(row).getAllByRole("gridcell")).toHaveLength(2);
      expect(
        within(row).getByRole("button", { name: "Play" }),
      ).toBeInTheDocument();
      expect(within(row).queryByRole("slider")).not.toBeInTheDocument();
    });

    it("makes the drop zone a row and hides the empty slots", () => {
      renderKitVoicePanel();
      const rows = within(grid()).getAllByRole("row");
      expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
        "Sample kick.wav in slot 1",
        "Sample snare.wav in slot 2",
        "Drop zone for voice 1",
      ]);
      expect(
        within(rows[2]).getByRole("gridcell", { name: "Drop WAV files here" }),
      ).toBeInTheDocument();
      // The empty slots still hold the panel's height
      expect(grid().querySelectorAll("li")).toHaveLength(12);
    });

    describe("keeps the keyboard behavior the listbox had", () => {
      it("marks the selected row and keeps every sample row in the tab order", () => {
        renderKitVoicePanel({ isActive: true, selectedIdx: 1 });
        expect(sampleRow("kick.wav", 1)).toHaveAttribute(
          "aria-selected",
          "false",
        );
        expect(sampleRow("snare.wav", 2)).toHaveAttribute(
          "aria-selected",
          "true",
        );
        expect(sampleRow("kick.wav", 1)).toHaveAttribute("tabIndex", "0");
        expect(sampleRow("snare.wav", 2)).toHaveAttribute("tabIndex", "0");
      });

      it("tabs from a row through its controls to the next row", async () => {
        const user = userEvent.setup();
        renderKitVoicePanel({ isActive: true, selectedIdx: 0 });
        sampleRow("kick.wav", 1).focus();

        const kick = sampleRow("kick.wav", 1);
        const order = [
          within(kick).getByRole("button", { name: "Play" }),
          within(kick).getByRole("slider"),
          within(kick).getByRole("button", { name: "Delete sample" }),
          sampleRow("snare.wav", 2),
        ];
        for (const next of order) {
          await user.tab();
          expect(next).toHaveFocus();
        }
      });

      it.each([
        ["Enter", "{Enter}"],
        ["Space", " "],
      ])("selects a focused row with %s", async (_label, key) => {
        const user = userEvent.setup();
        const onSampleSelect = vi.fn();
        renderKitVoicePanel({ isActive: true, onSampleSelect });
        sampleRow("snare.wav", 2).focus();
        await user.keyboard(key);
        expect(onSampleSelect).toHaveBeenCalledWith(1, 1);
      });

      it("plays the selected sample for Space in the active grid", async () => {
        const user = userEvent.setup();
        const onPlay = vi.fn();
        renderKitVoicePanel({ isActive: true, onPlay, selectedIdx: 1 });
        grid().focus();
        await user.keyboard(" ");
        expect(onPlay).toHaveBeenCalledWith(1, 1);
      });

      it("moves focus to the newly selected row while focus is in the grid", () => {
        const { rerender } = renderKitVoicePanel({
          isActive: true,
          selectedIdx: 0,
        });
        sampleRow("kick.wav", 1).focus();
        rerender(
          <MockSettingsProvider>
            <MockMessageDisplayProvider>
              <KitVoicePanel {...baseProps} isActive selectedIdx={1} />
            </MockMessageDisplayProvider>
          </MockSettingsProvider>,
        );
        expect(sampleRow("snare.wav", 2)).toHaveFocus();
      });

      it("selects a row on click", async () => {
        const user = userEvent.setup();
        const onSampleSelect = vi.fn();
        renderKitVoicePanel({ onSampleSelect });
        await user.click(sampleRow("snare.wav", 2));
        expect(onSampleSelect).toHaveBeenCalledWith(1, 1);
      });
    });

    it("[UC-25] still shows a row's file in Finder on right-click", () => {
      renderKitVoicePanel({
        sampleMetadata: {
          [slotKey(1, 0)]: {
            filename: "kick.wav",
            source_path: "/samples/kick.wav",
          },
        },
      });
      fireEvent.contextMenu(sampleRow("kick.wav", 1));
      expect(
        vi.mocked(globalThis.electronAPI.showItemInFolder),
      ).toHaveBeenCalledWith("/samples/kick.wav");
    });
  });

  describe("Props validation", () => {
    it("handles missing optional props gracefully", () => {
      const minimalProps = {
        kitName: "TestKit",
        onPlay: vi.fn(),
        onSaveVoiceName: vi.fn(),
        onStop: vi.fn(),
        onWaveformPlayingChange: vi.fn(),
        playsStereo: false,
        samples: [],
        slotPlayback: createSlotPlaybackStore(),
        voice: 1,
        voiceName: "Voice 1",
      };

      expect(() => {
        render(
          <MockSettingsProvider>
            <MockMessageDisplayProvider>
              <KitVoicePanel {...minimalProps} />
            </MockMessageDisplayProvider>
          </MockSettingsProvider>,
        );
      }).not.toThrow();
    });

    it("renders with sampleMetadata when provided", () => {
      const sampleMetadata = {
        "kick.wav": {
          source_path: "/path/to/kick.wav",
          wav_bit_depth: 16,
          wav_bitrate: 1411,
          wav_channels: 1,
          wav_sample_rate: 44100,
        },
      };

      renderKitVoicePanel({ sampleMetadata });
      expect(screen.getByText("kick.wav")).toBeInTheDocument();
    });
  });
});
