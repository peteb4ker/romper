import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";

import { compareKitSlots } from "@romper/shared/kitUtilsShared";
import { useCallback, useMemo, useState } from "react";

export interface UseKitFiltersOptions {
  /** Every kit in the library, unfiltered; the filter badges count these */
  allKits?: KitWithRelations[];
  /** The kits to filter (already narrowed by search) */
  kits?: KitWithRelations[];
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /**
   * The one favourite toggle (`useKitDataManager.toggleKitFavorite`). It
   * writes the database and updates the kit list, so the browser and the
   * editor read the same `is_favorite` (RE-37).
   */
  onToggleFavorite?: (
    kitName: string,
  ) => Promise<DbResult<{ isFavorite: boolean }>>;
}

/**
 * Favourites and Modified filters for the kit browser. Favourite state is
 * read from the kits themselves; this hook keeps no copy of it.
 */
export function useKitFilters({
  allKits,
  kits,
  onMessage,
  onToggleFavorite,
}: UseKitFiltersOptions) {
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);

  const filteredKits = useMemo(() => {
    let filteredList = kits ?? [];

    if (showFavoritesOnly) {
      filteredList = filteredList.filter((kit) => kit.is_favorite);
    }

    if (showModifiedOnly) {
      filteredList = filteredList.filter((kit) => kit.modified_since_sync);
    }

    // Sort a copy by slot (matches useKitNavigation.sortedKits); sorting in
    // place would reorder the caller's array
    return [...filteredList].sort((a, b) => compareKitSlots(a.name, b.name));
  }, [kits, showFavoritesOnly, showModifiedOnly]);

  // The badges count the whole library, whatever search or filter is on
  const libraryKits = allKits ?? kits;
  const favoritesCount = useMemo(
    () => libraryKits?.filter((kit) => kit.is_favorite).length ?? 0,
    [libraryKits],
  );
  const modifiedCount = useMemo(
    () => libraryKits?.filter((kit) => kit.modified_since_sync).length ?? 0,
    [libraryKits],
  );

  const handleToggleFavorite = useCallback(
    async (kitName: string) => {
      if (!onToggleFavorite) return;
      try {
        const result = await onToggleFavorite(kitName);
        if (!result.success) {
          onMessage?.(
            `Failed to toggle favorite: ${result.error || "Unknown error"}`,
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
    [onMessage, onToggleFavorite],
  );

  const handleToggleFavoritesFilter = useCallback(() => {
    setShowFavoritesOnly((shown) => !shown);
  }, []);

  const handleToggleModifiedFilter = useCallback(() => {
    setShowModifiedOnly((shown) => !shown);
  }, []);

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
