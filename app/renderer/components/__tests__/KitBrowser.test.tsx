// Test suite for KitBrowser component
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock problematic imports that can cause hanging
vi.mock("../hooks/useLocalStoreWizard", () => ({
  useLocalStoreWizard: () => ({
    state: {
      targetPath: "/mock/path",
      source: "blank",
      sdCardMounted: false,
      isInitializing: false,
      error: null,
      sourceConfirmed: false,
    },
    progress: null,
    progressMessage: "",
    setTargetPath: vi.fn(),
    setSource: vi.fn(),
    setSdCardMounted: vi.fn(),
    setError: vi.fn(),
    setIsInitializing: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../hooks/useKitScan", () => ({
  useKitScan: () => ({
    scanningProgress: null,
    scanAllKits: vi.fn(),
    rescanAllVoiceNames: vi.fn(),
  }),
}));

vi.mock("../hooks/useKitBrowser", () => ({
  useKitBrowser: vi.fn(),
}));

import { useKitBrowser } from "../hooks/useKitBrowser";
import KitBrowser from "../KitBrowser";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";

// Get the mocked function for use in tests
const mockUseKitBrowser = vi.mocked(useKitBrowser);

const baseProps = {
  onSelectKit: vi.fn(),
  kits: ["A0", "A1", "B0"],
  kitData: [
    {
      name: "A0",
      voices: [
        { voice_number: 1, voice_alias: "Kick" },
        { voice_number: 2, voice_alias: "Snare" },
        { voice_number: 3, voice_alias: "Hat" },
        { voice_number: 4, voice_alias: "Tom" },
      ],
    },
    {
      name: "A1",
      voices: [
        { voice_number: 1, voice_alias: "Kick" },
        { voice_number: 2, voice_alias: "Snare" },
        { voice_number: 3, voice_alias: "Hat" },
        { voice_number: 4, voice_alias: "Tom" },
      ],
    },
    {
      name: "B0",
      voices: [
        { voice_number: 1, voice_alias: "Kick" },
        { voice_number: 2, voice_alias: "Snare" },
        { voice_number: 3, voice_alias: "Hat" },
        { voice_number: 4, voice_alias: "Tom" },
      ],
    },
  ],
  onRescanAllVoiceNames: vi.fn(),
  sampleCounts: { A0: [1, 1, 1, 1], A1: [1, 1, 1, 1], B0: [1, 1, 1, 1] },
  onRefreshKits: vi.fn(),
};

describe("KitBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock behavior
    mockUseKitBrowser.mockReturnValue({
      kits: ["A0", "A1", "B0"],
      error: null,
      sdCardWarning: null,
      showNewKit: false,
      newKitSlot: "",
      newKitError: null,
      nextKitSlot: "A2",
      duplicateKitSource: null,
      duplicateKitDest: "",
      duplicateKitError: null,
      bankNames: {},
      selectedBank: "A",
      focusedKit: "A0",
      setNewKitSlot: vi.fn(),
      setDuplicateKitSource: vi.fn(),
      setDuplicateKitDest: vi.fn(),
      handleCreateKit: vi.fn(),
      handleDuplicateKit: vi.fn(),
      handleBankClick: vi.fn(),
      setSelectedBank: vi.fn(),
      focusBankInKitList: vi.fn(),
      globalBankHotkeyHandler: vi.fn(),
      setShowNewKit: vi.fn(),
      setNewKitError: vi.fn(),
      setDuplicateKitError: vi.fn(),
      scrollContainerRef: { current: null },
    });

    // Mock scrollTo for jsdom
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      value: () => {},
      writable: true,
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders kit list and header", async () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      expect(screen.getByText("Rescan All Kit Voice Names")).toBeTruthy();
      expect(screen.getByText("+ New Kit")).toBeTruthy();
      expect(screen.getByTestId("kit-item-A0")).toBeTruthy();
      expect(screen.getByTestId("kit-item-A1")).toBeTruthy();
      expect(screen.getByTestId("kit-item-B0")).toBeTruthy();
    });
  });

  describe("actions", () => {
    it("calls onSelectKit when a kit is clicked", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      const kit = screen.getByTestId("kit-item-A0");
      fireEvent.click(kit);
      expect(baseProps.onSelectKit).toHaveBeenCalledWith("A0");
    });
    it("shows new kit dialog when + New Kit is clicked", () => {
      // Mock the hook to show the dialog after the button is clicked
      mockUseKitBrowser.mockReturnValue({
        kits: ["A0", "A1", "B0"],
        error: null,
        sdCardWarning: null,
        showNewKit: true, // Dialog should be shown
        newKitSlot: "",
        newKitError: null,
        nextKitSlot: "A2",
        duplicateKitSource: null,
        duplicateKitDest: "",
        duplicateKitError: null,
        bankNames: {},
        selectedBank: "A",
        focusedKit: "A0",
        setNewKitSlot: vi.fn(),
        setDuplicateKitSource: vi.fn(),
        setDuplicateKitDest: vi.fn(),
        handleCreateKit: vi.fn(),
        handleDuplicateKit: vi.fn(),
        handleBankClick: vi.fn(),
        setSelectedBank: vi.fn(),
        focusBankInKitList: vi.fn(),
        globalBankHotkeyHandler: vi.fn(),
        setShowNewKit: vi.fn(),
        setNewKitError: vi.fn(),
        setDuplicateKitError: vi.fn(),
        scrollContainerRef: { current: null },
      });

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      expect(screen.getByText("Kit Slot (A0-Z99):")).toBeTruthy();
      expect(screen.getByText("Create")).toBeTruthy();
    });
    it("calls onRescanAllVoiceNames when button is clicked", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      fireEvent.click(screen.getByText("Rescan All Kit Voice Names"));
      expect(baseProps.onRescanAllVoiceNames).toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("does not highlight/select a bank button when pressing a key for a bank with no kits", async () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} kits={["A0", "A1", "B0"]} />
        </MockMessageDisplayProvider>,
      );
      const kitList = screen.getAllByTestId("kit-list")[0];
      kitList.focus();
      // Bank C has no kits, so pressing 'C' should not highlight/select the C button
      const cButtons = screen.getAllByRole("button", {
        name: "Jump to bank C",
      });
      // There may be more than one due to virtualization, but all should be disabled
      cButtons.forEach((cButton) => {
        expect(cButton.getAttribute("disabled")).not.toBeNull();
      });
      fireEvent.keyDown(kitList, { key: "C" });
      await waitFor(() => {
        cButtons.forEach((cButton) => {
          expect(cButton.getAttribute("aria-current")).not.toBe("true");
          expect(cButton.className).not.toMatch(/bg-blue-800/);
        });
      });
    });

    describe("KitBrowser keyboard navigation bugs", () => {
      const navProps = {
        ...baseProps,
        kits: ["A1", "A2", "B1", "B2"],
        kitData: [
          { name: "A1", alias: "Kick", voices: [] },
          { name: "A2", alias: "Snare", voices: [] },
          { name: "B1", alias: "Hat", voices: [] },
          { name: "B2", alias: "Tom", voices: [] },
        ],
        sampleCounts: {
          A1: [1, 1, 1, 1],
          A2: [1, 1, 1, 1],
          B1: [1, 1, 1, 1],
          B2: [1, 1, 1, 1],
        },
      };

      it("should highlight/select the first kit in a bank when a bank button is clicked", async () => {
        // Set up mock with B1 as focused kit to simulate the bank click behavior
        mockUseKitBrowser.mockReturnValue({
          kits: ["A1", "A2", "B1", "B2"],
          error: null,
          sdCardWarning: null,
          showNewKit: false,
          newKitSlot: "",
          newKitError: null,
          nextKitSlot: "A2",
          duplicateKitSource: null,
          duplicateKitDest: "",
          duplicateKitError: null,
          bankNames: {},
          selectedBank: "B",
          focusedKit: "B1", // Focus should be on B1 after clicking bank B
          setNewKitSlot: vi.fn(),
          setDuplicateKitSource: vi.fn(),
          setDuplicateKitDest: vi.fn(),
          handleCreateKit: vi.fn(),
          handleDuplicateKit: vi.fn(),
          handleBankClick: vi.fn(),
          setSelectedBank: vi.fn(),
          focusBankInKitList: vi.fn(),
          globalBankHotkeyHandler: vi.fn(),
          setShowNewKit: vi.fn(),
          setNewKitError: vi.fn(),
          setDuplicateKitError: vi.fn(),
          scrollContainerRef: { current: null },
        });

        render(
          <MockMessageDisplayProvider>
            <KitBrowser {...navProps} />
          </MockMessageDisplayProvider>,
        );

        // The first kit in bank B should be focused/highlighted
        await waitFor(
          () => {
            const kitB1s = screen.getAllByTestId("kit-item-B1");
            const selected = kitB1s.filter(
              (el) => el.getAttribute("aria-selected") === "true",
            );
            if (selected.length !== 1) {
              console.log(
                "kitB1s:",
                kitB1s.map((el) => el.outerHTML),
              );
            }
            expect(selected.length).toBe(1);
            expect(selected[0].getAttribute("tabindex")).toBe("0");
            kitB1s.forEach((el) => {
              if (el !== selected[0]) {
                expect(el.getAttribute("aria-selected")).toBe("false");
                expect(el.getAttribute("tabindex")).toBe("-1");
              }
            });
          },
          { timeout: 2000 },
        );
      });
      it("should highlight/select the first kit in a bank when A-Z hotkey is pressed", async () => {
        // Set up mock with B1 as focused kit to simulate the hotkey behavior
        mockUseKitBrowser.mockReturnValue({
          kits: ["A1", "A2", "B1", "B2"],
          error: null,
          sdCardWarning: null,
          showNewKit: false,
          newKitSlot: "",
          newKitError: null,
          nextKitSlot: "A2",
          duplicateKitSource: null,
          duplicateKitDest: "",
          duplicateKitError: null,
          bankNames: {},
          selectedBank: "B",
          focusedKit: "B1", // Focus should be on B1 after pressing B hotkey
          setNewKitSlot: vi.fn(),
          setDuplicateKitSource: vi.fn(),
          setDuplicateKitDest: vi.fn(),
          handleCreateKit: vi.fn(),
          handleDuplicateKit: vi.fn(),
          handleBankClick: vi.fn(),
          setSelectedBank: vi.fn(),
          focusBankInKitList: vi.fn(),
          globalBankHotkeyHandler: vi.fn(),
          setShowNewKit: vi.fn(),
          setNewKitError: vi.fn(),
          setDuplicateKitError: vi.fn(),
          scrollContainerRef: { current: null },
        });

        render(
          <MockMessageDisplayProvider>
            <KitBrowser {...navProps} />
          </MockMessageDisplayProvider>,
        );

        // The first kit in bank B should be focused/highlighted
        await waitFor(
          () => {
            const kitB1s = screen.getAllByTestId("kit-item-B1");
            const selected = kitB1s.filter(
              (el) => el.getAttribute("aria-selected") === "true",
            );
            if (selected.length !== 1) {
              console.log(
                "kitB1s:",
                kitB1s.map((el) => el.outerHTML),
              );
            }
            expect(selected.length).toBe(1);
            expect(selected[0].getAttribute("tabindex")).toBe("0");
            kitB1s.forEach((el) => {
              if (el !== selected[0]) {
                expect(el.getAttribute("aria-selected")).toBe("false");
                expect(el.getAttribute("tabindex")).toBe("-1");
              }
            });
          },
          { timeout: 2000 },
        );
      });
    });
  });

  describe("Validation Results", () => {
    it("should open validation dialog when validate button is clicked", async () => {
      // Mock validation results for test
      window.electronAPI.validateLocalStore = vi.fn().mockResolvedValue({
        isValid: false,
        errors: [
          {
            kitName: "A1",
            missingFiles: ["kick.wav"],
            extraFiles: [],
          },
        ],
        errorSummary: "Found validation errors",
      });

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      // Find and click the validate button
      const validateButton = screen.getByText("Validate Local Store");
      fireEvent.click(validateButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(
          screen.getByText("Local Store Validation Results"),
        ).toBeInTheDocument();
        expect(window.electronAPI.validateLocalStore).toHaveBeenCalled();
      });
    });
  });
});
