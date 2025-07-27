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

// Helper to create a basic electronAPI mock
function mockElectronAPI() {
  (window as any).electronAPI = {
    onSamplePlaybackEnded: vi.fn(),
    onSamplePlaybackError: vi.fn(),
    getKitMetadata: vi.fn().mockResolvedValue({ success: true, data: null }),
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
    metadata: {
      handleSaveVoiceName: vi.fn(),
      handleRescanVoiceName: vi.fn(),
      handleRescanAllVoiceNames: vi.fn(),
      handleFullKitScan: vi.fn(),
      kitLabel: { voiceNames: { 1: "", 2: "", 3: "", 4: "" } },
      setKitLabel: vi.fn(),
      labelsLoading: false,
      labelsError: null,
      editingKitLabel: false,
      setEditingKitLabel: vi.fn(),
      kitLabelInput: "",
      setKitLabelInput: vi.fn(),
      handleSaveKitLabel: vi.fn(),
      handleSaveKitTags: vi.fn(),
      handleSaveKitMetadata: vi.fn(),
      reloadKitLabel: vi.fn(),
      stepPattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
      setStepPattern: vi.fn(),
      ...overrides,
    },
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
    it("shows edit/rescan controls and a no-name indicator if no voice name is set", async () => {
      // Default mocks already have empty voice names
      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          localStorePath="/sd"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
        />,
      );
      const noNameIndicators = await screen.findAllByText("No voice name set");
      expect(noNameIndicators.length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Edit voice name").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Rescan voice name").length).toBeGreaterThan(
        0,
      );
    });

    it("displays voice names from the kitLabel", async () => {
      // Create a new mock with explicit voice names
      const mockLogic = {
        ...createMockLogic(),
        metadata: {
          ...createMockLogic().metadata,
          kitLabel: {
            voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" },
          },
        },
      };

      // Ensure our mock is correctly set up
      console.log("Mock kit label:", mockLogic.metadata.kitLabel);

      // Clear previous calls and set return value
      mockUseKitDetailsLogic.mockReset();
      mockUseKitDetailsLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="TestKit"
          localStorePath="/sd"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={() => {}}
          onMessage={vi.fn()}
        />,
      );
      expect(await screen.findByTestId("voice-name-1")).toHaveTextContent(
        "Kick",
      );
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
          localStorePath="/sd"
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

  describe("unscanned kit prompt", () => {
    it("shows the prompt if the kit is unscanned", async () => {
      // Mock the kit as unscanned
      const mockLogic = {
        metadata: {
          kitLabel: { label: "Test Kit", voiceNames: {} }, // No voice names = unscanned
          editingKitLabel: false,
          kitLabelInput: "Test Kit",
          labelsLoading: false,
          setEditingKitLabel: vi.fn(),
          setKitLabelInput: vi.fn(),
          handleSaveKitLabel: vi.fn(),
          handleRescanAllVoiceNames: vi.fn(),
          handleRescanVoiceName: vi.fn(),
        },
        samples: { 1: [], 2: [], 3: [], 4: [] },
        handleScanKit: vi.fn(),
        selectedVoice: 1,
        selectedSampleIdx: 0,
        sequencerOpen: false,
        setSelectedVoice: vi.fn(),
        setSelectedSampleIdx: vi.fn(),
        setSequencerOpen: vi.fn(),
        sequencerGridRef: { current: null },
        playback: {
          playbackError: null,
          playTriggers: {},
          stopTriggers: {},
          samplePlaying: null,
          handlePlay: vi.fn(),
          handleStop: vi.fn(),
          handleWaveformPlayingChange: vi.fn(),
        },
        kitVoicePanels: {
          onKeyNavigation: vi.fn(),
          focusedSlotRef: { current: null },
          handleSlotClick: vi.fn(),
          samples: { 1: [], 2: [], 3: [], 4: [] },
          selectedVoice: 1,
          selectedSampleIdx: 0,
          setSelectedVoice: vi.fn(),
          setSelectedSampleIdx: vi.fn(),
        },
        stepSequencer: {
          stepPattern: Array(64).fill(0),
          handleStepToggle: vi.fn(),
          playbackActive: false,
          handlePlayToggle: vi.fn(),
          currentStep: -1,
        },
      };

      mockUseKitDetailsLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="UnscannedKit"
          localStorePath="/sd"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={vi.fn()}
          onMessage={vi.fn()}
        />,
      );

      // Prompt should be shown
      expect(
        await screen.findByTestId("unscanned-kit-prompt"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("unscanned-kit-name")).toHaveTextContent(
        "UnscannedKit",
      );
    });

    it("calls handleScanKit when Scan Now button is clicked", async () => {
      const handleScanKit = vi.fn();

      // Mock the kit as unscanned
      const mockLogic = {
        metadata: {
          kitLabel: { label: "Test Kit", voiceNames: {} }, // No voice names = unscanned
          editingKitLabel: false,
          kitLabelInput: "Test Kit",
          labelsLoading: false,
          setEditingKitLabel: vi.fn(),
          setKitLabelInput: vi.fn(),
          handleSaveKitLabel: vi.fn(),
          handleRescanAllVoiceNames: vi.fn(),
          handleRescanVoiceName: vi.fn(),
        },
        samples: { 1: [], 2: [], 3: [], 4: [] },
        handleScanKit,
        selectedVoice: 1,
        selectedSampleIdx: 0,
        sequencerOpen: false,
        setSelectedVoice: vi.fn(),
        setSelectedSampleIdx: vi.fn(),
        setSequencerOpen: vi.fn(),
        sequencerGridRef: { current: null },
        playback: {
          playbackError: null,
          playTriggers: {},
          stopTriggers: {},
          samplePlaying: null,
          handlePlay: vi.fn(),
          handleStop: vi.fn(),
          handleWaveformPlayingChange: vi.fn(),
        },
        kitVoicePanels: {
          onKeyNavigation: vi.fn(),
          focusedSlotRef: { current: null },
          handleSlotClick: vi.fn(),
          samples: { 1: [], 2: [], 3: [], 4: [] },
          selectedVoice: 1,
          selectedSampleIdx: 0,
          setSelectedVoice: vi.fn(),
          setSelectedSampleIdx: vi.fn(),
        },
        stepSequencer: {
          stepPattern: Array(64).fill(0),
          handleStepToggle: vi.fn(),
          playbackActive: false,
          handlePlayToggle: vi.fn(),
          currentStep: -1,
        },
      };

      mockUseKitDetailsLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="UnscannedKit"
          localStorePath="/sd"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={vi.fn()}
          onMessage={vi.fn()}
        />,
      );

      // Click the Scan Now button
      const scanButton = await screen.findByTestId("unscanned-scan-button");
      fireEvent.click(scanButton);

      // Check that handleScanKit was called
      expect(handleScanKit).toHaveBeenCalledTimes(1);
    });

    // NOTE: Unscanned kit prompt feature was removed during database migration

    it("does not show the prompt if the kit is already scanned", async () => {
      // Mock the kit as scanned
      const mockLogic = {
        metadata: {
          kitLabel: {
            label: "Test Kit",
            voiceNames: { 1: "Kick", 2: "Snare", 3: "Hi-Hat", 4: "Tom" }, // Has voice names = scanned
          },
          editingKitLabel: false,
          kitLabelInput: "Test Kit",
          labelsLoading: false,
          setEditingKitLabel: vi.fn(),
          setKitLabelInput: vi.fn(),
          handleSaveKitLabel: vi.fn(),
          handleRescanAllVoiceNames: vi.fn(),
          handleRescanVoiceName: vi.fn(),
        },
        samples: { 1: [], 2: [], 3: [], 4: [] },
        handleScanKit: vi.fn(),
        selectedVoice: 1,
        selectedSampleIdx: 0,
        sequencerOpen: false,
        setSelectedVoice: vi.fn(),
        setSelectedSampleIdx: vi.fn(),
        setSequencerOpen: vi.fn(),
        sequencerGridRef: { current: null },
        playback: {
          playbackError: null,
          playTriggers: {},
          stopTriggers: {},
          samplePlaying: null,
          handlePlay: vi.fn(),
          handleStop: vi.fn(),
          handleWaveformPlayingChange: vi.fn(),
        },
        kitVoicePanels: {
          onKeyNavigation: vi.fn(),
          focusedSlotRef: { current: null },
          handleSlotClick: vi.fn(),
          samples: { 1: [], 2: [], 3: [], 4: [] },
          selectedVoice: 1,
          selectedSampleIdx: 0,
          setSelectedVoice: vi.fn(),
          setSelectedSampleIdx: vi.fn(),
        },
        stepSequencer: {
          stepPattern: Array(64).fill(0),
          handleStepToggle: vi.fn(),
          playbackActive: false,
          handlePlayToggle: vi.fn(),
          currentStep: -1,
        },
      };

      mockUseKitDetailsLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitDetails
          kitName="ScannedKit"
          localStorePath="/sd"
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
          onBack={vi.fn()}
          onMessage={vi.fn()}
        />,
      );

      // Prompt should not be shown
      await waitFor(() => {
        expect(
          screen.queryByTestId("unscanned-kit-prompt"),
        ).not.toBeInTheDocument();
      });
    });
  });
});
