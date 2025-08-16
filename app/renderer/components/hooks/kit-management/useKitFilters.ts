import type { KitWithRelations } from "@romper/shared/db/schema";

import { useCallback, useEffect, useMemo, useState } from "react";

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

  // Task 20.2.2: Modified filter state
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [modifiedCount, setModifiedCount] = useState(0);

  // Task 20.1.4 & 20.2.2: Filter kits based on active filters
  const filteredKits = useMemo(() => {
    let filteredList = kits ?? [];

    if (showFavoritesOnly) {
      filteredList = filteredList.filter((kit) => kit.is_favorite);
    }

    if (showModifiedOnly) {
      filteredList = filteredList.filter((kit) => kit.modified_since_sync);
    }

    return filteredList;
  }, [kits, showFavoritesOnly, showModifiedOnly]);

  // Task 20.1.2: Handler for favorites toggle
  const handleToggleFavorite = useCallback(
    async (kitName: string) => {
      try {
        const result = await window.electronAPI.toggleKitFavorite?.(kitName);
        if (result?.success) {
          // Refresh kits to update the UI
          onRefreshKits?.();

          // Update favorites count
          const countResult = await window.electronAPI.getFavoriteKitsCount?.();
          if (countResult?.success && typeof countResult.data === "number") {
            setFavoritesCount(countResult.data);
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
    [onMessage, onRefreshKits],
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

  return {
    favoritesCount,
    filteredKits,
    handleToggleFavorite,
    handleToggleFavoritesFilter,
    handleToggleModifiedFilter,
    modifiedCount,
    showFavoritesOnly,
    showModifiedOnly,
  };
}
