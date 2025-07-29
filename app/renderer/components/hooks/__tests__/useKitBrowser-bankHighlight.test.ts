import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KitWithRelations } from "../../../../../shared/db/schema";
import { useKitBrowser } from "../useKitBrowser";

describe("useKitBrowser Bank Highlighting", () => {
  const mockKits: KitWithRelations[] = [
    {
      name: "A1",
      bank_letter: "A",
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      step_pattern: null,
      modified_since_sync: false,
      bank: {
        letter: "A",
        artist: "Test Artist A",
        rtf_filename: null,
        scanned_at: null,
      },
    },
    {
      name: "A2",
      bank_letter: "A",
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      step_pattern: null,
      modified_since_sync: false,
      bank: {
        letter: "A",
        artist: "Test Artist A",
        rtf_filename: null,
        scanned_at: null,
      },
    },
    {
      name: "B1",
      bank_letter: "B",
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      step_pattern: null,
      modified_since_sync: false,
      bank: {
        letter: "B",
        artist: "Test Artist B",
        rtf_filename: null,
        scanned_at: null,
      },
    },
    {
      name: "B2",
      bank_letter: "B",
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      step_pattern: null,
      modified_since_sync: false,
      bank: {
        letter: "B",
        artist: "Test Artist B",
        rtf_filename: null,
        scanned_at: null,
      },
    },
  ];

  const defaultProps = {
    kits: mockKits,
    onRefreshKits: vi.fn(),
    kitListRef: { current: null },
    onMessage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes selectedBank to 'A'", () => {
    const { result } = renderHook(() => useKitBrowser(defaultProps));

    expect(result.current.selectedBank).toBe("A");
  });

  it("provides handleVisibleBankChange function", () => {
    const { result } = renderHook(() => useKitBrowser(defaultProps));

    expect(result.current.handleVisibleBankChange).toBeInstanceOf(Function);
  });

  it("updates selectedBank when handleVisibleBankChange is called", () => {
    const { result } = renderHook(() => useKitBrowser(defaultProps));

    // Initially should be 'A'
    expect(result.current.selectedBank).toBe("A");

    // Call the handler to change to bank 'B'
    act(() => {
      result.current.handleVisibleBankChange("B");
    });

    // Should update to 'B'
    expect(result.current.selectedBank).toBe("B");
  });

  it("handles edge cases with invalid bank letters", () => {
    const { result, rerender } = renderHook(() => useKitBrowser(defaultProps));

    // Should handle invalid bank letters gracefully
    act(() => {
      result.current.handleVisibleBankChange("1"); // Invalid
    });
    expect(result.current.selectedBank).toBe("1"); // Still updates (validation happens elsewhere)

    act(() => {
      result.current.handleVisibleBankChange(""); // Empty
    });
    expect(result.current.selectedBank).toBe(""); // Still updates
  });

  it("maintains selectedBank state across re-renders", () => {
    const { result, rerender } = renderHook(() => useKitBrowser(defaultProps));

    // Change to bank 'C'
    act(() => {
      result.current.handleVisibleBankChange("C");
    });
    expect(result.current.selectedBank).toBe("C");

    // Re-render should maintain the state
    rerender();
    expect(result.current.selectedBank).toBe("C");
  });

  it("works with bank click handlers", () => {
    const testKits: KitWithRelations[] = [
      {
        name: "A1",
        bank_letter: "A",
        alias: null,
        artist: null,
        editable: false,
        locked: false,
        step_pattern: null,
        modified_since_sync: false,
        bank: {
          letter: "A",
          artist: "Test Artist A",
          rtf_filename: null,
          scanned_at: null,
        },
      },
      {
        name: "B1",
        bank_letter: "B",
        alias: null,
        artist: null,
        editable: false,
        locked: false,
        step_pattern: null,
        modified_since_sync: false,
        bank: {
          letter: "B",
          artist: "Test Artist B",
          rtf_filename: null,
          scanned_at: null,
        },
      },
      {
        name: "C1",
        bank_letter: "C",
        alias: null,
        artist: null,
        editable: false,
        locked: false,
        step_pattern: null,
        modified_since_sync: false,
        bank: {
          letter: "C",
          artist: "Test Artist C",
          rtf_filename: null,
          scanned_at: null,
        },
      },
    ];

    const { result, rerender } = renderHook(() =>
      useKitBrowser({
        ...defaultProps,
        kits: testKits, // Ensure banks have kits
      }),
    );

    // Set initial bank via scroll
    act(() => {
      result.current.handleVisibleBankChange("B");
    });
    expect(result.current.selectedBank).toBe("B");

    // Bank click should also update selectedBank
    act(() => {
      result.current.handleBankClickWithScroll("C");
    });
    expect(result.current.selectedBank).toBe("C");
  });
});
