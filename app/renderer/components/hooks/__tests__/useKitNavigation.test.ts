import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KitWithRelations } from "../../../../../shared/db/schema";
import type { VoiceSamples } from "../../kitTypes";

import { useKitNavigation } from "../useKitNavigation";

describe("useKitNavigation", () => {
  const mockKits: KitWithRelations[] = [
    {
      alias: null,
      bank_letter: "A",
      editable: false,
      name: "A0",
    } as KitWithRelations,
    {
      alias: null,
      bank_letter: "A",
      editable: false,
      name: "A1",
    } as KitWithRelations,
    {
      alias: null,
      bank_letter: "B",
      editable: false,
      name: "B0",
    } as KitWithRelations,
  ];

  const mockAllKitSamples: { [kit: string]: VoiceSamples } = {
    A0: { 1: ["kick.wav"], 2: [], 3: [], 4: [] },
    A1: { 1: ["snare.wav"], 2: [], 3: [], 4: [] },
    B0: { 1: ["hat.wav"], 2: [], 3: [], 4: [] },
  };

  const mockRefreshAllKitsAndSamples = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with no selected kit", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    expect(result.current.selectedKit).toBeNull();
    expect(result.current.selectedKitSamples).toBeNull();
    expect(result.current.currentKitIndex).toBe(-1);
  });

  it("should select a kit", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("A0");
    });

    expect(result.current.selectedKit).toBe("A0");
    expect(result.current.currentKitIndex).toBe(0);
  });

  it("should navigate to next kit", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("A0");
    });

    act(() => {
      result.current.handleNextKit();
    });

    expect(result.current.selectedKit).toBe("A1");
  });

  it("should navigate to previous kit", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("A1");
    });

    act(() => {
      result.current.handlePrevKit();
    });

    expect(result.current.selectedKit).toBe("A0");
  });

  it("should handle next kit at the end of list", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("B0");
    });

    act(() => {
      result.current.handleNextKit();
    });

    expect(result.current.selectedKit).toBe("B0"); // Should stay at last kit
  });

  it("should handle previous kit at the beginning of list", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("A0");
    });

    act(() => {
      result.current.handlePrevKit();
    });

    expect(result.current.selectedKit).toBe("A0"); // Should stay at first kit
  });

  it("should handle back navigation", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("A0");
    });

    act(() => {
      result.current.handleBack();
    });

    expect(result.current.selectedKit).toBeNull();
    expect(result.current.selectedKitSamples).toBeNull();
  });

  it("should sort kits correctly", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    expect(result.current.sortedKits.map((k) => k.name)).toEqual([
      "A0",
      "A1",
      "B0",
    ]);
  });

  it("should handle empty kits array", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: {},
        kits: [],
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    expect(result.current.sortedKits).toEqual([]);
    expect(result.current.selectedKit).toBeNull();
  });

  it("should handle null kits", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: {},
        kits: null,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    expect(result.current.sortedKits).toEqual([]);
    expect(result.current.selectedKit).toBeNull();
  });

  it("should update selected kit samples when kit is selected", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("A0");
    });

    expect(result.current.selectedKitSamples).toEqual({
      1: ["kick.wav"],
      2: [],
      3: [],
      4: [],
    });
  });

  it("should handle selecting non-existent kit", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    act(() => {
      result.current.handleSelectKit("NONEXISTENT");
    });

    expect(result.current.selectedKit).toBe("NONEXISTENT");
    // Non-existent kit gets default empty voice samples
    expect(result.current.selectedKitSamples).toEqual({
      1: [],
      2: [],
      3: [],
      4: [],
    });
    expect(result.current.currentKitIndex).toBe(-1);
  });

  it("should handle navigation with no selected kit", () => {
    const { result } = renderHook(() =>
      useKitNavigation({
        allKitSamples: mockAllKitSamples,
        kits: mockKits,
        refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
      }),
    );

    // Initially no kit selected
    expect(result.current.selectedKit).toBeNull();
    expect(result.current.currentKitIndex).toBe(-1);

    act(() => {
      result.current.handleNextKit();
    });

    // With currentKitIndex -1 (-1 < 2), it selects the next kit (index 0)
    expect(result.current.selectedKit).toBe("A0");

    // Reset to no selection
    act(() => {
      result.current.handleBack();
    });

    act(() => {
      result.current.handlePrevKit();
    });

    // With currentKitIndex -1 (not > 0), prev navigation doesn't work
    expect(result.current.selectedKit).toBeNull();
  });

  it("should memoize sorted kits to prevent unnecessary re-sorts", () => {
    const { rerender, result } = renderHook(
      ({ kits }) =>
        useKitNavigation({
          allKitSamples: mockAllKitSamples,
          kits,
          refreshAllKitsAndSamples: mockRefreshAllKitsAndSamples,
        }),
      { initialProps: { kits: mockKits } },
    );

    const firstSortedKits = result.current.sortedKits;

    // Rerender with same kits - should return same reference
    rerender({ kits: mockKits });
    expect(result.current.sortedKits).toBe(firstSortedKits);

    // Rerender with different kits - should return new reference
    const newKits = [
      ...mockKits,
      {
        alias: null,
        bank_letter: "C",
        editable: false,
        name: "C0",
      } as KitWithRelations,
    ];
    rerender({ kits: newKits });
    expect(result.current.sortedKits).not.toBe(firstSortedKits);
  });
});
