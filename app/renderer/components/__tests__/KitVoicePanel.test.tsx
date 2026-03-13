import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import KitVoicePanel from "../KitVoicePanel";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

// Mock the hooks used by KitVoicePanel
vi.mock("../hooks/useStereoHandling", () => ({
  useStereoHandling: vi.fn(() => ({
    analyzeStereoAssignment: vi.fn().mockReturnValue({
      assignAsMono: false,
      conflictInfo: null,
      requiresConfirmation: false,
    }),
    applyStereoAssignment: vi.fn().mockResolvedValue(true),
    handleStereoConflict: vi.fn().mockResolvedValue({
      cancel: false,
      forceMono: false,
      replaceExisting: false,
    }),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const baseProps = {
  isActive: false,
  isEditable: true,
  kitName: "Kit1",
  onPlay: vi.fn(),
  onSampleAdd: vi.fn(),
  onSampleDelete: vi.fn(),
  onSampleMove: vi.fn(),
  onSampleReplace: vi.fn(),
  onSampleSelect: vi.fn(),
  onSaveVoiceName: vi.fn(),
  onStereoDragLeave: vi.fn(),
  onStereoDragOver: vi.fn(),
  onStop: vi.fn(),
  onWaveformPlayingChange: vi.fn(),
  playTriggers: {},
  samplePlaying: {},
  samples: ["kick.wav", "snare.wav"],
  stopTriggers: {},
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

  afterEach(() => {
    cleanup();
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

  describe("Stereo drag target styling", () => {
    it("applies stereo drag target styling when isStereoDragTarget is true", () => {
      const { container } = renderKitVoicePanel({ isStereoDragTarget: true });
      const voicePanel = container.querySelector(
        '[class*="bg-accent-warning"]',
      );
      expect(voicePanel).toBeInTheDocument();
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

  describe("Props validation", () => {
    it("handles missing optional props gracefully", () => {
      const minimalProps = {
        kitName: "TestKit",
        onPlay: vi.fn(),
        onSaveVoiceName: vi.fn(),
        onStop: vi.fn(),
        onWaveformPlayingChange: vi.fn(),
        playTriggers: {},
        samplePlaying: {},
        samples: [],
        stopTriggers: {},
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
          is_stereo: false,
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
