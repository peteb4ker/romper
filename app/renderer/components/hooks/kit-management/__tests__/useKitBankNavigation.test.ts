import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitBankNavigation } from "../useKitBankNavigation";

// Mock the bank operations
vi.mock("../../../utils/bankOperations", () => ({
  bankHasKits: vi.fn((kits, bank) =>
    kits.some((kit: unknown) => kit.name?.[0]?.toUpperCase() === bank),
  ),
  getFirstKitInBank: vi.fn((kits, bank) => {
    const kit = kits.find((k: unknown) => k.name?.[0]?.toUpperCase() === bank);
    return kit?.name || null;
  }),
}));

import { bankHasKits } from "../../../utils/bankOperations";

describe("useKitBankNavigation", () => {
  const mockKits: KitWithRelations[] = [
    {
      alias: null,
      artist: null,
      bank: { artist: "Artist A" },
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      step_pattern: null,
      voices: [],
    },
    {
      alias: null,
      artist: null,
      bank: { artist: "Artist A" },
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: null,
      voices: [],
    },
    {
      alias: null,
      artist: null,
      bank: { artist: "Artist B" },
      bank_letter: "B",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "B0",
      step_pattern: null,
      voices: [],
    },
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
      expect(result.current.bankNames).toEqual({
        A: "Artist A",
        B: "Artist B",
      });
    });

    it("should handle empty kits array", () => {
      const emptyProps = { ...defaultProps, kits: [] };
      const { result } = renderHook(() => useKitBankNavigation(emptyProps));

      expect(result.current.selectedBank).toBe("A");
      expect(result.current.focusedKit).toBeNull();
      expect(result.current.bankNames).toEqual({});
    });
  });

  describe("bank name generation", () => {
    it("should generate bank names from kit data", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      expect(result.current.bankNames).toEqual({
        A: "Artist A",
        B: "Artist B",
      });
    });

    it("should handle kits without bank artists", () => {
      const kitsWithoutArtists = [
        { ...mockKits[0], bank: null },
        { ...mockKits[1], bank: { artist: null } },
      ];
      const props = { ...defaultProps, kits: kitsWithoutArtists };
      const { result } = renderHook(() => useKitBankNavigation(props));

      expect(result.current.bankNames).toEqual({});
    });
  });

  describe("[UC-12] names of banks without loaded kits (RE-90)", () => {
    const bankRow = (letter: string, artist: null | string) => ({
      artist,
      letter,
      rtf_filename: artist ? `${letter} - ${artist}.rtf` : null,
      scanned_at: null,
    });

    beforeEach(() => {
      vi.mocked(globalThis.electronAPI.getAllBanks).mockResolvedValue({
        data: [
          bankRow("A", "Artist A"),
          bankRow("B", "Artist B"),
          bankRow("C", "Empty Bank"),
          bankRow("D", null),
        ],
        success: true,
      });
    });

    it("loads every bank's name from the banks, not the kits", async () => {
      const { result } = renderHook(() =>
        useKitBankNavigation({ ...defaultProps, localStorePath: "/store" }),
      );

      await waitFor(() =>
        expect(result.current.bankNames).toEqual({
          A: "Artist A",
          B: "Artist B",
          C: "Empty Bank",
        }),
      );
    });

    it("keeps a bank's name when its kits are filtered out", async () => {
      const { rerender, result } = renderHook(
        (props) => useKitBankNavigation(props),
        { initialProps: { ...defaultProps, localStorePath: "/store" } },
      );
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

    it("keeps a name given to an empty bank when the kits reload", async () => {
      vi.mocked(globalThis.electronAPI.updateBank).mockResolvedValue({
        success: true,
      });
      const { rerender, result } = renderHook(
        (props) => useKitBankNavigation(props),
        { initialProps: { ...defaultProps, localStorePath: "/store" } },
      );
      await waitFor(() =>
        expect(result.current.bankNames.C).toBe("Empty Bank"),
      );

      await act(() => result.current.handleBankNameChange("D", "New Name"));
      rerender({
        ...defaultProps,
        kits: [...mockKits],
        localStorePath: "/store",
      });

      expect(result.current.bankNames.D).toBe("New Name");
    });

    it("takes a reloaded kit's bank name over the loaded one", async () => {
      const { rerender, result } = renderHook(
        (props) => useKitBankNavigation(props),
        { initialProps: { ...defaultProps, localStorePath: "/store" } },
      );
      await waitFor(() =>
        expect(result.current.bankNames.C).toBe("Empty Bank"),
      );

      rerender({
        ...defaultProps,
        kits: [{ ...mockKits[2], bank: { artist: null } }],
        localStorePath: "/store",
      });

      expect(result.current.bankNames).toEqual({
        A: "Artist A",
        C: "Empty Bank",
      });
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
      const mockScrollContainer = {
        getBoundingClientRect: () => ({ top: 0 }),
        scrollTo: vi.fn(),
        scrollTop: 0,
      };
      result.current.scrollContainerRef.current = mockScrollContainer;

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
      } as unknown;

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

    // #504: Shift+F stars the focused kit, so it doesn't also jump to bank F
    it("[UC-10] leaves Shift+F to the star and jumps on plain F", () => {
      const kits = [...mockKits, { ...mockKits[2], name: "F0" }];
      const { result } = renderHook(() =>
        useKitBankNavigation({ ...defaultProps, kits }),
      );
      const press = (key: string, shiftKey: boolean) => {
        const e = {
          key,
          preventDefault: vi.fn(),
          shiftKey,
          target: { tagName: "DIV" },
        } as unknown as KeyboardEvent;
        act(() => {
          result.current.globalBankHotkeyHandler(e);
        });
        return e;
      };

      const shifted = press("F", true);
      expect(result.current.focusedKit).toBe("A0");
      expect(shifted.preventDefault).not.toHaveBeenCalled();

      press("f", false);
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
      } as unknown;

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
      } as unknown;

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
      } as unknown;

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
      } as unknown;

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
      } as unknown;

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

    it("should handle kitListRef without scrollAndFocusKitByIndex method", () => {
      const propsWithIncompleteRef = {
        ...defaultProps,
        kitListRef: { current: {} },
      };
      const { result } = renderHook(() =>
        useKitBankNavigation(propsWithIncompleteRef),
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

      const mockScrollContainer = {
        getBoundingClientRect: () => ({ top: 0 }),
        scrollTo: vi.fn(),
        scrollTop: 0,
      };
      result.current.scrollContainerRef.current = mockScrollContainer;

      act(() => {
        result.current.handleBankClickWithScroll("B");
        // Simulate intermediate IntersectionObserver callback
        result.current.handleVisibleBankChange("A");
      });

      expect(result.current.selectedBank).toBe("B");
    });

    it("should suppress handleVisibleBankChange during hotkey navigation", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      const mockScrollContainer = {
        getBoundingClientRect: () => ({ top: 0 }),
        scrollTo: vi.fn(),
        scrollTop: 0,
      };
      result.current.scrollContainerRef.current = mockScrollContainer;

      const mockEvent = {
        key: "B",
        preventDefault: vi.fn(),
        target: { tagName: "DIV" },
      } as unknown;

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

      const mockScrollContainer = {
        getBoundingClientRect: () => ({ top: 0 }),
        scrollTo: vi.fn(),
        scrollTop: 0,
      };
      result.current.scrollContainerRef.current = mockScrollContainer;

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

      const mockScrollContainer = {
        getBoundingClientRect: () => ({ top: 0 }),
        scrollTo: vi.fn(),
        scrollTop: 0,
      };
      result.current.scrollContainerRef.current = mockScrollContainer;

      act(() => {
        result.current.handleBankClickWithScroll("B");
        result.current.handleBankClickWithScroll("A");
      });

      expect(result.current.selectedBank).toBe("A");
    });

    it("should suppress multiple intermediate header changes", () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      const mockScrollContainer = {
        getBoundingClientRect: () => ({ top: 0 }),
        scrollTo: vi.fn(),
        scrollTop: 0,
      };
      result.current.scrollContainerRef.current = mockScrollContainer;

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
    it("saves a new name and shows it", async () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

      await act(async () => {
        await result.current.handleBankNameChange("A", "New Artist");
      });

      expect(globalThis.electronAPI.updateBank).toHaveBeenCalledWith("A", {
        artist: "New Artist",
      });
      expect(result.current.bankNames.A).toBe("New Artist");
    });

    it("clears the name with null (RE-23)", async () => {
      const { result } = renderHook(() => useKitBankNavigation(defaultProps));

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
      const { result } = renderHook(() =>
        useKitBankNavigation({ ...defaultProps, onMessage }),
      );

      await act(async () => {
        await result.current.handleBankNameChange("A", "AC/DC");
      });

      expect(onMessage).toHaveBeenCalledWith(
        "A bank name can't contain /",
        "error",
      );
      expect(result.current.bankNames.A).toBe("Artist A");
    });
  });
});
