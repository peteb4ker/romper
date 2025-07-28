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

import { SettingsProvider } from "../../utils/SettingsContext";
import KitDetails from "../KitDetails";

// Mock modules before importing them
vi.mock("../hooks/useKitDetailsLogic", () => ({
  useKitDetailsLogic: vi.fn(),
}));

// UnscannedKitPrompt feature was removed during database migration

// Import after mocking and access the mocked function
import { useKitDetailsLogic } from "../hooks/useKitDetailsLogic";
const mockUseKitDetailsLogic = useKitDetailsLogic as ReturnType<typeof vi.fn>;

// Add Mock type for TypeScript
type Mock = ReturnType<typeof vi.fn>;

// Helper to create a basic electronAPI mock
function mockElectronAPI() {
  (window as any).electronAPI = {
    onSamplePlaybackEnded: vi.fn(),
    onSamplePlaybackError: vi.fn(),
    getKit: vi.fn().mockResolvedValue({ success: true, data: null }),
    updateKit: vi.fn().mockResolvedValue({ success: true }),
    updateVoiceAlias: vi.fn().mockResolvedValue({ success: true }),
    updateStepPattern: vi.fn().mockResolvedValue({ success: true }),
  };
}

// Helper to render components with SettingsProvider
function renderWithSettings(component: React.ReactElement) {
  return render(<SettingsProvider>{component}</SettingsProvider>);
}

// Helper to create default mock logic
function createMockLogic(overrides = {}) {
  return {
    samples: { 1: [], 2: [], 3: [], 4: [] },
    selectedVoice: 1,
    selectedSampleIdx: 0,
    sequencerOpen: false,
    sequencerGridRef: { current: null },
    setSelectedVoice: vi.fn(),
    setSelectedSampleIdx: vi.fn(),
    setSequencerOpen: vi.fn(),
    handleScanKit: vi.fn(),
    playback: {
      playbackError: null,
      playTriggers: {},
      stopTriggers: {},
      samplePlaying: null,
      handlePlay: vi.fn(),
      handleStop: vi.fn(),
      handleWaveformPlayingChange: vi.fn(),
    },
    // Kit data from useKitDetailsLogic
    kit: {
      name: "TestKit",
      bank_letter: "T",
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      step_pattern: null,
      voices: [
        { id: 1, kit_name: "TestKit", voice_number: 1, voice_alias: null },
        { id: 2, kit_name: "TestKit", voice_number: 2, voice_alias: null },
        { id: 3, kit_name: "TestKit", voice_number: 3, voice_alias: null },
        { id: 4, kit_name: "TestKit", voice_number: 4, voice_alias: null },
      ],
    },
    stepPattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
    setStepPattern: vi.fn(),
    updateKitAlias: vi.fn(),
    updateVoiceAlias: vi.fn(),
    toggleEditableMode: vi.fn(),
    kitLoading: false,
    kitError: null,
    reloadKit: vi.fn(),
    ...overrides,
    kitVoicePanels: {
      onSampleKeyNav: vi.fn(),
    },
  };
}

describe("KitDetails", () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as any;
  });

  beforeEach(() => {
    mockElectronAPI();
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
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
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
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
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
          name: "TestKit",
          bank_letter: "T",
          alias: null,
          artist: null,
          editable: false,
          locked: false,
          step_pattern: null,
          voices: [
            {
              id: 1,
              kit_name: "TestKit",
              voice_number: 1,
              voice_alias: "Kick",
            },
            {
              id: 2,
              kit_name: "TestKit",
              voice_number: 2,
              voice_alias: "Snare",
            },
            { id: 3, kit_name: "TestKit", voice_number: 3, voice_alias: "Hat" },
            { id: 4, kit_name: "TestKit", voice_number: 4, voice_alias: "Tom" },
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
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
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
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
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
        toggleEditableMode: mockToggleEditableMode,
        kit: { ...createMockLogic().kit, editable: true },
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
        />,
      );

      // KitHeader should receive the toggle function and current editable state
      expect(screen.getByText("Editable")).toBeInTheDocument();
      
      // Click the toggle button
      const toggleButton = screen.getByRole("button", { name: /disable editable mode/i });
      fireEvent.click(toggleButton);
      
      expect(mockToggleEditableMode).toHaveBeenCalledOnce();
    });

    it("passes correct editable state to KitVoicePanels", async () => {
      const mockLogic = {
        ...createMockLogic(),
        kit: { ...createMockLogic().kit, editable: true },
      };
      (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      const { container } = renderWithSettings(
        <KitDetails
          kitName="TestKit"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
        />,
      );

      // KitVoicePanels should receive isEditable={true}
      // This would be reflected in the voice panel edit buttons being visible
      await waitFor(() => {
        expect(screen.getAllByTitle("Edit voice name").length).toBeGreaterThan(0);
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
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
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
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
        />,
      );

      // Toggle should be visible with correct state
      const toggleButton = screen.getByRole("button", { name: /enable editable mode/i });
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
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
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
      const mockUseKitDetailsLogicInstance = (useKitDetailsLogic as Mock).mockReturnValue(mockLogic);

      const { rerender } = renderWithSettings(
        <KitDetails
          kitName="TestKit"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
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
        <KitDetails
          kitName="TestKit"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
        />,
      );

      // Should now show editable
      expect(screen.getByText("Editable")).toBeInTheDocument();
    });
  });

  // NOTE: Unscanned kit prompt feature was removed during database migration
});
