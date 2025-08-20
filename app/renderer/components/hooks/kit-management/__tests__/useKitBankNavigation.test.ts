import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
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
      })),
      writable: true,
    });

    Object.defineProperty(global.document, "querySelector", {
      value: vi.fn(() => ({ offsetHeight: 60 })),
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
});
