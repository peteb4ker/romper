import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../../../tests/factories/kit.factory";
import { useKitBankNavigation } from "../useKitBankNavigation";

// Mock the bank operations
vi.mock("../../../utils/bankOperations", () => ({
  bankHasKits: vi.fn((kits: KitWithRelations[], bank: string) =>
    kits.some((kit) => kit.name?.[0]?.toUpperCase() === bank),
  ),
  getFirstKitInBank: vi.fn((kits: KitWithRelations[], bank: string) => {
    const kit = kits.find((k) => k.name?.[0]?.toUpperCase() === bank);
    return kit?.name || null;
  }),
}));

import { bankHasKits } from "../../../utils/bankOperations";

/** A bank row as the kits load it. */
const bankOf = (letter: string, artist: null | string) => ({
  artist,
  letter,
  rtf_filename: null,
  scanned_at: null,
});

/** A scroll container whose scrollTo is a mock (jsdom doesn't scroll). */
const scrollContainer = () => {
  const container = document.createElement("div");
  container.scrollTo = vi.fn();
  return container;
};

describe("useKitBankNavigation", () => {
  const mockKits: KitWithRelations[] = [
    createMockKitWithRelations({
      bank: bankOf("A", "Artist A"),
      bank_letter: "A",
      name: "A0",
    }),
    createMockKitWithRelations({
      bank: bankOf("A", "Artist A"),
      bank_letter: "A",
      name: "A1",
    }),
    createMockKitWithRelations({
      bank: bankOf("B", "Artist B"),
      bank_letter: "B",
      name: "B0",
    }),
  ];

  const mockKitListRef = {
    current: {
      scrollAndFocusKitByIndex: vi.fn(),
    },
  };

  const defaultProps = {
    kitListRef: mockKitListRef,
    kits: mockKits,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock DOM methods
    Object.defineProperty(global.document, "getElementById", {
      value: vi.fn(() => ({
        getBoundingClientRect: () => ({ top: 100 }),
        scrollIntoView: vi.fn(),
      })),
      writable: true,
    });

    // The sticky header the scroll offsets against; nothing else (no dialog)
    Object.defineProperty(global.document, "querySelector", {
      value: vi.fn((selector: string) =>
        selector === ".sticky.top-0" ? { offsetHeight: 60 } : null,
      ),
      writable: true,
    });
  });

  describe("initial state", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      expect(result.current.selectedBank).toBe("A");
      expect(result.current.focusedKit).toBe("A0"); // First kit
      // Names come from the banks, which load once a store is open
      expect(result.current.bankNames).toEqual({});
    });

    it("should handle empty kits array", () => {
      const emptyProps = { ...defaultProps, kits: [] };
      const { result } = renderHook(() => useKitBankNavigation(emptyProps));

      expect(result.current.selectedBank).toBe("A");
      expect(result.current.focusedKit).toBeNull();
      expect(result.current.bankNames).toEqual({});
    });
  });

  // #567: bank names have one owner, the banks table. The browser reads
  // them only from get-all-banks, never from the kits' copies, and reads
  // them again after anything that changes them.
  describe("[UC-12] bank names come only from the banks (RE-90, #567)", () => {
    let storedNames: Record<string, null | string>;

    const bankRow = (letter: string, artist: null | string) => ({
      artist,
      letter,
      rtf_filename: artist ? `${letter} - ${artist}.rtf` : null,
      scanned_at: null,
    });

    beforeEach(() => {
      // Main's banks table: get-all-banks reads it, update-bank changes it
      storedNames = { A: "Artist A", B: "Artist B", C: "Empty Bank", D: null };
      vi.mocked(globalThis.electronAPI.getAllBanks).mockImplementation(
        async () => ({
          data: Object.entries(storedNames).map(([letter, artist]) =>
            bankRow(letter, artist),
          ),
          success: true,
        }),
      );
      vi.mocked(globalThis.electronAPI.updateBank).mockImplementation(
        async (letter, { artist }) => {
          storedNames[letter] = artist ?? null;
          return { success: true };
        },
      );
    });

    const renderInStore = (localStorePath: null | string = "/store") =>
      renderHook((props) => useKitBankNavigation(props), {
        initialProps: { ...defaultProps, localStorePath },
      });

    it("loads every bank's name from the banks, not the kits", async () => {
      const { result } = renderInStore();

      await waitFor(() =>
        expect(result.current.bankNames).toEqual({
          A: "Artist A",
          B: "Artist B",
          C: "Empty Bank",
        }),
      );
    });

    it("keeps a bank's name when its kits are filtered out", async () => {
      const { rerender, result } = renderInStore();
      await waitFor(() =>
        expect(result.current.bankNames.C).toBe("Empty Bank"),
      );

      rerender({
        ...defaultProps,
        kits: [mockKits[2]],
        localStorePath: "/store",
      });

      expect(result.current.bankNames).toEqual({
        A: "Artist A",
        B: "Artist B",
        C: "Empty Bank",
      });
    });

    it("shows a name given to an empty bank without a relaunch", async () => {
      const { result } = renderInStore();
      await waitFor(() =>
        expect(result.current.bankNames.C).toBe("Empty Bank"),
      );

      await act(() => result.current.handleBankNameChange("D", "New Name"));

      expect(result.current.bankNames.D).toBe("New Name");
      // Read back from the banks, as main stored it
      expect(globalThis.electronAPI.getAllBanks).toHaveBeenCalledTimes(2);
    });

    it("shows the names setup imported once the new store opens", async () => {
      // Setup imported the card's or the factory archive's names into the
      // new store before it was opened, D's for a bank with no kits
      storedNames = { A: "ALWIS", D: "RICHARD DEVINE" };
      const { rerender, result } = renderInStore(null);
      expect(result.current.bankNames).toEqual({});

      rerender({ ...defaultProps, kits: [], localStorePath: "/new-store" });

      await waitFor(() =>
        expect(result.current.bankNames).toEqual({
          A: "ALWIS",
          D: "RICHARD DEVINE",
        }),
      );
    });

    it("ignores the bank names reloaded kits carry", async () => {
      const { rerender, result } = renderInStore();
      await waitFor(() =>
        expect(result.current.bankNames.C).toBe("Empty Bank"),
      );

      rerender({
        ...defaultProps,
        kits: [
          { ...mockKits[0], bank: bankOf("A", "Stale A") },
          { ...mockKits[2], bank: bankOf("B", null) },
        ],
        localStorePath: "/store",
      });

      expect(result.current.bankNames).toEqual({
        A: "Artist A",
        B: "Artist B",
        C: "Empty Bank",
      });
    });

    it("drops a store's names that arrive after it was switched", async () => {
      let answerOldStore: () => void = () => {};
      vi.mocked(globalThis.electronAPI.getAllBanks).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerOldStore = () =>
              resolve({ data: [bankRow("A", "Old Store")], success: true });
          }),
      );
      const { rerender, result } = renderInStore("/old-store");

      rerender({ ...defaultProps, localStorePath: "/store" });
      await waitFor(() =>
        expect(result.current.bankNames.C).toBe("Empty Bank"),
      );
      await act(async () => answerOldStore());

      expect(result.current.bankNames.A).toBe("Artist A");
    });

    it("doesn't load names without a store", () => {
      renderHook(() => useKitBankNavigation(defaultProps));

      expect(globalThis.electronAPI.getAllBanks).not.toHaveBeenCalled();
    });
  });

  describe("bank selection", () => {
    it("should update focused kit when selected bank changes", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.setSelectedBank("B");
      });

      expect(result.current.selectedBank).toBe("B");
      expect(result.current.focusedKit).toBe("B0");
    });

    it("should not update focused kit for bank without kits", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      // Mock bankHasKits to return false for bank C
      vi.mocked(bankHasKits).mockReturnValueOnce(false);

      act(() => {
        result.current.setSelectedBank("C");
      });

      expect(result.current.selectedBank).toBe("C");
      // Focus should remain on previous kit since C has no kits
    });
  });

  describe("bank clicking", () => {
    it("should handle bank click with scroll", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      // Mock scrollContainerRef
      result.current.scrollContainerRef.current = scrollContainer();

      act(() => {
        result.current.handleBankClickWithScroll("B");
      });

      expect(result.current.selectedBank).toBe("B");
    });

    it("should not handle click for bank without kits", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      const initialBank = result.current.selectedBank;

      // Mock bankHasKits to return false
      vi.mocked(bankHasKits).mockReturnValueOnce(false);

      act(() => {
        result.current.handleBankClickWithScroll("C");
      });

      expect(result.current.selectedBank).toBe(initialBank); // Should not change
    });
  });

  describe("keyboard navigation", () => {
    it("should handle A-Z hotkeys", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      const mockEvent = {
        key: "B",
        preventDefault: vi.fn(),
        target: { tagName: "DIV" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
      });

      expect(result.current.selectedBank).toBe("B");
      expect(result.current.focusedKit).toBe("B0");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    // RE-38: Cmd/Ctrl/Alt combinations belong to the menu and the system
    it.each(["metaKey", "ctrlKey", "altKey"])(
      "[UC-07] ignores a letter with %s held",
      (modifier) => {
        const { result } = renderHook(() => useKitBankNavigation(defaultProps));
        const before = result.current.focusedKit;

        const mockEvent = {
          key: "b",
          [modifier]: true,
          preventDefault: vi.fn(),
          target: { tagName: "DIV" },
        } as unknown as KeyboardEvent;

        act(() => {
          result.current.globalBankHotkeyHandler(mockEvent);
        });

        expect(result.current.focusedKit).toBe(before);
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      },
    );

    // #552: F is bank F's jump again; ";" toggles the favorite instead
    it("[UC-10] jumps to bank F on F and leaves ; alone", () => {
      const kits = [...mockKits, { ...mockKits[2], name: "F0" }];
      const { result } = renderHook(() =>
        useKitBankNavigation({ ...defaultProps, kits }),
      );
      const press = (key: string) => {
        const e = {
          key,
          preventDefault: vi.fn(),
          target: { tagName: "DIV" },
        } as unknown as KeyboardEvent;
        act(() => {
          result.current.globalBankHotkeyHandler(e);
        });
        return e;
      };

      const semicolon = press(";");
      expect(result.current.focusedKit).toBe("A0");
      expect(semicolon.preventDefault).not.toHaveBeenCalled();

      press("F");
      expect(result.current.focusedKit).toBe("F0");
    });

    // #500: a bank letter pressed in a dialog jumped banks behind it
    it("[UC-07] ignores bank letters while a modal dialog is open", () => {
      vi.mocked(document.querySelector).mockImplementation(((
        selector: string,
      ) =>
        selector.includes('aria-modal="true"')
          ? ({} as Element)
          : null) as typeof document.querySelector);
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      const before = result.current.focusedKit;
      const mockEvent = {
        key: "b",
        preventDefault: vi.fn(),
        target: { tagName: "BODY" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
      });

      expect(result.current.focusedKit).toBe(before);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("should scroll grid via scrollAndFocusKitByIndex on hotkey press", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      const mockEvent = {
        key: "B",
        preventDefault: vi.fn(),
        target: { tagName: "DIV" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
      });

      // The hotkey must trigger the same scroll path as a sidebar click
      expect(
        mockKitListRef.current.scrollAndFocusKitByIndex,
      ).toHaveBeenCalledWith(2); // B0 is at index 2
    });

    it("should ignore hotkeys when typing in inputs", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      const initialBank = result.current.selectedBank;

      const mockEvent = {
        key: "B",
        preventDefault: vi.fn(),
        target: { tagName: "INPUT" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
      });

      expect(result.current.selectedBank).toBe(initialBank); // Should not change
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("should ignore hotkeys in textarea", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      const initialBank = result.current.selectedBank;

      const mockEvent = {
        key: "B",
        preventDefault: vi.fn(),
        target: { tagName: "TEXTAREA" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
      });

      expect(result.current.selectedBank).toBe(initialBank); // Should not change
    });

    it("should ignore non-letter keys", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      const initialBank = result.current.selectedBank;

      const mockEvent = {
        key: "1",
        preventDefault: vi.fn(),
        target: { tagName: "DIV" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
      });

      expect(result.current.selectedBank).toBe(initialBank); // Should not change
    });

    it("should ignore keys for banks without kits", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      const initialBank = result.current.selectedBank;

      // Mock bankHasKits to return false for bank Z
      vi.mocked(bankHasKits).mockReturnValueOnce(false);

      const mockEvent = {
        key: "Z",
        preventDefault: vi.fn(),
        target: { tagName: "DIV" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
      });

      expect(result.current.selectedBank).toBe(initialBank); // Should not change
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("virtualization support", () => {
    it("should focus bank in kit list", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.focusBankInKitList("B");
      });

      expect(result.current.selectedBank).toBe("B");
      expect(result.current.focusedKit).toBe("B0");
      expect(
        mockKitListRef.current.scrollAndFocusKitByIndex,
      ).toHaveBeenCalledWith(2); // B0 is at index 2
    });

    it("should not focus bank without kits in list", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      const initialBank = result.current.selectedBank;

      act(() => {
        result.current.focusBankInKitList("Z"); // No kits in bank Z
      });

      expect(result.current.selectedBank).toBe(initialBank); // Should not change
      expect(
        mockKitListRef.current.scrollAndFocusKitByIndex,
      ).not.toHaveBeenCalled();
    });

    it("should handle missing kitListRef", () => {
      const propsWithoutRef = {
        ...defaultProps,
        kitListRef: { current: null },
      };
      const { result } = renderHook(() =>
        useKitBankNavigation(propsWithoutRef),
      );

      act(() => {
        result.current.focusBankInKitList("B");
      });

      expect(result.current.selectedBank).toBe("A");
    });
  });

  describe("visible bank change handler", () => {
    it("should handle visible bank change", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.handleVisibleBankChange("C");
      });

      expect(result.current.selectedBank).toBe("C");
    });

    it("should handle invalid bank letters", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      // Should handle numeric bank letter
      act(() => {
        result.current.handleVisibleBankChange("1");
      });
      expect(result.current.selectedBank).toBe("1");

      // Should handle empty string
      act(() => {
        result.current.handleVisibleBankChange("");
      });
      expect(result.current.selectedBank).toBe("");
    });

    it("should maintain state across re-renders", () => {
      const { rerender, result } = renderHook(() =>
        useKitBankNavigation(defaultProps),
      );

      // Change to bank 'C'
      act(() => {
        result.current.handleVisibleBankChange("C");
      });
      expect(result.current.selectedBank).toBe("C");

      // Re-render should maintain the state
      rerender();
      expect(result.current.selectedBank).toBe("C");
    });
  });

  describe("[UC-14] showing an empty bank (RE-64)", () => {
    it("shows and selects a bank with no kits", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));
      expect(result.current.shownEmptyBank).toBeNull();

      act(() => {
        result.current.showEmptyBank("C");
        // A visible-bank update fired while the grid scrolls to it
        result.current.handleVisibleBankChange("A");
      });

      expect(result.current.shownEmptyBank).toBe("C");
      expect(result.current.selectedBank).toBe("C");
    });
  });

  describe("programmatic scroll suppression", () => {
    it("should suppress handleVisibleBankChange during bank click", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      result.current.scrollContainerRef.current = scrollContainer();

      act(() => {
        result.current.handleBankClickWithScroll("B");
        // Simulate intermediate IntersectionObserver callback
        result.current.handleVisibleBankChange("A");
      });

      expect(result.current.selectedBank).toBe("B");
    });

    it("should suppress handleVisibleBankChange during hotkey navigation", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      result.current.scrollContainerRef.current = scrollContainer();

      const mockEvent = {
        key: "B",
        preventDefault: vi.fn(),
        target: { tagName: "DIV" },
      } as unknown as KeyboardEvent;

      act(() => {
        result.current.globalBankHotkeyHandler(mockEvent);
        // Simulate intermediate IntersectionObserver callback
        result.current.handleVisibleBankChange("A");
      });

      expect(result.current.selectedBank).toBe("B");
    });

    it("should suppress handleVisibleBankChange during focusBankInKitList", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.focusBankInKitList("B");
        // Simulate intermediate IntersectionObserver callback
        result.current.handleVisibleBankChange("A");
      });

      expect(result.current.selectedBank).toBe("B");
    });

    it("should allow handleVisibleBankChange during manual scroll", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.handleVisibleBankChange("B");
      });

      expect(result.current.selectedBank).toBe("B");
    });

    it("should reset flag after instant scroll via double-rAF", () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      result.current.scrollContainerRef.current = scrollContainer();

      act(() => {
        result.current.handleBankClickWithScroll("B");
      });

      // Simulate double-rAF completing
      act(() => {
        vi.runAllTimers();
      });

      // handleVisibleBankChange should work again
      act(() => {
        result.current.handleVisibleBankChange("A");
      });

      expect(result.current.selectedBank).toBe("A");

      vi.useRealTimers();
    });

    it("should reset flag after smooth scroll via 1000ms timeout", () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.focusBankInKitList("B");
      });

      // Advance past 1000ms timeout
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      // handleVisibleBankChange should work again
      act(() => {
        result.current.handleVisibleBankChange("A");
      });

      expect(result.current.selectedBank).toBe("A");

      vi.useRealTimers();
    });

    it("should resolve to last target on rapid successive clicks", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      result.current.scrollContainerRef.current = scrollContainer();

      act(() => {
        result.current.handleBankClickWithScroll("B");
        result.current.handleBankClickWithScroll("A");
      });

      expect(result.current.selectedBank).toBe("A");
    });

    it("should suppress multiple intermediate header changes", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      result.current.scrollContainerRef.current = scrollContainer();

      act(() => {
        result.current.handleBankClickWithScroll("B");
        // Simulate 3 intermediate IntersectionObserver callbacks
        result.current.handleVisibleBankChange("A");
        result.current.handleVisibleBankChange("C");
        result.current.handleVisibleBankChange("D");
      });

      expect(result.current.selectedBank).toBe("B");
    });

    it("should restore target bank after smooth scroll timeout clears", () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.focusBankInKitList("B");
      });

      // After timeout, selectedBank should be restored to target "B"
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(result.current.selectedBank).toBe("B");

      vi.useRealTimers();
    });

    it("[Q-07] clears the hold timer when it unmounts (#709)", () => {
      vi.useFakeTimers();
      try {
        const { result, unmount } = renderHook(() =>
          useKitBankNavigation(defaultProps),
        );
        act(() => {
          result.current.showEmptyBank("C");
        });
        expect(vi.getTimerCount()).toBe(1);

        unmount();

        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("state setters", () => {
    it("should allow manual state updates", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      act(() => {
        result.current.setFocusedKit("A1");
      });
      expect(result.current.focusedKit).toBe("A1");

      act(() => {
        result.current.setBankNames({ Z: "Custom Bank" });
      });
      expect(result.current.bankNames).toEqual({ Z: "Custom Bank" });
    });
  });
  describe("[UC-12] handleBankNameChange", () => {
    const props = { ...defaultProps, localStorePath: "/store" };

    beforeEach(() => {
      // Main's names before and after the save
      vi.mocked(globalThis.electronAPI.getAllBanks)
        .mockReset()
        .mockResolvedValueOnce({
          data: [
            {
              artist: "Artist A",
              letter: "A",
              rtf_filename: null,
              scanned_at: null,
            },
          ],
          success: true,
        })
        .mockResolvedValueOnce({
          data: [
            {
              artist: "New Artist",
              letter: "A",
              rtf_filename: null,
              scanned_at: null,
            },
          ],
          success: true,
        });
    });

    const renderLoaded = async (onMessage?: () => void) => {
      const hook = renderHook(() =>
        useKitBankNavigation({ ...props, onMessage }),
      );
      await waitFor(() =>
        expect(hook.result.current.bankNames.A).toBe("Artist A"),
      );
      return hook;
    };

    it("saves a new name and shows it", async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handleBankNameChange("A", "New Artist");
      });

      expect(globalThis.electronAPI.updateBank).toHaveBeenCalledWith("A", {
        artist: "New Artist",
      });
      expect(result.current.bankNames.A).toBe("New Artist");
    });

    it("clears the name with null (RE-23)", async () => {
      vi.mocked(globalThis.electronAPI.getAllBanks)
        .mockReset()
        .mockResolvedValueOnce({
          data: [
            {
              artist: "Artist A",
              letter: "A",
              rtf_filename: null,
              scanned_at: null,
            },
          ],
          success: true,
        })
        .mockResolvedValueOnce({
          data: [
            { artist: null, letter: "A", rtf_filename: null, scanned_at: null },
          ],
          success: true,
        });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handleBankNameChange("A", "");
      });

      expect(globalThis.electronAPI.updateBank).toHaveBeenCalledWith("A", {
        artist: null,
      });
      expect(result.current.bankNames.A).toBeUndefined();
    });

    it("reports a name main refuses and keeps the old one", async () => {
      vi.mocked(globalThis.electronAPI.updateBank).mockResolvedValueOnce({
        error: "A bank name can't contain /",
        success: false,
      });
      const onMessage = vi.fn();
      const { result } = await renderLoaded(onMessage);

      await act(async () => {
        await result.current.handleBankNameChange("A", "AC/DC");
      });

      expect(onMessage).toHaveBeenCalledWith(
        "A bank name can't contain /",
        "error",
      );
      expect(result.current.bankNames.A).toBe("Artist A");
    });

    it("[Q-02] reports a name main gives no answer for and keeps the old one (#543)", async () => {
      // The preload method is missing, so the optional call gives undefined
      vi.mocked(globalThis.electronAPI.updateBank).mockResolvedValueOnce(
        undefined as never,
      );
      const onMessage = vi.fn();
      const { result } = await renderLoaded(onMessage);

      await act(async () => {
        await result.current.handleBankNameChange("A", "New Artist");
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't save the name of bank A",
        "error",
      );
      expect(result.current.bankNames.A).toBe("Artist A");
    });
  });
});
