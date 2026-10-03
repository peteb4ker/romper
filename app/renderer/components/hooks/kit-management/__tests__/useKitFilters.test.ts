import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitFilters, type UseKitFiltersOptions } from "../useKitFilters";

const kit = (
  name: string,
  is_favorite: boolean,
  modified_since_sync: boolean,
): KitWithRelations =>
  ({ is_favorite, modified_since_sync, name }) as KitWithRelations;

describe("useKitFilters", () => {
  const onMessage = vi.fn();
  const onToggleFavorite = vi.fn();

  const kits = [
    kit("A1", true, false),
    kit("A0", false, true),
    kit("B0", true, true),
  ];

  const props = (
    overrides: Partial<UseKitFiltersOptions> = {},
  ): UseKitFiltersOptions => ({
    allKits: kits,
    kits,
    onMessage,
    onToggleFavorite,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    onToggleFavorite.mockResolvedValue({
      data: { isFavorite: true },
      success: true,
    });
  });

  describe("filtering", () => {
    it("returns every kit, sorted by slot, when no filter is on", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      expect(result.current.filteredKits.map((k) => k.name)).toEqual([
        "A0",
        "A1",
        "B0",
      ]);
      expect(result.current.showFavoritesOnly).toBe(false);
      expect(result.current.showModifiedOnly).toBe(false);
    });

    it("doesn't reorder the caller's array", () => {
      const input = [...kits];
      renderHook(() => useKitFilters(props({ kits: input })));

      expect(input.map((k) => k.name)).toEqual(["A1", "A0", "B0"]);
    });

    it("[UC-10] filters to favourites", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      act(() => result.current.handleToggleFavoritesFilter());

      expect(result.current.showFavoritesOnly).toBe(true);
      expect(result.current.filteredKits.map((k) => k.name)).toEqual([
        "A1",
        "B0",
      ]);
    });

    it("[UC-11] filters to modified kits", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      act(() => result.current.handleToggleModifiedFilter());

      expect(result.current.showModifiedOnly).toBe(true);
      expect(result.current.filteredKits.map((k) => k.name)).toEqual([
        "A0",
        "B0",
      ]);
    });

    it("combines both filters", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      act(() => {
        result.current.handleToggleFavoritesFilter();
        result.current.handleToggleModifiedFilter();
      });

      expect(result.current.filteredKits.map((k) => k.name)).toEqual(["B0"]);
    });

    it("turns a filter off again", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      act(() => result.current.handleToggleFavoritesFilter());
      act(() => result.current.handleToggleFavoritesFilter());

      expect(result.current.showFavoritesOnly).toBe(false);
      expect(result.current.filteredKits).toHaveLength(3);
    });

    it("handles no kits", () => {
      const { result } = renderHook(() =>
        useKitFilters(props({ allKits: undefined, kits: undefined })),
      );

      expect(result.current.filteredKits).toEqual([]);
      expect(result.current.favoritesCount).toBe(0);
      expect(result.current.modifiedCount).toBe(0);
    });
  });

  // RE-37: favourite state comes from the kits alone, so a toggle made
  // anywhere (grid, "F", editor header) shows everywhere once the kit list
  // updates
  describe("[UC-10] favourite state follows the kit list", () => {
    it("re-filters when a kit's is_favorite changes", () => {
      const { rerender, result } = renderHook((p) => useKitFilters(p), {
        initialProps: props(),
      });
      act(() => result.current.handleToggleFavoritesFilter());
      expect(result.current.filteredKits.map((k) => k.name)).toEqual([
        "A1",
        "B0",
      ]);

      const updated = [
        kit("A1", false, false),
        kit("A0", true, true),
        kit("B0", true, true),
      ];
      rerender(props({ allKits: updated, kits: updated }));

      expect(result.current.filteredKits.map((k) => k.name)).toEqual([
        "A0",
        "B0",
      ]);
    });

    it("keeps no state of its own across a kit list change", () => {
      const { rerender, result } = renderHook((p) => useKitFilters(p), {
        initialProps: props(),
      });

      // A new local store with a kit of the same name that isn't a favourite
      const otherStore = [kit("A1", false, false)];
      rerender(props({ allKits: otherStore, kits: otherStore }));
      act(() => result.current.handleToggleFavoritesFilter());

      expect(result.current.filteredKits).toEqual([]);
      expect(result.current.favoritesCount).toBe(0);
    });
  });

  describe("counts", () => {
    it("[UC-10] counts favourites in the kit list", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      expect(result.current.favoritesCount).toBe(2);
    });

    it("[UC-11] counts modified kits", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      expect(result.current.modifiedCount).toBe(2);
    });

    it("counts the whole library, not the search results", () => {
      const { result } = renderHook(() =>
        useKitFilters(props({ kits: [kits[0]] })),
      );

      expect(result.current.favoritesCount).toBe(2);
      expect(result.current.modifiedCount).toBe(2);
    });

    it("counts the whole library while a filter is on", () => {
      const { result } = renderHook(() => useKitFilters(props()));

      act(() => result.current.handleToggleModifiedFilter());

      expect(result.current.favoritesCount).toBe(2);
      expect(result.current.modifiedCount).toBe(2);
    });

    it("falls back to the kits given when there's no library list", () => {
      const { result } = renderHook(() =>
        useKitFilters(props({ allKits: undefined, kits: [kits[2]] })),
      );

      expect(result.current.favoritesCount).toBe(1);
      expect(result.current.modifiedCount).toBe(1);
    });

    it("updates when the kits change", () => {
      const { rerender, result } = renderHook((p) => useKitFilters(p), {
        initialProps: props(),
      });

      const updated = [kit("A0", true, true), kit("A1", true, true)];
      rerender(props({ allKits: updated, kits: updated }));

      expect(result.current.favoritesCount).toBe(2);
      expect(result.current.modifiedCount).toBe(2);
    });
  });

  describe("[UC-10] handleToggleFavorite", () => {
    it("toggles through the data manager, not IPC of its own", async () => {
      const { result } = renderHook(() => useKitFilters(props()));

      await act(async () => {
        await result.current.handleToggleFavorite("A0");
      });

      expect(onToggleFavorite).toHaveBeenCalledWith("A0");
      expect(
        vi.mocked(globalThis.electronAPI.toggleKitFavorite),
      ).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("reports a failed toggle", async () => {
      onToggleFavorite.mockResolvedValueOnce({
        error: "Database error",
        success: false,
      });
      const { result } = renderHook(() => useKitFilters(props()));

      await act(async () => {
        await result.current.handleToggleFavorite("A0");
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Failed to toggle favorite: Database error",
        "error",
      );
    });

    it("reports a thrown error", async () => {
      onToggleFavorite.mockRejectedValueOnce(new Error("Network error"));
      const { result } = renderHook(() => useKitFilters(props()));

      await act(async () => {
        await result.current.handleToggleFavorite("A0");
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Failed to toggle favorite: Network error",
        "error",
      );
    });

    it("does nothing without a toggle", async () => {
      const { result } = renderHook(() =>
        useKitFilters(props({ onToggleFavorite: undefined })),
      );

      await act(async () => {
        await result.current.handleToggleFavorite("A0");
      });

      expect(onMessage).not.toHaveBeenCalled();
    });
  });
});
