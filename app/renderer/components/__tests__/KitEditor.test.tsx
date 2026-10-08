import type { KitWithRelations } from "@romper/shared/db/schema";

import { fireEvent, screen, waitFor } from "@testing-library/react";
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

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { createMockVoice } from "../../../../tests/factories/voice.factory";
import { TestSettingsProvider } from "../../../../tests/providers/TestSettingsProvider";
import { render } from "../../../../tests/utils/renderWithProviders";
import KitEditor from "../KitEditor";

// Mock modules before importing them
vi.mock("../hooks/kit-management/useKitEditorLogic", () => ({
  useKitEditorLogic: vi.fn(),
}));

// UnscannedKitPrompt feature was removed during database migration

import { createSlotPlaybackStore } from "../hooks/kit-management/slotPlaybackStore";
// Import after mocking and access the mocked function
import { useKitEditorLogic } from "../hooks/kit-management/useKitEditorLogic";
import { createDefaultTriggerConditions } from "../hooks/shared/stepPatternConstants";
const mockUseKitEditorLogic = vi.mocked(useKitEditorLogic);

type KitEditorLogic = ReturnType<typeof useKitEditorLogic>;

// Helper to create default mock logic
function createMockLogic(
  overrides: Partial<KitEditorLogic> = {},
): KitEditorLogic {
  const kit = createTestKit();
  const samples = { 1: [], 2: [], 3: [], 4: [] };
  const slotPlayback = createSlotPlaybackStore();
  return {
    flashVoices: new Set(),
    handleInferVoiceNames: vi.fn(),
    handleScanKit: vi.fn(),
    // Kit data from useKitEditorLogic
    kit,
    kitError: null,
    kitLoading: false,
    kitVoicePanels: {
      kit,
      kitName: "TestKit",
      onPlay: vi.fn(),
      onSampleKeyNav: vi.fn(),
      onSampleSelect: vi.fn(),
      onSaveVoiceName: vi.fn(),
      onStop: vi.fn(),
      onWaveformPlayingChange: vi.fn(),
      samples,
      selectedSampleIdx: 0,
      selectedVoice: 1,
      slotPlayback,
    },
    playback: {
      handlePlay: vi.fn(),
      handleStop: vi.fn(),
      handleWaveformPlayingChange: vi.fn(),
      playbackError: null,
      slotPlayback,
    },
    reloadKit: vi.fn(),
    sampleManagement: {
      handleSampleAdd: vi.fn(),
      handleSampleDelete: vi.fn(),
      handleSampleMove: vi.fn(),
    },
    samples,
    scanStatus: { status: "idle" },
    selectedSampleIdx: 0,
    selectedVoice: 1,
    sequencerGridRef: { current: null },
    sequencerOpen: false,
    setSelectedSampleIdx: vi.fn(),
    setSelectedVoice: vi.fn(),
    setSequencerOpen: vi.fn(),
    setStepPattern: vi.fn(),
    setTriggerConditions: vi.fn(),
    stepPattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
    toggleEditableMode: vi.fn(),
    toggleFavorite: vi.fn(),
    triggerConditions: createDefaultTriggerConditions(),
    updateKitAlias: vi.fn(),
    updateVoiceAlias: vi.fn(),
    ...overrides,
  };
}

// The test kit, with its four voices named by `aliases`
function createTestKit(
  overrides: Partial<KitWithRelations> = {},
  aliases: (null | string)[] = [null, null, null, null],
): KitWithRelations {
  return createMockKitWithRelations({
    bank_letter: "T",
    name: "TestKit",
    voices: aliases.map((voice_alias, i) =>
      createMockVoice({
        id: i + 1,
        kit_name: "TestKit",
        voice_alias,
        voice_number: i + 1,
      }),
    ),
    ...overrides,
  });
}

// Helper to render components with TestSettingsProvider
function renderWithSettings(component: React.ReactElement) {
  return render(<TestSettingsProvider>{component}</TestSettingsProvider>);
}

// Helper to set up specific mock behaviors for this test
function setupElectronAPIMocks() {
  vi.mocked(globalThis.electronAPI.updateKit).mockResolvedValue({
    success: true,
  });
  vi.mocked(globalThis.electronAPI.updateVoiceAlias).mockResolvedValue({
    success: true,
  });
  vi.mocked(globalThis.electronAPI.updateStepPattern).mockResolvedValue({
    success: true,
  });
}

describe("KitEditor", () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  beforeEach(() => {
    setupElectronAPIMocks();
    // Reset mock implementation to default
    mockUseKitEditorLogic.mockClear();
    mockUseKitEditorLogic.mockReturnValue(createMockLogic());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("voice name controls", () => {
    it("shows no-name indicator when no voice name is set", async () => {
      // Default mocks already have empty voice names
      renderWithSettings(
        <KitEditor
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
      const mockLogic = createMockLogic({
        kit: createTestKit({ editable: true }),
      });
      mockUseKitEditorLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitEditor
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
      const mockLogic = createMockLogic({
        kit: createTestKit({}, ["Kick", "Snare", "Hat", "Tom"]),
      });

      // Ensure our mock is correctly set up
      console.log("Mock kit:", mockLogic.kit);

      // Clear previous calls and set return value
      mockUseKitEditorLogic.mockImplementation(() => mockLogic);

      renderWithSettings(
        <KitEditor
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
        <KitEditor
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
      const mockLogic = createMockLogic({
        kit: createTestKit({ editable: true }),
        toggleEditableMode: mockToggleEditableMode,
      });
      mockUseKitEditorLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitEditor
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
      const mockLogic = createMockLogic({
        kit: createTestKit({ editable: true }),
      });
      mockUseKitEditorLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitEditor
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
      const mockLogic = createMockLogic({
        kit: createTestKit({ editable: false }),
      });
      mockUseKitEditorLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitEditor
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
      const mockLogic = createMockLogic({
        kit: createTestKit({ editable: false }),
      });
      mockUseKitEditorLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitEditor
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
      expect(toggleButton).toHaveClass("bg-surface-3");
    });

    it("handles null kit gracefully", async () => {
      const mockLogic = createMockLogic({ kit: null });
      mockUseKitEditorLogic.mockReturnValue(mockLogic);

      renderWithSettings(
        <KitEditor
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
      const mockLogic = createMockLogic({
        kit: createTestKit({ editable: false }),
      });
      const mockUseKitEditorLogicInstance =
        mockUseKitEditorLogic.mockReturnValue(mockLogic);

      const { rerender } = renderWithSettings(
        <KitEditor
          kitName="TestKit"
          onBack={() => {}}
          onMessage={vi.fn()}
          samples={{ 1: [], 2: [], 3: [], 4: [] }}
        />,
      );

      // Initially locked
      expect(screen.getByText("Locked")).toBeInTheDocument();

      // Update mock to return editable: true
      const updatedMockLogic = createMockLogic({
        kit: createTestKit({ editable: true }),
      });
      mockUseKitEditorLogicInstance.mockReturnValue(updatedMockLogic);

      rerender(
        <TestSettingsProvider>
          <KitEditor
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

  // UnscannedKitPrompt was removed — scanning is handled via
  // File > Scan All, the KitHeader scan button, and the validation dialog.
});
