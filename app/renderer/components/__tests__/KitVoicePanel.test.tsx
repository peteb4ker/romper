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
  onRescanVoiceName: vi.fn(),
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

  it("renders slot numbers correctly", () => {
    renderKitVoicePanel();
    expect(screen.getByTestId("slot-number-1-0")).toHaveTextContent("1.");
    expect(screen.getByTestId("slot-number-1-1")).toHaveTextContent("2.");
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
});
