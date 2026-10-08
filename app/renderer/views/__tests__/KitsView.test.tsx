// Test suite for KitsView component
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Set up IntersectionObserver mock before any component imports
// This prevents race conditions with centralized mocks
class MockIntersectionObserver implements IntersectionObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  root = null;
  rootMargin = "0px";
  scrollMargin = "0px";
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
  thresholds: number[] = [0];
  unobserve = vi.fn();

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin || "0px";
    this.thresholds = options?.threshold ? [options.threshold].flat() : [0];
  }
}

globalThis.IntersectionObserver = MockIntersectionObserver;
if (typeof window !== "undefined") {
  window.IntersectionObserver = MockIntersectionObserver;
}

import React from "react";

import type { MenuEventHandlers } from "../../components/hooks/shared/useMenuEvents";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { createMockSample } from "../../../../tests/factories/sample.factory";
import { setupAudioMocks } from "../../../../tests/mocks/browser/audio";
import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { createMockSettings } from "../../../../tests/mocks/settings";
import { TestSettingsProvider } from "../../../../tests/providers/TestSettingsProvider";
import { useDialogState } from "../../components/hooks/shared/useDialogState";
import { useValidationResults } from "../../components/hooks/shared/useValidationResults";
import { SettingsContext } from "../../utils/SettingsContext";
import KitsView from "../KitsView";

// Mock the hooks used by KitsView
const mockOpenValidationDialog = vi.fn(async () => {});
const mockOpenWizard = vi.fn();
const mockOpenChangeDirectory = vi.fn();
const mockOpenPreferences = vi.fn();
const mockHandleScanAllKits = vi.fn();

// Removed unused search mocks since search is now handled by useKitSearch hook

// Store the menu callbacks globally for testing
let globalMenuCallbacks: MenuEventHandlers | null = null;

/** The handlers KitsView last passed to useMenuEvents. */
function menuCallbacks(): MenuEventHandlers {
  if (!globalMenuCallbacks) {
    throw new Error("useMenuEvents has not been called");
  }
  return globalMenuCallbacks;
}

vi.mock("../../components/hooks/shared/useMenuEvents", () => ({
  useMenuEvents: vi.fn((callbacks: MenuEventHandlers) => {
    // Store the callbacks for testing access
    globalMenuCallbacks = callbacks;
    // Register menu event listeners
    if (typeof window !== "undefined") {
      window.addEventListener("menu-scan-all-kits", () =>
        callbacks.onScanAll?.(),
      );
      window.addEventListener("menu-change-local-store-directory", () =>
        callbacks.onChangeLocalStoreDirectory?.(),
      );
      window.addEventListener("menu-preferences", () =>
        callbacks.onPreferences?.(),
      );
      window.addEventListener("menu-about", () => callbacks.onAbout?.());
    }
  }),
}));

vi.mock("../../components/hooks/shared/useValidationResults", () => ({
  useValidationResults: vi.fn(() => ({
    closeValidationDialog: vi.fn(),
    isLoading: false,
    isOpen: false,
    openValidationDialog: mockOpenValidationDialog,
    validationResult: null,
  })),
}));

const mockShowMessage = vi.fn();
vi.mock("../../components/hooks/shared/useMessageApi", () => ({
  useMessageApi: vi.fn(() => ({
    showMessage: mockShowMessage,
  })),
}));

vi.mock("../../components/hooks/shared/useDialogState", () => ({
  useDialogState: vi.fn(() => {
    const [showWizard, setShowWizard] = React.useState(false);
    const [showChangeDirectory, setShowChangeDirectory] = React.useState(false);
    const [showPreferences, setShowPreferences] = React.useState(false);

    return {
      closeChangeDirectory: () => setShowChangeDirectory(false),
      closePreferences: () => setShowPreferences(false),
      closeWizard: () => setShowWizard(false),
      openChangeDirectory: mockOpenChangeDirectory,
      openPreferences: mockOpenPreferences,
      openWizard: mockOpenWizard,
      setShowChangeDirectory,
      setShowPreferences,
      setShowWizard,
      showChangeDirectoryDialog: showChangeDirectory,
      showPreferencesDialog: showPreferences,
      showWizard,
    };
  }),
}));

// Don't mock useKitViewMenuHandlers - let it run real logic with mocked dependencies
// This way it will call the actual functions we pass in (which we can spy on)

// We need to get the actual mocked functions for verification
const _mockUseValidationResults = vi.mocked(useValidationResults);
const _mockUseDialogState = vi.mocked(useDialogState);

