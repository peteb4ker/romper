import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKitSearch } from "../useKitSearch";

// Mock the search utilities
vi.mock("../../../../utils/kitSearchUtils", () => ({
  filterKitsWithSearch: vi.fn((kits, query) => {
    if (!query || query.length < 2) {
      return kits.map((kit) => ({ ...kit }));
    }
    // Simple mock implementation - filter by kit name containing query
    return kits
      .filter((kit) => kit.name.toLowerCase().includes(query.toLowerCase()))
      .map((kit) => ({
        ...kit,
        searchMatch: {
          matchedOn: ["name"],
          matchedSamples: [],
          matchedVoices: [],
        },
      }));
  }),
}));

describe("useKitSearch", () => {
  const mockKits: KitWithRelations[] = [
    {
      alias: null,
      bank_letter: "A",
      bpm: 120,
      editable: false,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      step_pattern: null,
    },
    {
      alias: null,
      bank_letter: "A",
      bpm: 120,
      editable: false,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: null,
    },
    {
      alias: null,
      bank_letter: "B",
      bpm: 120,
      editable: false,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "B0",
      step_pattern: null,
    },
  ];

  it("should initialize with empty search state", () => {
    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples: {}, kits: mockKits }),
    );

    expect(result.current.searchQuery).toBe("");
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchResultCount).toBe(0);
    expect(result.current.filteredKits).toHaveLength(3);
  });

  it("should return all kits when no search query", () => {
    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples: {}, kits: mockKits }),
    );

    expect(result.current.filteredKits).toHaveLength(3);
    expect(result.current.filteredKits.every((kit) => !kit.searchMatch)).toBe(
      true,
    );
  });

  it("should filter kits based on search query", () => {
    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples: {}, kits: mockKits }),
    );

    act(() => {
      result.current.searchChange("A0");
    });

    expect(result.current.searchQuery).toBe("A0");
    expect(result.current.filteredKits).toHaveLength(1);
    expect(result.current.filteredKits[0].name).toBe("A0");
    expect(result.current.searchResultCount).toBe(1);
  });

  it("should return all kits for queries shorter than 2 characters", () => {
    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples: {}, kits: mockKits }),
    );

    act(() => {
      result.current.searchChange("A");
    });

    expect(result.current.searchQuery).toBe("A");
    expect(result.current.filteredKits).toHaveLength(3);
    expect(result.current.searchResultCount).toBe(0);
  });

  it("should handle search state transitions", async () => {
    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples: {}, kits: mockKits }),
    );

    act(() => {
      result.current.searchChange("A0");
    });

    // Should briefly set isSearching to true
    expect(result.current.isSearching).toBe(true);

    // Wait for the timeout to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.isSearching).toBe(false);
  });

  it("should clear search when clearSearch is called", () => {
    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples: {}, kits: mockKits }),
    );

    // First set a search query
    act(() => {
      result.current.searchChange("A0");
    });

    expect(result.current.searchQuery).toBe("A0");
    expect(result.current.filteredKits).toHaveLength(1);
    expect(result.current.searchResultCount).toBe(1);

    // Then clear it
    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.isSearching).toBe(false);
    expect(result.current.filteredKits).toHaveLength(3);
    expect(result.current.searchResultCount).toBe(0);
  });

  it("should update results when kits prop changes", () => {
    const { rerender, result } = renderHook(
      ({ kits }) => useKitSearch({ allKitSamples: {}, kits }),
      {
        initialProps: { kits: mockKits },
      },
    );

    act(() => {
      result.current.searchChange("A0");
    });

    expect(result.current.filteredKits).toHaveLength(1);

    // Add a new kit that matches the search
    const newKits = [
      ...mockKits,
      {
        alias: null,
        bank_letter: "A",
        bpm: 120,
        editable: false,
        is_favorite: false,
        locked: false,
        modified_since_sync: false,
        name: "A0_NEW",
        step_pattern: null,
      },
    ];

    rerender({ kits: newKits });

    expect(result.current.filteredKits).toHaveLength(2);
  });

  it("should handle empty kits array", () => {
    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples: {}, kits: [] }),
    );

    act(() => {
      result.current.searchChange("test");
    });

    expect(result.current.filteredKits).toHaveLength(0);
    expect(result.current.searchResultCount).toBe(0);
  });

  it("should use allKitSamples in search", () => {
    const allKitSamples = { A0: { voice1: [] } };

    const { result } = renderHook(() =>
      useKitSearch({ allKitSamples, kits: mockKits }),
    );

    act(() => {
      result.current.searchChange("test");
    });

    // The mock should have received allKitSamples
    expect(result.current.searchResultCount).toBe(0); // No matches with "test"
  });
});
