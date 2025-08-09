import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitFilters } from "../useKitFilters";

// Mock electron API
const mockToggleKitFavorite = vi.fn();
const mockGetFavoriteKitsCount = vi.fn();

// Ensure window.electronAPI is properly mocked
Object.defineProperty(globalThis, "window", {
  value: {
    electronAPI: {
      getFavoriteKitsCount: mockGetFavoriteKitsCount,
      toggleKitFavorite: mockToggleKitFavorite,
    },
  },
  writable: true,
});

// Ensure global window is also set
global.window = globalThis.window as any;

describe("useKitFilters", () => {
  const mockOnMessage = vi.fn();
  const mockOnRefreshKits = vi.fn();

  const mockKits: KitWithRelations[] = [
    {
      id: 1,
      is_favorite: true,
      modified_since_sync: false,
      name: "Kit1",
    } as KitWithRelations,
    {
      id: 2,
      is_favorite: false,
      modified_since_sync: true,
      name: "Kit2",
    } as KitWithRelations,
    {
      id: 3,
      is_favorite: true,
      modified_since_sync: true,
      name: "Kit3",
    } as KitWithRelations,
  ];

  const defaultProps = {
    kits: mockKits,
    onMessage: mockOnMessage,
    onRefreshKits: mockOnRefreshKits,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset and configure mock functions
    mockGetFavoriteKitsCount.mockResolvedValue({
      data: 2,
      success: true,
    });
    mockToggleKitFavorite.mockResolvedValue({
      data: { is_favorite: true },
      success: true,
    });

    // Ensure window.electronAPI is properly set up for each test
    Object.defineProperty(window, "electronAPI", {
      value: {
        getFavoriteKitsCount: mockGetFavoriteKitsCount,
        toggleKitFavorite: mockToggleKitFavorite,
      },
      writable: true,
    });
  });

  describe("filtering", () => {
    it("returns all kits when no filters are active", () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      expect(result.current.filteredKits).toHaveLength(3);
      expect(result.current.showFavoritesOnly).toBe(false);
      expect(result.current.showModifiedOnly).toBe(false);
    });

    it("filters kits by favorites only", async () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      act(() => {
        result.current.handleToggleFavoritesFilter();
      });

      expect(result.current.showFavoritesOnly).toBe(true);
      expect(result.current.filteredKits).toHaveLength(2);
      expect(result.current.filteredKits.every((kit) => kit.is_favorite)).toBe(
        true,
      );
    });

    it("filters kits by modified only", async () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      act(() => {
        result.current.handleToggleModifiedFilter();
      });

      expect(result.current.showModifiedOnly).toBe(true);
      expect(result.current.filteredKits).toHaveLength(2);
      expect(
        result.current.filteredKits.every((kit) => kit.modified_since_sync),
      ).toBe(true);
    });

    it("combines multiple filters", async () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      act(() => {
        result.current.handleToggleFavoritesFilter();
        result.current.handleToggleModifiedFilter();
      });

      expect(result.current.filteredKits).toHaveLength(1);
      expect(result.current.filteredKits[0].name).toBe("Kit3");
    });

    it("handles empty kits array", () => {
      const { result } = renderHook(() =>
        useKitFilters({ ...defaultProps, kits: undefined }),
      );

      expect(result.current.filteredKits).toEqual([]);
    });
  });

  describe("handleToggleFavorite", () => {
    it("successfully toggles favorite status", async () => {
      // Ensure the mock is set up correctly
      expect(window.electronAPI).toBeDefined();
      expect(window.electronAPI.toggleKitFavorite).toBeDefined();

      mockToggleKitFavorite.mockResolvedValueOnce({
        data: { is_favorite: true },
        success: true,
      });

      const { result } = renderHook(() => useKitFilters(defaultProps));

      await act(async () => {
        await result.current.handleToggleFavorite("Kit1");
      });

      expect(mockToggleKitFavorite).toHaveBeenCalledWith("Kit1");
      expect(mockOnMessage).toHaveBeenCalledWith(
        "Kit Kit1 added to favorites",
        "success",
        2000,
      );
      expect(mockOnRefreshKits).toHaveBeenCalled();
      expect(mockGetFavoriteKitsCount).toHaveBeenCalled();
    });

    it("handles toggle favorite failure", async () => {
      mockToggleKitFavorite.mockResolvedValueOnce({
        error: "Database error",
        success: false,
      });

      const { result } = renderHook(() => useKitFilters(defaultProps));

      await act(async () => {
        await result.current.handleToggleFavorite("Kit1");
      });

      expect(mockOnMessage).toHaveBeenCalledWith(
        "Failed to toggle favorite: Database error",
        "error",
      );
      expect(mockOnRefreshKits).not.toHaveBeenCalled();
    });

    it("handles toggle favorite exception", async () => {
      mockToggleKitFavorite.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useKitFilters(defaultProps));

      await act(async () => {
        await result.current.handleToggleFavorite("Kit1");
      });

      expect(mockOnMessage).toHaveBeenCalledWith(
        "Failed to toggle favorite: Network error",
        "error",
      );
    });
  });

  describe("counts", () => {
    it("initializes favorites count on mount", async () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      // Wait for useEffect to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.favoritesCount).toBe(2);
    });

    it("calculates modified count from kits", () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      expect(result.current.modifiedCount).toBe(2);
    });

    it("updates counts when kits change", () => {
      const { rerender, result } = renderHook(
        ({ kits }) => useKitFilters({ ...defaultProps, kits }),
        {
          initialProps: { kits: mockKits },
        },
      );

      const newKits = [
        { ...mockKits[0], modified_since_sync: true },
        mockKits[1],
      ];

      rerender({ kits: newKits });

      expect(result.current.modifiedCount).toBe(2);
    });
  });

  describe("filter toggles", () => {
    it("toggles favorites filter state", () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      expect(result.current.showFavoritesOnly).toBe(false);

      act(() => {
        result.current.handleToggleFavoritesFilter();
      });

      expect(result.current.showFavoritesOnly).toBe(true);

      act(() => {
        result.current.handleToggleFavoritesFilter();
      });

      expect(result.current.showFavoritesOnly).toBe(false);
    });

    it("toggles modified filter state", () => {
      const { result } = renderHook(() => useKitFilters(defaultProps));

      expect(result.current.showModifiedOnly).toBe(false);

      act(() => {
        result.current.handleToggleModifiedFilter();
      });

      expect(result.current.showModifiedOnly).toBe(true);

      act(() => {
        result.current.handleToggleModifiedFilter();
      });

      expect(result.current.showModifiedOnly).toBe(false);
    });
  });
});