vi.mock("../../components/LocalStoreWizardUI", () => ({
  default: vi.fn(({ onClose, onSuccess }) => (
    <div data-testid="local-store-wizard-ui">
      <button onClick={onClose}>Cancel</button>
      <button onClick={onSuccess}>Complete Setup</button>
    </div>
  )),
}));

describe("KitsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Re-setup electronAPI mock after clearAllMocks
    setupElectronAPIMock();

    // Setup audio mocks for SampleWaveform component
    setupAudioMocks();

    // Create mock for console methods
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    // Refresh the IntersectionObserver mock before each test
    globalThis.IntersectionObserver = MockIntersectionObserver;
    if (typeof window !== "undefined") {
      window.IntersectionObserver = MockIntersectionObserver;
    }

    // Mock electronAPI methods using centralized mocks
    // getKits() carries each kit's samples inline — the hook no longer
    // fetches samples kit-by-kit at load time.
    const defaultSamples = [
      createMockSample({
        filename: "kick.wav",
        slot_number: 100,
        voice_number: 1,
      }),
      createMockSample({
        filename: "snare.wav",
        slot_number: 100,
        voice_number: 2,
      }),
    ];
    vi.mocked(window.electronAPI.getKits).mockResolvedValue({
      data: [
        createMockKitWithRelations({
          alias: null,
          bank_letter: "A",
          editable: false,
          name: "A0",
          samples: defaultSamples,
        }),
        createMockKitWithRelations({
          alias: null,
          bank_letter: "A",
          editable: false,
          name: "A1",
          samples: defaultSamples,
        }),
        createMockKitWithRelations({
          alias: null,
          bank_letter: "B",
          editable: false,
          name: "B0",
          samples: defaultSamples,
        }),
      ],
      success: true,
    });
    vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
      data: [
        createMockSample({
          filename: "kick.wav",
          slot_number: 100,
          voice_number: 1,
        }),
        createMockSample({
          filename: "snare.wav",
          slot_number: 100,
          voice_number: 2,
        }),
      ],
      success: true,
    });
    vi.mocked(window.electronAPI.closeApp).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalMenuCallbacks = null;
  });

  describe("Component rendering", () => {
    it("renders KitBrowser with kits", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );
      // There may be multiple elements with the same kit label, so use findAllByText
      const kitA0s = await screen.findAllByText("A0");
      const kitA1s = await screen.findAllByText("A1");
      expect(kitA0s.length).toBeGreaterThan(0);
      expect(kitA1s.length).toBeGreaterThan(0);
    });

    it("renders KitEditor when a kit is selected", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for kits to load and click on a kit
      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("A0"));

      // Should show KitEditor view
      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });
    });
  });

  describe("Kit navigation", () => {
    it("handles kit selection correctly", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // Click on kit A0
      fireEvent.click(screen.getByText("A0"));

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });
    });

    it("handles back navigation from kit editor", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // Select a kit
      fireEvent.click(screen.getByText("A0"));

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });

      // Click back button
      fireEvent.click(screen.getByText("Back"));

      // Should return to kit browser
      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });
    });
  });

  describe("Menu event handlers", () => {
    beforeEach(() => {
      // Reset all mock functions before each test
      mockOpenChangeDirectory.mockClear();
      mockOpenPreferences.mockClear();
      mockHandleScanAllKits.mockClear();
    });

    it("handles scan all kits menu event", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for component to render and callbacks to be set up
      await waitFor(() => {
        expect(globalMenuCallbacks).not.toBeNull();
      });

      // Trigger the unified scan all callback
      menuCallbacks().onScanAll?.();

      // Every kit
      await waitFor(() => {
        expect(window.electronAPI.rescanKit).toHaveBeenCalledTimes(3);
      });
      expect(confirm).toHaveBeenCalledTimes(1);
      confirm.mockRestore();
    });

    it("[UC-13] scans every kit while a search filters the grid (RE-43)", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );
      await screen.findAllByText("B0");

      fireEvent.change(screen.getByLabelText("Search kits"), {
        target: { value: "B0" },
      });
      await waitFor(() => {
        expect(screen.queryAllByText("A1")).toHaveLength(0);
      });

      menuCallbacks().onScanAll?.();

      await waitFor(() => {
        expect(window.electronAPI.rescanKit).toHaveBeenCalledTimes(3);
      });
      const scanned = vi
        .mocked(window.electronAPI.rescanKit)
        .mock.calls.map(([kitName]) => kitName);
      expect(scanned.sort()).toEqual(["A0", "A1", "B0"]);
      confirm.mockRestore();
    });

    it("[UC-13] scans every kit from the kit editor and reports the result (RE-43)", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );
      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("A0"));
      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });

      menuCallbacks().onScanAll?.();

      await waitFor(() => {
        expect(mockShowMessage).toHaveBeenCalledWith(
          expect.stringContaining("All 3 kits scanned"),
          "success",
        );
      });
      expect(window.electronAPI.rescanKit).toHaveBeenCalledTimes(3);
      confirm.mockRestore();
    });

    it("[UC-13] warns from the kit editor when some kits fail to scan", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      vi.mocked(window.electronAPI.rescanKit).mockImplementation(
        async (kitName: string) =>
          kitName === "A1"
            ? { error: "folder missing", success: false }
            : {
                data: {
                  addedSamples: 0,
                  locked: false,
                  metadataUpdated: 0,
                  missingSamples: [],
                  scannedSamples: 0,
                  skippedFiles: [],
                  updatedVoices: 0,
                },
                success: true,
              },
      );
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );
      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("A0"));
      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });

      menuCallbacks().onScanAll?.();

      await waitFor(() => {
        expect(mockShowMessage).toHaveBeenCalledWith(
          expect.stringContaining("2 successful, 1 failed. A1: folder missing"),
          "warning",
        );
      });
      expect(mockShowMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("failed"),
        "success",
      );
      confirm.mockRestore();
    });

    it("[UC-13] leaves the result to the browser header when the browser is open", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );
      await screen.findAllByText("A0");

      menuCallbacks().onScanAll?.();

      expect(await screen.findByTestId("bulk-scan-complete")).toHaveTextContent(
        "All 3 kits scanned",
      );
      expect(mockShowMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("kits scanned"),
        expect.anything(),
      );
      confirm.mockRestore();
    });

    it("does not scan when Scan All is not confirmed", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for component to render and callbacks to be set up
      await waitFor(() => {
        expect(globalMenuCallbacks).not.toBeNull();
      });

      // Trigger the unified scan all callback
      menuCallbacks().onScanAll?.();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(window.electronAPI.rescanKit).not.toHaveBeenCalled();
      confirm.mockRestore();
    });

    it("handles change local store directory menu event", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for component to render and callbacks to be set up
      await waitFor(() => {
        expect(globalMenuCallbacks).not.toBeNull();
      });

      // Trigger the menu callback directly
      menuCallbacks().onChangeLocalStoreDirectory?.();

      await waitFor(() => {
        expect(mockOpenChangeDirectory).toHaveBeenCalled();
      });
    });

    it("handles preferences menu event", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for component to render and callbacks to be set up
      await waitFor(() => {
        expect(globalMenuCallbacks).not.toBeNull();
      });

      // Trigger the menu callback directly
      menuCallbacks().onPreferences?.();

      await waitFor(() => {
        expect(mockOpenPreferences).toHaveBeenCalled();
      });
    });
  });

  describe("Data loading", () => {
    it("loads kits and samples from database", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(window.electronAPI.getKits).toHaveBeenCalled();
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // Samples arrive inline on getKits(); no per-kit fetching at load
      expect(window.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("handles database errors gracefully", async () => {
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        error: "Database connection failed",
        success: false,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(window.electronAPI.getKits).toHaveBeenCalled();
      });
    });

    it("handles kits without sample data gracefully", async () => {
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: false,
            name: "A0",
            samples: undefined,
          }),
        ],
        success: true,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(window.electronAPI.getKits).toHaveBeenCalled();
        expect(screen.getByText("A0")).toBeInTheDocument();
      });
    });
  });

  // #605: opening a kit loads its samples when they aren't loaded; if they
  // can't be, the kit shows locked, like a non-editable kit, with a message
  describe("[UC-07] opening a kit whose samples aren't loaded", () => {
    const listUnloadedA0 = () =>
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            editable: true,
            name: "A0",
            samples: undefined,
          }),
        ],
        success: true,
      });

    // getKit reloads one kit with its samples (#452)
    const kitA0With = (samples: ReturnType<typeof createMockSample>[]) => ({
      data: createMockKitWithRelations({ editable: true, name: "A0", samples }),
      success: true as const,
    });

    const openA0 = async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );
      fireEvent.click(await screen.findByText("A0"));
      await screen.findByText("Back");
    };

    it("loads them", async () => {
      listUnloadedA0();
      vi.mocked(window.electronAPI.getKit).mockResolvedValue(
        kitA0With([
          createMockSample({
            filename: "kick.wav",
            slot_number: 0,
            voice_number: 1,
          }),
        ]),
      );

      await openA0();

      // The voice panels show the samples the open loaded
      expect(
        await within(screen.getByTestId("sample-list-voice-1")).findByRole(
          "option",
          { name: /kick\.wav/ },
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Editable")).toBeInTheDocument();
      expect(mockShowMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("Couldn't load"),
        "error",
      );
    });

    it("shows the kit locked and says so when they can't be loaded", async () => {
      listUnloadedA0();
      vi.mocked(window.electronAPI.getKit).mockResolvedValue({
        error: "database is locked",
        success: false,
      });

      await openA0();

      await waitFor(() => {
        expect(mockShowMessage).toHaveBeenCalledWith(
          "Couldn't load the samples for kit A0. Try reopening it.",
          "error",
        );
      });
      expect(await screen.findByText("Locked")).toBeInTheDocument();
    });
  });

  describe("Sample data processing", () => {
    it("correctly groups samples by voice", async () => {
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: false,
            name: "A0",
            samples: [
              createMockSample({
                filename: "kick.wav",
                slot_number: 0,
                voice_number: 1,
              }),
              createMockSample({
                filename: "snare.wav",
                slot_number: 0,
                voice_number: 2,
              }),
              createMockSample({
                filename: "hat.wav",
                slot_number: 1,
                voice_number: 1,
              }),
              createMockSample({
                filename: "stereo.wav",
                slot_number: 0,
                voice_number: 3,
              }),
            ],
          }),
        ],
        success: true,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(window.electronAPI.getKits).toHaveBeenCalled();
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("A0"));
      const voice = (n: number) =>
        within(screen.getByTestId(`sample-list-voice-${n}`));
      expect(
        await voice(1).findByRole("option", {
          name: "Sample kick.wav in slot 1",
        }),
      ).toBeInTheDocument();
      expect(
        voice(1).getByRole("option", { name: "Sample hat.wav in slot 2" }),
      ).toBeInTheDocument();
      expect(
        voice(2).getByRole("option", { name: "Sample snare.wav in slot 1" }),
      ).toBeInTheDocument();
      expect(
        voice(3).getByRole("option", { name: "Sample stereo.wav in slot 1" }),
      ).toBeInTheDocument();
    });
  });

  describe("Kit selection and navigation", () => {
    it("handles next kit navigation", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      fireEvent.click(await screen.findByText("A0"));
      await screen.findByText("Back");

      fireEvent.click(screen.getByTitle("Next Kit: A1"));

      await waitFor(() => {
        expect(screen.getByTestId("kit-header-name")).toHaveTextContent("A1");
      });
    });

    it("handles previous kit navigation", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      fireEvent.click(await screen.findByText("A1"));
      await screen.findByText("Back");

      fireEvent.click(screen.getByTitle("Previous Kit: A0"));

      await waitFor(() => {
        expect(screen.getByTestId("kit-header-name")).toHaveTextContent("A0");
      });
    });
  });

  describe("Local store setup", () => {
    it("shows wizard when local store needs setup", async () => {
      // Create TestSettingsProvider that indicates setup is needed
      const TestSettingsProviderNeedsSetup: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          localStorePath: null,
          localStoreStatus: {
            hasLocalStore: false,
            isValid: false,
            localStorePath: null,
          },
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderNeedsSetup>
          <KitsView />
        </TestSettingsProviderNeedsSetup>,
      );

      // Should show wizard
      await waitFor(() => {
        expect(
          screen.getByText("Local Store Setup Required"),
        ).toBeInTheDocument();
      });
    });

    it("handles wizard close with app close", async () => {
      // Mock the app close
      const mockCloseApp = vi.fn();
      const mockElectronAPI = {
        ...window.electronAPI,
        closeApp: mockCloseApp,
      };
      Object.defineProperty(window, "electronAPI", {
        value: mockElectronAPI,
        writable: true,
      });

      const TestSettingsProviderNeedsSetup: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          localStorePath: null,
          localStoreStatus: {
            hasLocalStore: false,
            isValid: false,
            localStorePath: null,
          },
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderNeedsSetup>
          <KitsView />
        </TestSettingsProviderNeedsSetup>,
      );

      // Wait a bit for any UI to render
      await waitFor(
        () => {
          // Just ensure the component rendered
          expect(screen.getByTestId("kits-view")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      // Wait for the wizard modal to appear
      const cancelButton = await screen.findByText("Cancel");
      expect(cancelButton).toBeInTheDocument();

      fireEvent.click(cancelButton);
      // The close app function should be called
      expect(mockCloseApp).toHaveBeenCalled();
    });
  });

  describe("Dialog management", () => {
    it("opens and closes change directory dialog", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for component to render and callbacks to be set up
      await waitFor(() => {
        expect(globalMenuCallbacks).not.toBeNull();
      });

      // Trigger change directory dialog via menu callback
      menuCallbacks().onChangeLocalStoreDirectory?.();

      await waitFor(() => {
        expect(mockOpenChangeDirectory).toHaveBeenCalled();
      });
    });

    it("opens and closes preferences dialog", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for component to render and callbacks to be set up
      await waitFor(() => {
        expect(globalMenuCallbacks).not.toBeNull();
      });

      // Trigger preferences dialog via menu callback
      menuCallbacks().onPreferences?.();

      await waitFor(() => {
        expect(mockOpenPreferences).toHaveBeenCalled();
      });
    });
  });

  describe("Error handling", () => {
    it("handles kit loading exceptions", async () => {
      vi.mocked(window.electronAPI.getKits).mockRejectedValue(
        new Error("Network error"),
      );

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(window.electronAPI.getKits).toHaveBeenCalled();
      });

      // Component should still render without crashing
      expect(
        screen.getByRole("button", { name: "Settings" }),
      ).toBeInTheDocument();
    });

    it("handles single-kit sample reload exceptions", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      fireEvent.click(await screen.findByText("A0"));
      await screen.findByText("Back");

      // A rejected single-kit reload must not crash the view
      vi.mocked(window.electronAPI.getKit)
        .mockClear()
        .mockRejectedValue(new Error("File not found"));
      document.dispatchEvent(
        new CustomEvent("romper:refresh-samples", {
          detail: { kitName: "A0" },
        }),
      );

      await waitFor(() => {
        expect(window.electronAPI.getKit).toHaveBeenCalledWith("A0");
      });
      // The editor stays open on the kit
      expect(screen.getByTestId("kit-header-name")).toHaveTextContent("A0");
    });
  });

  describe("Kit details navigation", () => {
    it("handles next kit navigation at boundary", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      fireEvent.click(await screen.findByText("B0"));
      await screen.findByText("Back");

      expect(screen.getByTitle("No next kit")).toBeDisabled();
      expect(screen.getByTestId("kit-header-name")).toHaveTextContent("B0");
    });

    it("handles previous kit navigation at boundary", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      fireEvent.click(await screen.findByText("A0"));
      await screen.findByText("Back");

      expect(screen.getByTitle("No previous kit")).toBeDisabled();
      expect(screen.getByTestId("kit-header-name")).toHaveTextContent("A0");
    });
  });

  describe("Sample reload functionality", () => {
    it("handles sample reload success for selected kit", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      fireEvent.click(await screen.findByText("A0"));
      await screen.findByText("Back");

      // One getKit call brings back the kit with its samples (#452)
      vi.mocked(window.electronAPI.getKit).mockResolvedValue({
        data: createMockKitWithRelations({
          alias: null,
          bank_letter: "A",
          editable: false,
          name: "A0",
          samples: [
            createMockSample({
              filename: "new-kick.wav",
              slot_number: 0,
              voice_number: 1,
            }),
            createMockSample({
              filename: "new-snare.wav",
              slot_number: 0,
              voice_number: 2,
            }),
          ],
        }),
        success: true,
      });
      document.dispatchEvent(
        new CustomEvent("romper:refresh-samples", {
          detail: { kitName: "A0" },
        }),
      );

      expect(
        await within(screen.getByTestId("sample-list-voice-1")).findByRole(
          "option",
          { name: "Sample new-kick.wav in slot 1" },
        ),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId("sample-list-voice-2")).getByRole("option", {
          name: "Sample new-snare.wav in slot 1",
        }),
      ).toBeInTheDocument();
    });

    it("handles sample reload error for selected kit", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      fireEvent.click(await screen.findByText("A0"));
      await screen.findByText("Back");

      vi.mocked(window.electronAPI.getKit)
        .mockClear()
        .mockResolvedValue({ error: "Sample reload failed", success: false });
      document.dispatchEvent(
        new CustomEvent("romper:refresh-samples", {
          detail: { kitName: "A0" },
        }),
      );

      await waitFor(() => {
        expect(window.electronAPI.getKit).toHaveBeenCalledWith("A0");
      });
      // The editor stays open on the kit
      expect(screen.getByTestId("kit-header-name")).toHaveTextContent("A0");
    });
  });

  // #452: an edit reloads only its kit; if that fails, the kit stays on
  // screen and the user is told, whatever the edit was (approved on #452)
  describe("[Q-01] reloading a kit after an edit", () => {
    const openEditableA0 = async () => {
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            editable: true,
            name: "A0",
            samples: [createMockSample({ filename: "kick.wav" })],
          }),
        ],
        success: true,
      });
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );
      fireEvent.click(await screen.findByText("A0"));
      await screen.findByText("Back");
    };

    const renameVoice1 = () => {
      fireEvent.click(screen.getAllByTitle("Edit voice name")[0]);
      fireEvent.change(screen.getByLabelText("Name of voice 1"), {
        target: { value: "Kick" },
      });
      fireEvent.click(screen.getByTitle("Save"));
    };

    it("[UC-27] reloads only the renamed voice's kit", async () => {
      await openEditableA0();
      vi.mocked(window.electronAPI.getKits).mockClear();
      vi.mocked(window.electronAPI.getKit).mockClear();

      renameVoice1();

      await waitFor(() => {
        expect(window.electronAPI.getKit).toHaveBeenCalledWith("A0");
      });
      expect(window.electronAPI.getKits).not.toHaveBeenCalled();
    });

    it("[UC-27] keeps the kit open and says so when the reload after a rename fails", async () => {
      await openEditableA0();
      vi.mocked(window.electronAPI.getKit).mockResolvedValue({
        error: "database is locked",
        success: false,
      });

      renameVoice1();

      await waitFor(() => {
        expect(mockShowMessage).toHaveBeenCalledWith(
          "Couldn't load the samples for kit A0. Try reopening it.",
          "error",
        );
      });
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick",
      );
      // The editor stays open on the kit, still editable
      expect(screen.getByTestId("kit-header-name")).toHaveTextContent("A0");
      expect(screen.getByText("Editable")).toBeInTheDocument();
    });
  });

  describe("Wizard success callback", () => {
    it("handles wizard success and refreshes store status", async () => {
      // Mock refresh function
      const mockRefreshLocalStoreStatus = vi.fn().mockResolvedValue(undefined);

      const TestSettingsProviderWithMock: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          localStorePath: null,
          localStoreStatus: {
            hasLocalStore: false,
            isValid: false,
            localStorePath: null,
          },
          refreshLocalStoreStatus: mockRefreshLocalStoreStatus,
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderWithMock>
          <KitsView />
        </TestSettingsProviderWithMock>,
      );

      // Should show wizard
      await waitFor(() => {
        expect(
          screen.getByText("Local Store Setup Required"),
        ).toBeInTheDocument();
      });

      // Click Complete Setup button
      const completeButton = screen.getByText("Complete Setup");
      fireEvent.click(completeButton);

      // Should call refresh function
      expect(mockRefreshLocalStoreStatus).toHaveBeenCalled();
    });
  });

  describe("Memoized sample counts", () => {
    it("correctly calculates sample counts for all kits", async () => {
      // Each kit's samples ride along on getKits()
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: false,
            name: "A0",
            samples: [
              createMockSample({
                filename: "kick.wav",
                slot_number: 0,
                voice_number: 1,
              }),
              createMockSample({
                filename: "snare.wav",
                slot_number: 1,
                voice_number: 1,
              }),
              createMockSample({
                filename: "hat.wav",
                slot_number: 0,
                voice_number: 2,
              }),
            ],
          }),
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: false,
            name: "A1",
            samples: [
              createMockSample({
                filename: "bass.wav",
                slot_number: 0,
                voice_number: 1,
              }),
            ],
          }),
          createMockKitWithRelations({
            alias: null,
            bank_letter: "B",
            editable: false,
            name: "B0",
            samples: [],
          }),
        ],
        success: true,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for all data to load
      await waitFor(() => {
        expect(window.electronAPI.getKits).toHaveBeenCalled();
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // The kit cards show each kit's total and per-voice counts
      expect(screen.getByTestId("kit-item-A0")).toHaveAccessibleName(
        "Kit A0 - 3 samples",
      );
      expect(screen.getByTestId("kit-item-A1")).toHaveAccessibleName(
        "Kit A1 - 1 samples",
      );
      expect(screen.getByTestId("kit-item-B0")).toHaveAccessibleName(
        "Kit B0 - 0 samples",
      );
      const a0 = within(screen.getByTestId("kit-item-A0"));
      expect(a0.getByTitle("Voice 1: 2 samples")).toBeInTheDocument();
      expect(a0.getByTitle("Voice 2: 1 samples")).toBeInTheDocument();
    });
  });

  describe("Component initialization states", () => {
    it("handles component when not initialized", async () => {
      const TestSettingsProviderNotInitialized: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          isInitialized: false, // Not initialized
          localStorePath: "/mock/path",
          localStoreStatus: {
            hasLocalStore: true,
            isValid: true,
            localStorePath: "/mock/path",
          },
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderNotInitialized>
          <KitsView />
        </TestSettingsProviderNotInitialized>,
      );

      // Should not attempt to load data when not initialized
      expect(window.electronAPI.getKits).not.toHaveBeenCalled();
    });

    it("skips loading when local store path is missing", async () => {
      const TestSettingsProviderNoPath: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          localStorePath: null, // No path
          localStoreStatus: {
            hasLocalStore: false,
            isValid: false,
            localStorePath: null,
          },
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderNoPath>
          <KitsView />
        </TestSettingsProviderNoPath>,
      );

      // Should not attempt to load data when path is missing
      expect(window.electronAPI.getKits).not.toHaveBeenCalled();
    });
  });

  describe("Search functionality integration", () => {
    it("renders search input in kit browser", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // Should have search input (from KitBrowser)
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeInTheDocument();
    });

    it("handles search query changes", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Type in search input
      fireEvent.change(searchInput, { target: { value: "A0" } });

      // Search functionality should be working
      expect(searchInput).toHaveValue("A0");
      await waitFor(() => {
        expect(screen.queryByTestId("kit-item-A1")).not.toBeInTheDocument();
      });
      expect(screen.getByTestId("kit-item-A0")).toBeInTheDocument();
    });

    it("shows search results when filtering", async () => {
      // Mock kits with different names for search testing
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            alias: "Drum Kit",
            bank_letter: "A",
            editable: false,
            name: "A0",
          }),
          createMockKitWithRelations({
            alias: "Bass Kit",
            bank_letter: "A",
            editable: false,
            name: "A1",
          }),
          createMockKitWithRelations({
            alias: "Melody Kit",
            bank_letter: "B",
            editable: false,
            name: "B0",
          }),
        ],
        success: true,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Search for "drum" - should match A0's alias
      fireEvent.change(searchInput, { target: { value: "drum" } });

      await waitFor(() => {
        expect(searchInput).toHaveValue("drum");
      });
      await waitFor(() => {
        expect(screen.queryByTestId("kit-item-A1")).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId("kit-item-B0")).not.toBeInTheDocument();
      expect(screen.getByTestId("kit-item-A0")).toBeInTheDocument();
    });

    it("clears search results", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Type a query that filters out A1 (every kit's bank artist matches
      // "test", so that query filtered nothing)
      fireEvent.change(searchInput, { target: { value: "A0" } });
      expect(searchInput).toHaveValue("A0");
      await waitFor(() => {
        expect(screen.queryByTestId("kit-item-A1")).not.toBeInTheDocument();
      });

      fireEvent.click(
        await screen.findByRole("button", { name: "Clear search" }),
      );

      await waitFor(() => {
        expect(searchInput).toHaveValue("");
      });
      expect(await screen.findByTestId("kit-item-A1")).toBeInTheDocument();
    });

    it("handles search with no results", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Search for something that won't match
      fireEvent.change(searchInput, { target: { value: "xyz123nonexistent" } });

      await waitFor(() => {
        expect(searchInput).toHaveValue("xyz123nonexistent");
      });

      // No kit card matches
      await waitFor(() => {
        expect(screen.queryAllByTestId(/^kit-item-/)).toHaveLength(0);
      });
    });
  });

  describe("Search and filter integration", () => {
    it("applies filters to search results", async () => {
      // Mock some kits with favorites
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: false,
            is_favorite: true,
            name: "A0",
          }),
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: false,
            is_favorite: false,
            name: "A1",
          }),
          createMockKitWithRelations({
            alias: null,
            bank_letter: "B",
            editable: false,
            is_favorite: true,
            name: "B0",
          }),
        ],
        success: true,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Show only favorite kits" }),
      );

      // A1 is the only kit the filter leaves out
      await waitFor(() => {
        expect(screen.queryByTestId("kit-item-A1")).not.toBeInTheDocument();
      });
      expect(screen.getByTestId("kit-item-A0")).toBeInTheDocument();
      expect(screen.getByTestId("kit-item-B0")).toBeInTheDocument();
    });

    it("shows modified kits filter with search", async () => {
      // Mock some kits with modified state
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: [
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: true,
            modified_since_sync: true,
            name: "A0",
          }),
          createMockKitWithRelations({
            alias: null,
            bank_letter: "A",
            editable: false,
            modified_since_sync: false,
            name: "A1",
          }),
          createMockKitWithRelations({
            alias: null,
            bank_letter: "B",
            editable: true,
            modified_since_sync: true,
            name: "B0",
          }),
        ],
        success: true,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", {
          name: "Show kits with changes not yet on the SD card",
        }),
      );

      // A1 is the only kit the filter leaves out
      await waitFor(() => {
        expect(screen.queryByTestId("kit-item-A1")).not.toBeInTheDocument();
      });
      expect(screen.getByTestId("kit-item-A0")).toBeInTheDocument();
      expect(screen.getByTestId("kit-item-B0")).toBeInTheDocument();
    });
  });

  describe("Environment override scenarios", () => {
    it("shows the Test Mode banner for a ROMPER_LOCAL_PATH override", async () => {
      const TestSettingsProviderOverride: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          localStorePath: "/env/store",
          localStoreStatus: {
            hasLocalStore: true,
            isEnvironmentOverride: true,
            isValid: true,
            localStorePath: "/env/store",
          },
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderOverride>
          <KitsView />
        </TestSettingsProviderOverride>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Test Mode/)).toBeInTheDocument();
      });
    });

    it("shows critical error dialog for invalid environment path", async () => {
      const TestSettingsProviderCriticalError: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          localStorePath: "/invalid/path",
          localStoreStatus: {
            error: "Path does not exist",
            hasLocalStore: true,
            isCriticalEnvironmentError: true,
            isValid: false,
            localStorePath: "/invalid/path",
          },
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderCriticalError>
          <KitsView />
        </TestSettingsProviderCriticalError>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Critical Configuration Error"),
        ).toBeInTheDocument();
      });

      // Should show the error dialog with exit button
      expect(screen.getByText("OK - Exit Application")).toBeInTheDocument();
    });

    it("shows invalid local store dialog for invalid configuration", async () => {
      const TestSettingsProviderInvalidStore: React.FC<{
        children: React.ReactNode;
      }> = ({ children }) => {
        const contextValue = createMockSettings({
          localStorePath: "/invalid/store",
          localStoreStatus: {
            error: "Invalid local store configuration",
            hasLocalStore: true,
            isValid: false,
            localStorePath: "/invalid/store",
          },
        });

        return (
          <SettingsContext.Provider value={contextValue}>
            {children}
          </SettingsContext.Provider>
        );
      };

      render(
        <TestSettingsProviderInvalidStore>
          <KitsView />
        </TestSettingsProviderInvalidStore>,
      );

      await waitFor(() => {
        expect(screen.getByText("Invalid Local Store")).toBeInTheDocument();
      });
    });
  });

  describe("Refresh samples event handling", () => {
    it("handles refresh samples custom event", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // Select a kit first
      fireEvent.click(screen.getByText("A0"));

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });

      vi.mocked(window.electronAPI.getKit).mockClear();

      // Dispatch the custom refresh event
      const refreshEvent = new CustomEvent("romper:refresh-samples", {
        detail: { kitName: "A0" },
      });
      document.dispatchEvent(refreshEvent);

      // Should reload the selected kit, with its samples, in one call
      await waitFor(() => {
        expect(window.electronAPI.getKit).toHaveBeenCalledTimes(1);
      });
      expect(window.electronAPI.getKit).toHaveBeenCalledWith("A0");
    });

    it("ignores refresh event for non-selected kit", async () => {
      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // Select A0 but dispatch event for B0
      fireEvent.click(screen.getByText("A0"));

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });

      vi.mocked(window.electronAPI.getKit).mockClear();

      // Dispatch refresh event for different kit
      const refreshEvent = new CustomEvent("romper:refresh-samples", {
        detail: { kitName: "B0" },
      });
      document.dispatchEvent(refreshEvent);

      // Should not reload samples since B0 is not selected
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(window.electronAPI.getKit).not.toHaveBeenCalled();
    });
  });

  describe("HMR state management", () => {
    it("saves selected kit state for HMR", async () => {
      // Mock HMR environment
      const mockHot = { hot: true };
      Object.defineProperty(import.meta, "hot", {
        configurable: true,
        value: mockHot,
      });

      render(
        <TestSettingsProvider>
          <KitsView />
        </TestSettingsProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("A0")).toBeInTheDocument();
      });

      // Select a kit
      fireEvent.click(screen.getByText("A0"));

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });

      // Should save HMR state (this is tested by the effect running)
      expect(sessionStorage.getItem("hmr_selected_kit")).toBe("A0");

      // Cleanup
      sessionStorage.removeItem("hmr_selected_kit");
      Reflect.deleteProperty(import.meta, "hot");
    });
  });
});
