import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import KitVoicePanel from "../KitVoicePanel";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

/**
 * Integration tests for KitVoicePanel drag and drop functionality
 * Tests the new single drop zone pattern
 */
describe("KitVoicePanel Drag & Drop Integration", () => {
  beforeEach(() => {
    setupElectronAPIMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const createBaseProps = (overrides = {}) => ({
    isActive: false,
    isEditable: true,
    kitName: "TestKit",
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
    samples: ["sample1.wav", "sample2.wav"],
    stopTriggers: {},
    voice: 1,
    voiceName: "Voice 1",
    ...overrides,
  });

  const renderKitVoicePanel = (props = {}) => {
    const finalProps = createBaseProps(props);
    return render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...finalProps} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>
    );
  };

  describe("Drop Zone Rendering", () => {
    it("renders drop zone when voice is not full", () => {
      renderKitVoicePanel({ samples: ["sample1.wav", "sample2.wav"] });
      expect(screen.getByTestId("drop-zone-voice-1")).toBeInTheDocument();
    });

    it("does not render drop zone when voice is full", () => {
      const fullSamples = Array(12)
        .fill(0)
        .map((_, i) => `sample${i + 1}.wav`);
      renderKitVoicePanel({ samples: fullSamples });
      expect(screen.queryByTestId("drop-zone-voice-1")).not.toBeInTheDocument();
    });

    it("renders samples correctly", () => {
      renderKitVoicePanel();
      expect(screen.getByText("sample1.wav")).toBeInTheDocument();
      expect(screen.getByText("sample2.wav")).toBeInTheDocument();
    });
  });

  describe("File Drop Operations", () => {
    it("renders drop zone correctly", async () => {
      renderKitVoicePanel();
      const dropZone = screen.getByTestId("drop-zone-voice-1");
      expect(dropZone).toBeInTheDocument();
      expect(dropZone).toHaveTextContent("Drop WAV files here");
    });
  });
});
