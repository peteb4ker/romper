import type { KitWithRelations } from "@romper/shared/db/schema";

import { compareKitSlots } from "@romper/shared/kitUtilsShared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseKitFiltersOptions {
  kits?: KitWithRelations[];
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: () => void;
}

/**
 * Hook for managing kit filtering functionality including favorites and modified filters
 * Extracted from KitBrowser to reduce component complexity
 */
export function useKitFilters({
  kits,
  onMessage,
  onRefreshKits,
}: UseKitFiltersOptions) {
  // Task 20.1.4: Favorites filter state
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);

  // Track individual kit favorite states independently
  const [kitFavoriteStates, setKitFavoriteStates] = useState<
    Record<string, boolean>
  >({});

  // Use ref to always have access to the latest state in callbacks
  const kitFavoriteStatesRef = useRef<Record<string, boolean>>({});

  // Update ref whenever state changes
  useEffect(() => {
    kitFavoriteStatesRef.current = kitFavoriteStates;
  }, [kitFavoriteStates]);

  // Task 20.2.2: Modified filter state
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [modifiedCount, setModifiedCount] = useState(0);

  // Helper function to get favorite state for filtering (matches getKitFavoriteState logic)
  const getKitFavoriteStateForFiltering = useCallback(
    (kitName: string): boolean => {
      // Use ref to access the latest state to avoid stale closures
      if (kitName in kitFavoriteStatesRef.current) {
        return kitFavoriteStatesRef.current[kitName];
      }
      // Fallback to kit data from server
      const kit = kits?.find((k) => k.name === kitName);
      return kit?.is_favorite || false;
    },
    [kits],
  );

  // Task 20.1.4 & 20.2.2: Filter kits based on active filters and maintain sorted order
  const filteredKits = useMemo(() => {
    let filteredList = kits ?? [];

    if (showFavoritesOnly) {
      filteredList = filteredList.filter((kit) =>
        getKitFavoriteStateForFiltering(kit.name),
      );
    }

    if (showModifiedOnly) {
      filteredList = filteredList.filter((kit) => kit.modified_since_sync);
    }

    // Sort by kit slot names for consistent order (matches useKitNavigation.sortedKits)
    return filteredList.slice().sort((a, b) => compareKitSlots(a.name, b.name));
  }, [
    kits,
    showFavoritesOnly,
    showModifiedOnly,
    getKitFavoriteStateForFiltering,
  ]);

  // Task 20.1.2: Handler for favorites toggle
  const handleToggleFavorite = useCallback(
    async (kitName: string) => {
      try {
        const result = await window.electronAPI.toggleKitFavorite?.(kitName);
        if (result?.success) {
          // Update individual kit favorite state immediately (for instant UI update)
          const newFavoriteState = result.data?.isFavorite ?? false;
          setKitFavoriteStates((prev) => ({
            ...prev,
            [kitName]: newFavoriteState,
          }));

          // Update favorites count for filter badge (lightweight)
          const countResult = await window.electronAPI.getFavoriteKitsCount?.();
          if (countResult?.success && typeof countResult.data === "number") {
            setFavoritesCount(countResult.data);
          }

          // Only refresh full data if favorites filter is active (to update filtered list)
          if (showFavoritesOnly) {
            onRefreshKits?.();
          }
        } else {
          onMessage?.(
            `Failed to toggle favorite: ${result?.error || "Unknown error"}`,
            "error",
          );
        }
      } catch (error) {
        onMessage?.(
          `Failed to toggle favorite: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
    [onMessage, onRefreshKits, showFavoritesOnly],
  );

  // Task 20.1.4: Toggle favorites filter
  const handleToggleFavoritesFilter = useCallback(() => {
    setShowFavoritesOnly(!showFavoritesOnly);
  }, [showFavoritesOnly]);

  // Task 20.2.2: Toggle modified filter
  const handleToggleModifiedFilter = useCallback(() => {
    setShowModifiedOnly(!showModifiedOnly);
  }, [showModifiedOnly]);

  // Task 20.1.4: Fetch favorites count when kits change
  useEffect(() => {
    const fetchFavoritesCount = async () => {
      // Don't fetch favorites count if there are no kits (no local store configured)
      if (!kits || kits.length === 0) {
        setFavoritesCount(0);
        return;
      }

      try {
        const result = await window.electronAPI.getFavoriteKitsCount?.();
        if (result?.success && typeof result.data === "number") {
          setFavoritesCount(result.data);
        } else {
          setFavoritesCount(0);
        }
      } catch (error) {
        console.error("Failed to fetch favorites count:", error);
        setFavoritesCount(0);
      }
    };

    fetchFavoritesCount();
  }, [kits]); // Re-fetch when kits change

  // Task 20.2.2: Calculate modified count when kits change
  useEffect(() => {
    const modifiedKits = kits?.filter((kit) => kit.modified_since_sync) ?? [];
    setModifiedCount(modifiedKits.length);
  }, [kits]);

  // Helper function to get favorite state for a kit (from local state or kit data)
  const getKitFavoriteState = useCallback(
    (kitName: string) => {
      // Use ref to access the latest state to avoid stale closures
      if (kitName in kitFavoriteStatesRef.current) {
        return kitFavoriteStatesRef.current[kitName];
      }
      // Fallback to kit data from server
      const kit = kits?.find((k) => k.name === kitName);
      return kit?.is_favorite || false;
    },
    [kits],
  );

  return {
    favoritesCount,
    filteredKits,
    getKitFavoriteState,
    handleToggleFavorite,
    handleToggleFavoritesFilter,
    handleToggleModifiedFilter,
    modifiedCount,
    showFavoritesOnly,
    showModifiedOnly,
  };
}
