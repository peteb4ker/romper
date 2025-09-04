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

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const searchChange = useCallback((query: string) => {
    setIsSearching(true);
    setSearchQuery(query);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Simulate brief search state for UI feedback
    timeoutRef.current = setTimeout(() => {
      setIsSearching(false);
    }, 100);
  }, []);

  const clearSearch = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    setSearchQuery("");
    setIsSearching(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
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
