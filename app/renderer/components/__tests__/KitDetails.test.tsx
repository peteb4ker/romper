import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { TestSettingsProvider } from "../../../../tests/providers/TestSettingsProvider";
import { render } from "../../../../tests/utils/renderWithProviders";
import KitDetails from "../KitDetails";

// Mock modules before importing them
vi.mock("../hooks/kit-management/useKitDetailsLogic", () => ({
  useKitDetailsLogic: vi.fn(),
}));

// UnscannedKitPrompt feature was removed during database migration

// Import after mocking and access the mocked function
import { useKitDetailsLogic } from "../hooks/kit-management/useKitDetailsLogic";
const mockUseKitDetailsLogic = useKitDetailsLogic as ReturnType<typeof vi.fn>;

// Add Mock type for TypeScript
type Mock = ReturnType<typeof vi.fn>;

// Helper to create default mock logic
function createMockLogic(overrides = {}) {
  return {
    handleScanKit: vi.fn(),
    // Kit data from useKitDetailsLogic
    kit: {
      alias: null,
      artist: null,
      bank_letter: "T",
      editable: false,
      locked: false,
      name: "TestKit",
      step_pattern: null,
      voices: [
        { id: 1, kit_name: "TestKit", voice_alias: null, voice_number: 1 },
        { id: 2, kit_name: "TestKit", voice_alias: null, voice_number: 2 },
        { id: 3, kit_name: "TestKit", voice_alias: null, voice_number: 3 },
        { id: 4, kit_name: "TestKit", voice_alias: null, voice_number: 4 },
      ],
    },
    kitError: null,
    kitLoading: false,
    playback: {
      handlePlay: vi.fn(),
      handleStop: vi.fn(),
      handleWaveformPlayingChange: vi.fn(),
      playbackError: null,
      playTriggers: {},
      samplePlaying: null,
      stopTriggers: {},
    },
    reloadKit: vi.fn(),
    samples: { 1: [], 2: [], 3: [], 4: [] },
    selectedSampleIdx: 0,
    selectedVoice: 1,
    sequencerGridRef: { current: null },
    sequencerOpen: false,
    setSelectedSampleIdx: vi.fn(),
    setSelectedVoice: vi.fn(),
    setSequencerOpen: vi.fn(),
    setStepPattern: vi.fn(),
    stepPattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
    toggleEditableMode: vi.fn(),
    updateKitAlias: vi.fn(),
    updateVoiceAlias: vi.fn(),
    ...overrides,
    kitVoicePanels: {
      onSampleKeyNav: vi.fn(),
    },
    sampleManagement: {
      handleSampleAdd: vi.fn(),
      handleSampleDelete: vi.fn(),
      handleSampleReplace: vi.fn(),
    },
  };
}

// Helper to render components with TestSettingsProvider
function renderWithSettings(component: React.ReactElement) {
  return render(<TestSettingsProvider>{component}</TestSettingsProvider>);
}

// Helper to set up specific mock behaviors for this test
function setupElectronAPIMocks() {
  vi.mocked(window.electronAPI.getKit).mockResolvedValue({
    data: null,
    success: true,
  });
  vi.mocked(window.electronAPI.updateKit).mockResolvedValue({ success: true });
  vi.mocked(window.electronAPI.updateVoiceAlias).mockResolvedValue({
    success: true,
  });
  vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
    success: true,
  });
}

