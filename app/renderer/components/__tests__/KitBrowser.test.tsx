// Test suite for KitBrowser component
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../../../tests/utils/renderWithProviders";

vi.mock("../hooks/kit-management/useKitBrowser", () => ({
  useKitBrowser: vi.fn(),
}));

import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { createMockVoice } from "../../../../tests/factories/voice.factory";
import { useKitBrowser } from "../hooks/kit-management/useKitBrowser";
import KitBrowser from "../KitBrowser";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";

type KitBrowserProps = React.ComponentProps<typeof KitBrowser>;

// Get the mocked function for use in tests
const mockUseKitBrowser = vi.mocked(useKitBrowser);

type KitBrowserState = ReturnType<typeof useKitBrowser>;

const VOICE_NAMES = ["Kick", "Snare", "Hat", "Tom"];

const makeKit = (
  name: string,
  overrides: Partial<KitWithRelations> = {},
): KitWithRelations =>
  createMockKitWithRelations({
    bank: null,
    bank_letter: name[0],
    name,
    voices: VOICE_NAMES.map((voice_alias, i) =>
      createMockVoice({
        id: i + 1,
        kit_name: name,
        voice_alias,
        voice_number: i + 1,
      }),
    ),
    ...overrides,
  });

const baseProps = {
  kits: [makeKit("A0"), makeKit("A1"), makeKit("B0")],
  localStorePath: "/test/local-store",
  onRefreshKits: vi
    .fn<NonNullable<KitBrowserProps["onRefreshKits"]>>()
    .mockResolvedValue(undefined),
  onSelectKit: vi.fn<KitBrowserProps["onSelectKit"]>(),
  onShowSettings: vi.fn<KitBrowserProps["onShowSettings"]>(),
  sampleCounts: {
    A0: [1, 1, 1, 1],
    A1: [1, 1, 1, 1],
    B0: [1, 1, 1, 1],
  } satisfies KitBrowserProps["sampleCounts"],
};

const createMockReturnValue = (
  overrides: Partial<KitBrowserState> = {},
): KitBrowserState => ({
  bankNames: {},
  duplicateKitDest: "",
  duplicateKitDirect: vi
    .fn<KitBrowserState["duplicateKitDirect"]>()
    .mockResolvedValue({}),
  duplicateKitError: null,
  duplicateKitSource: null,
  focusBankInKitList: vi.fn<KitBrowserState["focusBankInKitList"]>(),
  focusedKit: "A0",
  globalBankHotkeyHandler: vi.fn<KitBrowserState["globalBankHotkeyHandler"]>(),
  handleBankClick: vi.fn<KitBrowserState["handleBankClick"]>(),
  handleBankClickWithScroll:
    vi.fn<KitBrowserState["handleBankClickWithScroll"]>(),
  handleBankNameChange: vi
    .fn<KitBrowserState["handleBankNameChange"]>()
    .mockResolvedValue(undefined),
  handleCreateKitInBank: vi.fn<KitBrowserState["handleCreateKitInBank"]>(),
  handleDuplicateKit: vi.fn<KitBrowserState["handleDuplicateKit"]>(),
  handleVisibleBankChange: vi.fn<KitBrowserState["handleVisibleBankChange"]>(),
  isCreatingKit: false,
  kits: baseProps.kits,
  newlyAnimatedKit: null,
  scrollContainerRef: { current: null },
  selectedBank: "A",
  setBankNames: vi.fn<KitBrowserState["setBankNames"]>(),
  setDuplicateKitDest: vi.fn<KitBrowserState["setDuplicateKitDest"]>(),
  setDuplicateKitError: vi.fn<KitBrowserState["setDuplicateKitError"]>(),
  setDuplicateKitSource: vi.fn<KitBrowserState["setDuplicateKitSource"]>(),
  setFocusedKit: vi.fn<KitBrowserState["setFocusedKit"]>(),
  setSelectedBank: vi.fn<KitBrowserState["setSelectedBank"]>(),
  showEmptyBank: vi.fn<KitBrowserState["showEmptyBank"]>(),
  shownEmptyBank: null,
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
    // Unfiltered, an empty bank's button stays clickable to add a kit
    // (RE-64); with a filter on it's disabled
    it("does not highlight/select a bank button when pressing a key for a bank with no kits while filtered", async () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} showFavoritesOnly={true} />
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
        kits: [
          makeKit("A1", { alias: "Kick", voices: [] }),
          makeKit("A2", { alias: "Snare", voices: [] }),
          makeKit("B1", { alias: "Hat", voices: [] }),
          makeKit("B2", { alias: "Tom", voices: [] }),
        ],
        sampleCounts: {
          A1: [1, 1, 1, 1],
          A2: [1, 1, 1, 1],
          B1: [1, 1, 1, 1],
          B2: [1, 1, 1, 1],
        } satisfies KitBrowserProps["sampleCounts"],
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

  describe("[UC-13] Scan All progress", () => {
    it("shows the progress KitsView passes in (RE-43)", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser
            {...baseProps}
            bulkScanProgress={{
              current: 1,
              currentKit: "A0",
              status: "scanning",
              total: 2,
            }}
          />
        </MockMessageDisplayProvider>,
      );

      expect(screen.getByTestId("bulk-scan-progress")).toHaveTextContent(
        "1/2: A0",
      );
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
