import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import KitDetails from "../KitDetails";
import { SettingsProvider } from "../../utils/SettingsContext";

// Helper to mock electronAPI with dynamic state
function mockElectronAPI({
  files = [],
  voiceNames = {},
  updateVoiceNames,
}: {
  files?: string[];
  voiceNames?: any;
  updateVoiceNames?: () => any;
} = {}) {
  let currentVoiceNames = { ...voiceNames };
  (window as any).electronAPI = {
    listFilesInRoot: async () => files,
    onSamplePlaybackEnded: () => {},
    onSamplePlaybackError: () => {},
    
    // New database methods
    getKitMetadata: async (dbDir, kitName) => {
      if (updateVoiceNames) {
        const updated = updateVoiceNames();
        if (updated) currentVoiceNames = { ...updated };
      }
      return {
        success: true,
        data: {
          id: 1,
          name: kitName,
          alias: kitName,
          plan_enabled: false,
          locked: false,
          voices: { ...currentVoiceNames },
          step_pattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
        },
      };
    },
    updateKitMetadata: async (dbDir, kitName, updates) => ({ success: true }),
    updateVoiceAlias: async (dbDir, kitId, voiceNumber, alias) => {
      currentVoiceNames[voiceNumber] = alias;
      return { success: true };
    },
    updateStepPattern: async (dbDir, kitName, pattern) => ({ success: true }),
  };
}

// Helper to render components with SettingsProvider
function renderWithSettings(component: React.ReactElement) {
  return render(
    <SettingsProvider>
      {component}
    </SettingsProvider>
  );
}

describe("KitDetails", () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as any;
  });

  beforeEach(() => {
    mockElectronAPI({
      voiceNames: { 1: "", 2: "", 3: "", 4: "" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("voice name controls", () => {
    it("shows edit/rescan controls and a no-name indicator if no voice name is set", async () => {
      mockElectronAPI({ voiceNames: { 1: "", 2: "", 3: "", 4: "" } });
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          localStorePath="/sd"
          onBack={() => {}}
          onMessage={vi.fn()}
        />
      );
      const noNameIndicators = await screen.findAllByText("No voice name set");
      expect(noNameIndicators.length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Edit voice name").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Rescan voice name").length).toBeGreaterThan(
        0,
      );
    });
    it("auto-scans all voice names if none are set", async () => {
      mockElectronAPI({
        files: ["1 Kick.wav", "2 Snare.wav", "3 Hat.wav", "4 Tom.wav"],
        voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" },
      });
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          localStorePath="/sd"
          onBack={() => {}}
          onMessage={vi.fn()}
        />
      );
      await waitFor(() =>
        expect(screen.getByTestId("voice-name-1")).toHaveTextContent("Kick"),
      );
      expect(screen.getByTestId("voice-name-1")).toHaveTextContent("Kick");
      expect(screen.getByTestId("voice-name-2")).toHaveTextContent("Snare");
      expect(screen.getByTestId("voice-name-3")).toHaveTextContent("Hat");
      expect(screen.getByTestId("voice-name-4")).toHaveTextContent("Tom");
    });
  });

  describe("voice rescanning", () => {
    it("rescans a single voice and updates only that voice", async () => {
      let updated = false;
      mockElectronAPI({
        files: ["1 Kick.wav", "2 Snare.wav", "3 Hat.wav", "4 Tom.wav"],
        voiceNames: { 1: "", 2: "", 3: "", 4: "" },
        updateVoiceNames: () =>
          updated ? { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" } : undefined,
      });
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          localStorePath="/sd"
          onBack={() => {}}
          onMessage={vi.fn()}
        />
      );
      const noNameIndicators = await screen.findAllByText("No voice name set");
      expect(noNameIndicators.length).toBeGreaterThanOrEqual(4);
      const rescanButtons = screen.getAllByTitle("Rescan voice name");
      updated = true;
      fireEvent.click(rescanButtons[1]);
      await waitFor(() =>
        expect(screen.getByTestId("voice-name-1")).toHaveTextContent("Kick"),
      );
      expect(screen.getByTestId("voice-name-1")).toHaveTextContent("Kick");
      expect(screen.getByTestId("voice-name-2")).toHaveTextContent("Snare");
      expect(screen.getByTestId("voice-name-3")).toHaveTextContent("Hat");
      expect(screen.getByTestId("voice-name-4")).toHaveTextContent("Tom");
      expect(screen.queryByText("No voice name set")).toBeNull();
    });
    it("rescans all voices and updates all names", async () => {
      let updated = false;
      mockElectronAPI({
        files: ["1 Kick.wav", "2 Snare.wav", "3 Hat.wav", "4 Tom.wav"],
        voiceNames: { 1: "", 2: "", 3: "", 4: "" },
        updateVoiceNames: () =>
          updated ? { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" } : undefined,
      });
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          localStorePath="/sd"
          onBack={() => {}}
          onMessage={vi.fn()}
        />
      );
      const noNameIndicators = await screen.findAllByText("No voice name set");
      expect(noNameIndicators.length).toBeGreaterThanOrEqual(4);
      const rescanAll = screen.getByRole("button", {
        name: /rescan kit voice names/i,
      });
      updated = true;
      fireEvent.click(rescanAll);
      await waitFor(() =>
        expect(screen.getByTestId("voice-name-1")).toHaveTextContent("Kick"),
      );
      expect(screen.getByTestId("voice-name-1")).toHaveTextContent("Kick");
      expect(screen.getByTestId("voice-name-2")).toHaveTextContent("Snare");
      expect(screen.getByTestId("voice-name-3")).toHaveTextContent("Hat");
      expect(screen.getByTestId("voice-name-4")).toHaveTextContent("Tom");
      expect(screen.queryByText("No voice name set")).toBeNull();
    });
    it("always shows all four voices, even if no match", async () => {
      mockElectronAPI({
        files: ["1 Kick.wav", "2 Snare.wav"],
        voiceNames: { 1: "", 2: "", 3: "", 4: "" },
      });
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          localStorePath="/sd"
          onBack={() => {}}
          onMessage={vi.fn()}
        />
      );
      expect(await screen.findByTestId("voice-name-1")).toBeInTheDocument();
      expect(screen.getByTestId("voice-name-2")).toBeInTheDocument();
      expect(screen.getByTestId("voice-name-3")).toBeInTheDocument();
      expect(screen.getByTestId("voice-name-4")).toBeInTheDocument();
    });
  });
});
