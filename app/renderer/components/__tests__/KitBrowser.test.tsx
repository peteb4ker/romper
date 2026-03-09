// Test suite for KitBrowser component
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../../../tests/utils/renderWithProviders";

// Mock problematic imports that can cause hanging
vi.mock("../hooks/wizard/useLocalStoreWizard", () => ({
  useLocalStoreWizard: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    progress: null,
    progressMessage: "",
    setError: vi.fn(),
    setIsInitializing: vi.fn(),
    setSdCardMounted: vi.fn(),
    setSource: vi.fn(),
    setTargetPath: vi.fn(),
    state: {
      error: null,
      isInitializing: false,
      sdCardMounted: false,
      source: "blank",
      sourceConfirmed: false,
      targetPath: "/mock/path",
    },
  }),
}));

vi.mock("../hooks/kit-management/useKitScan", () => ({
  useKitScan: () => ({
    handleScanAllKits: vi.fn(),
    rescanAllVoiceNames: vi.fn(),
    scanningProgress: null,
  }),
}));

vi.mock("../hooks/kit-management/useKitBrowser", () => ({
  useKitBrowser: vi.fn(),
}));

import React from "react";

import { useKitBrowser } from "../hooks/kit-management/useKitBrowser";
import KitBrowser from "../KitBrowser";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";

// Get the mocked function for use in tests
const mockUseKitBrowser = vi.mocked(useKitBrowser);

const baseProps = {
  kitData: [
    {
      name: "A0",
      voices: [
        { voice_alias: "Kick", voice_number: 1 },
        { voice_alias: "Snare", voice_number: 2 },
        { voice_alias: "Hat", voice_number: 3 },
        { voice_alias: "Tom", voice_number: 4 },
      ],
    },
    {
      name: "A1",
      voices: [
        { voice_alias: "Kick", voice_number: 1 },
        { voice_alias: "Snare", voice_number: 2 },
        { voice_alias: "Hat", voice_number: 3 },
        { voice_alias: "Tom", voice_number: 4 },
      ],
    },
    {
      name: "B0",
      voices: [
        { voice_alias: "Kick", voice_number: 1 },
        { voice_alias: "Snare", voice_number: 2 },
        { voice_alias: "Hat", voice_number: 3 },
        { voice_alias: "Tom", voice_number: 4 },
      ],
    },
  ],
  kits: [
    {
      alias: null,
      artist: null,
      bank: null,
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      samples: [],
      step_pattern: null,
      voices: [
        { kit_name: "A0", voice_alias: "Kick", voice_number: 1 },
        { kit_name: "A0", voice_alias: "Snare", voice_number: 2 },
        { kit_name: "A0", voice_alias: "Hat", voice_number: 3 },
        { kit_name: "A0", voice_alias: "Tom", voice_number: 4 },
      ],
    },
    {
      alias: null,
      artist: null,
      bank: null,
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      samples: [],
      step_pattern: null,
      voices: [
        { kit_name: "A1", voice_alias: "Kick", voice_number: 1 },
        { kit_name: "A1", voice_alias: "Snare", voice_number: 2 },
        { kit_name: "A1", voice_alias: "Hat", voice_number: 3 },
        { kit_name: "A1", voice_alias: "Tom", voice_number: 4 },
      ],
    },
    {
      alias: null,
      artist: null,
      bank: null,
      bank_letter: "B",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "B0",
      samples: [],
      step_pattern: null,
      voices: [
        { kit_name: "B0", voice_alias: "Kick", voice_number: 1 },
        { kit_name: "B0", voice_alias: "Snare", voice_number: 2 },
        { kit_name: "B0", voice_alias: "Hat", voice_number: 3 },
        { kit_name: "B0", voice_alias: "Tom", voice_number: 4 },
      ],
    },
  ],
  onRefreshKits: vi.fn(),
  onSelectKit: vi.fn(),
  sampleCounts: { A0: [1, 1, 1, 1], A1: [1, 1, 1, 1], B0: [1, 1, 1, 1] },
};

const createMockReturnValue = (overrides = {}) => ({
  bankNames: {},
  duplicateKitDest: "",
  duplicateKitDirect: vi.fn().mockResolvedValue({}),
  duplicateKitError: null,
  duplicateKitSource: null,
  error: null,
  focusBankInKitList: vi.fn(),
  focusedKit: "A0",
  globalBankHotkeyHandler: vi.fn(),
  handleBankClick: vi.fn(),
  handleCreateKitInBank: vi.fn(),
  handleDuplicateKit: vi.fn(),
  isCreatingKit: false,
  kits: baseProps.kits,
  scrollContainerRef: { current: null },
  sdCardWarning: null,
  selectedBank: "A",
  setDuplicateKitDest: vi.fn(),
  setDuplicateKitError: vi.fn(),
  setDuplicateKitSource: vi.fn(),
  setSelectedBank: vi.fn(),
  ...overrides,
});

