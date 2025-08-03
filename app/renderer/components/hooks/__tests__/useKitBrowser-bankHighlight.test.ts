import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KitWithRelations } from "../../../../../shared/db/schema";

import { useKitBrowser } from "../useKitBrowser";

describe("useKitBrowser Bank Highlighting", () => {
  const mockKits: KitWithRelations[] = [
    {
      alias: null,
      artist: null,
      bank: {
        artist: "Test Artist A",
        letter: "A",
        rtf_filename: null,
        scanned_at: null,
      },
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: null,
    },
    {
      alias: null,
      artist: null,
      bank: {
        artist: "Test Artist A",
        letter: "A",
        rtf_filename: null,
        scanned_at: null,
      },
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A2",
      step_pattern: null,
    },
    {
      alias: null,
      artist: null,
      bank: {
        artist: "Test Artist B",
        letter: "B",
        rtf_filename: null,
        scanned_at: null,
      },
      bank_letter: "B",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "B1",
      step_pattern: null,
    },
    {
      alias: null,
      artist: null,
      bank: {
        artist: "Test Artist B",
        letter: "B",
        rtf_filename: null,
        scanned_at: null,
      },
      bank_letter: "B",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "B2",
      step_pattern: null,
    },
  ];

  const defaultProps = {
    kitListRef: { current: null },
    kits: mockKits,
    onMessage: vi.fn(),
    onRefreshKits: vi.fn(),
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
    const { result } = renderHook(() => useKitBrowser(defaultProps));

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
    const { rerender, result } = renderHook(() => useKitBrowser(defaultProps));

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
        alias: null,
        artist: null,
        bank: {
          artist: "Test Artist A",
          letter: "A",
          rtf_filename: null,
          scanned_at: null,
        },
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      },
      {
        alias: null,
        artist: null,
        bank: {
          artist: "Test Artist B",
          letter: "B",
          rtf_filename: null,
          scanned_at: null,
        },
        bank_letter: "B",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "B1",
        step_pattern: null,
      },
      {
        alias: null,
        artist: null,
        bank: {
          artist: "Test Artist C",
          letter: "C",
          rtf_filename: null,
          scanned_at: null,
        },
        bank_letter: "C",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "C1",
        step_pattern: null,
      },
    ];

    const { result } = renderHook(() =>
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