describe("KitDetails", () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as unknown;
  });

  beforeEach(() => {
    setupElectronAPIMocks();
    // Reset mock implementation to default
    mockUseKitDetailsLogic.mockClear();
    mockUseKitDetailsLogic.mockReturnValue(createMockLogic());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("voice name controls", () => {
    it("shows no-name indicator when no voice name is set", async () => {
      // Default mocks already have empty voice names
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );
      const noNameIndicators = await screen.findAllByText("No voice name set");
      expect(noNameIndicators.length).toBeGreaterThan(0);

      // Edit buttons only show when kit is in editable mode (default is false)
      expect(screen.queryAllByTitle("Edit voice name").length).toBe(0);
    });

    it("shows edit buttons when kit is in editable mode", async () => {
      // Mock kit with editable: true
      const mockLogic = {
        ...createMockLogic(),
        kit: { ...createMockLogic().kit, editable: true },
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // Edit buttons should show when kit is editable
      await waitFor(() => {
        expect(screen.getAllByTitle("Edit voice name").length).toBeGreaterThan(
          0,
        );
      });
    });

    it("displays voice names from kit voices", async () => {
      // Create a new mock with explicit voice names
      const mockLogic = {
        ...createMockLogic(),
        kit: {
          alias: null,
          artist: null,
          bank_letter: "T",
          editable: false,
          locked: false,
          name: "TestKit",
          step_pattern: null,
          voices: [
            {
              id: 1,
              kit_name: "TestKit",
              voice_alias: "Kick",
              voice_number: 1,
            },
            {
              id: 2,
              kit_name: "TestKit",
              voice_alias: "Snare",
              voice_number: 2,
            },
            { id: 3, kit_name: "TestKit", voice_alias: "Hat", voice_number: 3 },
            { id: 4, kit_name: "TestKit", voice_alias: "Tom", voice_number: 4 },
          ],
        },
      };

      // Ensure our mock is correctly set up
      console.log("Mock kit:", mockLogic.kit);

      // Clear previous calls and set return value
      mockUseKitDetailsLogic.mockImplementation(() => mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // Debug: log what's actually rendered
      const voicePanel = await screen.findByTestId("voice-name-1");
      console.log("Voice panel content:", voicePanel.textContent);

      expect(voicePanel).toHaveTextContent("Kick");
      expect(screen.getByTestId("voice-name-2")).toHaveTextContent("Snare");
      expect(screen.getByTestId("voice-name-3")).toHaveTextContent("Hat");
      expect(screen.getByTestId("voice-name-4")).toHaveTextContent("Tom");
    });
  });

  describe("UI structure", () => {
    it("always shows all four voices, even if no names", async () => {
      // Default mocks already have empty voice names
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );
      expect(await screen.findByTestId("voice-name-1")).toBeInTheDocument();
      expect(screen.getByTestId("voice-name-2")).toBeInTheDocument();
      expect(screen.getByTestId("voice-name-3")).toBeInTheDocument();
      expect(screen.getByTestId("voice-name-4")).toBeInTheDocument();
    });
  });

  describe("Editable Mode Integration - Task 5.1", () => {
    it("passes editable mode toggle function to KitHeader", async () => {
      const mockToggleEditableMode = vi.fn();
      const mockLogic = {
        ...createMockLogic(),
        kit: { ...createMockLogic().kit, editable: true },
        toggleEditableMode: mockToggleEditableMode,
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // KitHeader should receive the toggle function and current editable state
      expect(screen.getByText("Editable")).toBeInTheDocument();

      // Click the toggle button
      const toggleButton = screen.getByRole("button", {
        name: /disable editable mode/i,
      });
      fireEvent.click(toggleButton);

      expect(mockToggleEditableMode).toHaveBeenCalledOnce();
    });

    it("passes correct editable state to KitVoicePanels", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: { ...createMockLogic().kit, editable: true },
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // KitVoicePanels should receive isEditable={true}
      // This would be reflected in the voice panel edit buttons being visible
      await waitFor(() => {
        expect(screen.getAllByTitle("Edit voice name").length).toBeGreaterThan(
          0,
        );
      });
    });

    it("disables editing when editable mode is off", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: { ...createMockLogic().kit, editable: false },
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // KitHeader should show "Locked" state
      expect(screen.getByText("Locked")).toBeInTheDocument();

      // Edit buttons should not be visible when kit is not editable
      expect(screen.queryAllByTitle("Edit voice name").length).toBe(0);
    });

    it("shows editable toggle in header when kit is loaded", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: { ...createMockLogic().kit, editable: false },
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // Toggle should be visible with correct state
      const toggleButton = screen.getByRole("button", {
        name: /enable editable mode/i,
      });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveClass("bg-gray-300");
    });

    it("handles null kit gracefully", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: null,
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // Should not crash and should handle isEditable defaulting to false
      expect(screen.getByText("Locked")).toBeInTheDocument();
    });

    it("reflects editable state changes through rerendering", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: { ...createMockLogic().kit, editable: false },
      };
      const mockUseKitDetailsLogicInstance = (
        useKitDetailsLogic as Mock
      ).mockReturnValue(mockLogic);

      const { rerender } = renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // Initially locked
      expect(screen.getByText("Locked")).toBeInTheDocument();

      // Update mock to return editable: true
      const updatedMockLogic = {
        ...mockLogic,
        kit: { ...mockLogic.kit, editable: true },
      };
      mockUseKitDetailsLogicInstance.mockReturnValue(updatedMockLogic);

      rerender(
        <TestSettingsProvider>
          <KitDetails
            kitName="TestKit"
            onBack={() => {}}
            onMessage={vi.fn()}
            samples={{ 1: [], 2: [], 3: [], 4: [] }}
          />
        </TestSettingsProvider>,
      );

      // Should now show editable
      expect(screen.getByText("Editable")).toBeInTheDocument();
    });
  });

  describe("UnscannedKitPrompt visibility", () => {
    it("does not show scanning prompt when kit has no samples", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: {
          ...createMockLogic().kit,
          voices: [], // Empty voices
        },
        samples: { 1: [], 2: [], 3: [], 4: [] }, // No samples
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // UnscannedKitPrompt should not be rendered when there are no samples to scan
      expect(screen.queryByText(/kit needs scanning/i)).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("unscanned-scan-button"),
      ).not.toBeInTheDocument();
    });

    it("shows scanning prompt when kit has samples but no voice aliases", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: {
          ...createMockLogic().kit,
          voices: [
            { id: 1, kit_name: "TestKit", voice_alias: null, voice_number: 1 },
            { id: 2, kit_name: "TestKit", voice_alias: null, voice_number: 2 },
          ],
        },
        playback: {
          ...createMockLogic().playback,
          samplePlaying: { "1:sample1.wav": false, "2:sample2.wav": false }, // Mock playback state
        },
        samples: { 1: ["sample1.wav"], 2: ["sample2.wav"], 3: [], 4: [] }, // Has samples
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: ["sample1.wav"], 2: ["sample2.wav"], 3: [], 4: [] }}
        />,
      );

      // UnscannedKitPrompt should be rendered when there are samples but no voice aliases
      await waitFor(() => {
        expect(screen.getByText(/kit needs scanning/i)).toBeInTheDocument();
        expect(screen.getByTestId("unscanned-scan-button")).toBeInTheDocument();
      });
    });

    it("does not show scanning prompt when kit has samples and voice aliases", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: {
          ...createMockLogic().kit,
          voices: [
            {
              id: 1,
              kit_name: "TestKit",
              voice_alias: "Kick",
              voice_number: 1,
            },
            {
              id: 2,
              kit_name: "TestKit",
              voice_alias: "Snare",
              voice_number: 2,
            },
          ],
        },
        playback: {
          ...createMockLogic().playback,
          samplePlaying: { "1:sample1.wav": false, "2:sample2.wav": false }, // Mock playback state
        },
        samples: { 1: ["sample1.wav"], 2: ["sample2.wav"], 3: [], 4: [] }, // Has samples
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: ["sample1.wav"], 2: ["sample2.wav"], 3: [], 4: [] }}
        />,
      );

      // UnscannedKitPrompt should not be rendered when kit has samples and voice aliases
      expect(screen.queryByText(/kit needs scanning/i)).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("unscanned-scan-button"),
      ).not.toBeInTheDocument();
    });
  });

  // NOTE: Unscanned kit prompt feature was removed during database migration
});