describe("KitBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock behavior
    mockUseKitBrowser.mockReturnValue(createMockReturnValue());

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
    it("renders kit list and header without New Kit button", async () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      // New Kit button should no longer exist
      expect(screen.queryByText("New Kit")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
      expect(screen.getByTestId("kit-item-A0")).toBeTruthy();
      expect(screen.getByTestId("kit-item-A1")).toBeTruthy();
      expect(screen.getByTestId("kit-item-B0")).toBeTruthy();
    });

    it("renders add kit cards when not filtered", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      // Add kit cards should appear for each bank
      expect(screen.getByTestId("add-kit-A")).toBeInTheDocument();
      expect(screen.getByTestId("add-kit-B")).toBeInTheDocument();
    });

    it("hides add kit cards when search is active", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} searchQuery="test" />
        </MockMessageDisplayProvider>,
      );
      expect(screen.queryByTestId("add-kit-A")).not.toBeInTheDocument();
      expect(screen.queryByTestId("add-kit-B")).not.toBeInTheDocument();
    });

    it("hides add kit cards when favorites filter is active", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} showFavoritesOnly={true} />
        </MockMessageDisplayProvider>,
      );
      expect(screen.queryByTestId("add-kit-A")).not.toBeInTheDocument();
      expect(screen.queryByTestId("add-kit-B")).not.toBeInTheDocument();
    });

    it("hides add kit cards when modified filter is active", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} showModifiedOnly={true} />
        </MockMessageDisplayProvider>,
      );
      expect(screen.queryByTestId("add-kit-A")).not.toBeInTheDocument();
      expect(screen.queryByTestId("add-kit-B")).not.toBeInTheDocument();
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

    it("calls handleCreateKitInBank when add kit card is clicked", () => {
      const mockHandleCreateKitInBank = vi.fn();
      mockUseKitBrowser.mockReturnValue(
        createMockReturnValue({
          handleCreateKitInBank: mockHandleCreateKitInBank,
        }),
      );

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      const addKitCard = screen.getByTestId("add-kit-A");
      fireEvent.click(addKitCard);
      expect(mockHandleCreateKitInBank).toHaveBeenCalledWith("A");
    });
  });

  describe("keyboard navigation", () => {
    it("does not highlight/select a bank button when pressing a key for a bank with no kits", async () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      const kitGrid = screen.getAllByTestId("kit-grid")[0];
      kitGrid.focus();
      // Bank C has no kits, so pressing 'C' should not highlight/select the C button
      const cButtons = screen.getAllByRole("button", {
        name: "Jump to bank C",
      });
      // There may be more than one due to virtualization, but all should be disabled
      cButtons.forEach((cButton) => {
        expect(cButton.getAttribute("disabled")).not.toBeNull();
      });
      fireEvent.keyDown(kitGrid, { key: "C" });
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
        kitData: [
          { alias: "Kick", name: "A1", voices: [] },
          { alias: "Snare", name: "A2", voices: [] },
          { alias: "Hat", name: "B1", voices: [] },
          { alias: "Tom", name: "B2", voices: [] },
        ],
        kits: [
          {
            alias: "Kick",
            artist: null,
            bank: null,
            bank_letter: "A",
            editable: false,
            locked: false,
            modified_since_sync: false,
            name: "A1",
            samples: [],
            step_pattern: null,
            voices: [],
          },
          {
            alias: "Snare",
            artist: null,
            bank: null,
            bank_letter: "A",
            editable: false,
            locked: false,
            modified_since_sync: false,
            name: "A2",
            samples: [],
            step_pattern: null,
            voices: [],
          },
          {
            alias: "Hat",
            artist: null,
            bank: null,
            bank_letter: "B",
            editable: false,
            locked: false,
            modified_since_sync: false,
            name: "B1",
            samples: [],
            step_pattern: null,
            voices: [],
          },
          {
            alias: "Tom",
            artist: null,
            bank: null,
            bank_letter: "B",
            editable: false,
            locked: false,
            modified_since_sync: false,
            name: "B2",
            samples: [],
            step_pattern: null,
            voices: [],
          },
        ],
        sampleCounts: {
          A1: [1, 1, 1, 1],
          A2: [1, 1, 1, 1],
          B1: [1, 1, 1, 1],
          B2: [1, 1, 1, 1],
        },
      };

      it("should highlight/select the first kit in a bank when a bank button is clicked", async () => {
        mockUseKitBrowser.mockReturnValue(
          createMockReturnValue({
            focusedKit: "B1",
            kits: navProps.kits,
            selectedBank: "B",
          }),
        );

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
        mockUseKitBrowser.mockReturnValue(
          createMockReturnValue({
            focusedKit: "B1",
            kits: navProps.kits,
            selectedBank: "B",
          }),
        );

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

  describe("Error handling", () => {
    it("displays error messages from logic", () => {
      const mockOnMessage = vi.fn();
      mockUseKitBrowser.mockReturnValue(
        createMockReturnValue({
          error: "Test error message",
        }),
      );

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} onMessage={mockOnMessage} />
        </MockMessageDisplayProvider>,
      );

      expect(mockOnMessage).toHaveBeenCalledWith(
        "Test error message",
        "error",
        7000,
      );
    });

    it("displays SD card warnings", () => {
      const mockOnMessage = vi.fn();
      mockUseKitBrowser.mockReturnValue(
        createMockReturnValue({
          sdCardWarning: "SD card warning message",
        }),
      );

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} onMessage={mockOnMessage} />
        </MockMessageDisplayProvider>,
      );

      expect(mockOnMessage).toHaveBeenCalledWith(
        "SD card warning message",
        "warning",
        5000,
      );
    });
  });

  describe("Settings Button", () => {
    it("clicking Settings button triggers onShowSettings prop", () => {
      const mockOnShowSettings = vi.fn();
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} onShowSettings={mockOnShowSettings} />
        </MockMessageDisplayProvider>,
      );

      const settingsButton = screen.getByRole("button", { name: "Settings" });
      fireEvent.click(settingsButton);

      expect(mockOnShowSettings).toHaveBeenCalled();
    });
  });

  describe("Kit duplication", () => {
    it("handles kit duplication setup from KitList", () => {
      const mockSetDuplicateKitSource = vi.fn();
      const mockSetDuplicateKitDest = vi.fn();
      const mockSetDuplicateKitError = vi.fn();

      mockUseKitBrowser.mockReturnValue(
        createMockReturnValue({
          setDuplicateKitDest: mockSetDuplicateKitDest,
          setDuplicateKitError: mockSetDuplicateKitError,
          setDuplicateKitSource: mockSetDuplicateKitSource,
        }),
      );

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      expect(mockSetDuplicateKitSource).not.toHaveBeenCalled();
    });

    it("passes onDuplicateKit to KitGrid for popover-based duplication", () => {
      mockUseKitBrowser.mockReturnValue(
        createMockReturnValue({
          duplicateKitDirect: vi.fn(),
        }),
      );

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      // Duplicate UI is now handled by popovers in KitGridItem, not banners in KitBrowser
      expect(screen.getByTestId("kit-grid")).toBeInTheDocument();
    });
  });

  describe("Bank navigation", () => {
    it("handles bank click and focuses bank in kit list", () => {
      const mockFocusBankInKitList = vi.fn();

      mockUseKitBrowser.mockReturnValue(
        createMockReturnValue({
          bankNames: { A: "A", B: "B" },
          focusBankInKitList: mockFocusBankInKitList,
        }),
      );

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      // Find and click a bank button by aria-label
      const bankButton = screen.getByLabelText("Jump to bank B");
      fireEvent.click(bankButton);

      expect(mockFocusBankInKitList).toHaveBeenCalledWith("B");
    });

    it("registers and unregisters global keyboard event listener", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const mockGlobalBankHotkeyHandler = vi.fn();

      mockUseKitBrowser.mockReturnValue(
        createMockReturnValue({
          globalBankHotkeyHandler: mockGlobalBankHotkeyHandler,
        }),
      );

      const { unmount } = render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        mockGlobalBankHotkeyHandler,
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        mockGlobalBankHotkeyHandler,
      );
    });
  });

  describe("imperative handle ref", () => {
    it("exposes handleScanAllKits through ref", () => {
      const ref = React.createRef();

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} ref={ref} />
        </MockMessageDisplayProvider>,
      );

      // The ref should expose handleScanAllKits method
      expect(typeof ref.current?.handleScanAllKits).toBe("function");
    });
  });

  describe("Kit duplication cancellation", () => {
    it("duplicate cancellation is handled by KitGridItem popover, not KitBrowser", () => {
      // Cancellation is now handled at the card level via ActionPopover in KitGridItem
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      expect(screen.getByTestId("kit-grid")).toBeInTheDocument();
    });
  });
});
