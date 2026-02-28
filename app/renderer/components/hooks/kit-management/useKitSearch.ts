import type { KitWithRelations } from "@romper/shared/db/schema";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { KitWithSearchMatch } from "../../shared/kitItemUtils";

import { filterKitsWithSearch } from "../../../utils/kitSearchUtils";

export interface UseKitSearchOptions {
  allKitSamples?: { [kit: string]: unknown };
  kits?: KitWithRelations[];
}

export interface UseKitSearchResult {
  clearSearch: () => void;
  filteredKits: KitWithSearchMatch[];
  isSearching: boolean;
  searchChange: (query: string) => void;
  searchQuery: string;
  searchResultCount: number;
}

/**
 * Custom hook for managing kit search functionality
 * Provides search state management and filtered results with match details
 */
export function useKitSearch({
  allKitSamples = {},
  kits = [],
}: UseKitSearchOptions = {}): UseKitSearchResult {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current !== null) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Filter kits based on search query
  const filteredKits = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) {
      return kits.map((kit) => ({ ...kit })); // Return all kits without search matches
    }

    return filterKitsWithSearch(kits, searchQuery, allKitSamples);
  }, [kits, searchQuery, allKitSamples]);

  const searchResultCount = useMemo(() => {
    return searchQuery && searchQuery.length >= 2 ? filteredKits.length : 0;
  }, [filteredKits.length, searchQuery]);

  const searchChange = useCallback((query: string) => {
    setIsSearching(true);
    setSearchQuery(query);

    // Clear any pending timer before setting a new one
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
    }

    // Brief search state for UI feedback
    searchTimerRef.current = setTimeout(() => {
      setIsSearching(false);
      searchTimerRef.current = null;
    }, 100);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setIsSearching(false);
  }, []);

  return {
    clearSearch,
    filteredKits,
    isSearching,
    searchChange,
    searchQuery,
    searchResultCount,
  };
}
