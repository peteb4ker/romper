import type { KitWithRelations } from "@romper/shared/db/schema";

import { useCallback, useEffect, useRef, useState } from "react";

import { performKitSearch, SearchCache } from "../../../utils/searchUtils";

export interface UseKitSearchOptions {
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

export interface UseKitSearchReturn {
  clearSearch: () => void;
  handleSearchChange: (query: string) => void;
  hasActiveSearch: boolean;
  isSearching: boolean;
  queryTime: number;
  resultCount: number;
  searchQuery: string;
  searchResults: KitWithRelations[];
  setSearchQuery: (query: string) => void;
}

/**
 * Hook for managing kit search functionality with debouncing and result caching
 * Provides search state management and IPC communication with search operations
 */
export function useKitSearch({
  onMessage,
}: UseKitSearchOptions): UseKitSearchReturn {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<KitWithRelations[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const [queryTime, setQueryTime] = useState<number>(0);

  // Debounce timer ref for cleanup
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cache recent search results to avoid duplicate queries
  const searchCacheRef = useRef<SearchCache>(new SearchCache());

  // Track if we have an active search (query length >= 2)
  const hasActiveSearch = searchQuery.length >= 2;

  /**
   * Perform the actual search operation via IPC
   */
  const performSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setResultCount(0);
        setQueryTime(0);
        setIsSearching(false);
        return;
      }

      const normalizedQuery = query.toLowerCase().trim();

      // Check cache first
      const cachedResult = searchCacheRef.current.get(normalizedQuery);
      if (cachedResult) {
        setSearchResults(cachedResult.results);
        setResultCount(cachedResult.count);
        setQueryTime(cachedResult.time);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      const result = await performKitSearch({
        limit: 100,
        query: normalizedQuery,
      });

      if (result.success && result.data) {
        const { kits, queryTime: searchTime, totalCount } = result.data;

        setSearchResults(kits);
        setResultCount(totalCount);
        setQueryTime(searchTime);

        // Cache the result
        searchCacheRef.current.set(normalizedQuery, {
          count: totalCount,
          results: kits,
          time: searchTime,
        });
      } else {
        setSearchResults([]);
        setResultCount(0);
        setQueryTime(0);
        onMessage?.(
          `Search failed: ${result.error || "Unknown error"}`,
          "error",
        );
      }

      setIsSearching(false);
    },
    [onMessage],
  );

  /**
   * Debounced search handler - delays search execution to avoid excessive queries
   */
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer for debounced search (300ms delay)
      debounceTimerRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    },
    [performSearch],
  );

  /**
   * Clear all search state and cancel any pending operations
   */
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setResultCount(0);
    setQueryTime(0);
    setIsSearching(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    searchCacheRef.current.clear();
  }, []);

  /**
   * Cleanup on unmount - clear timers and cache
   */
  useEffect(() => {
    const searchCache = searchCacheRef.current;
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      searchCache.clear();
    };
  }, []);

  return {
    clearSearch,
    handleSearchChange,
    hasActiveSearch,
    isSearching,

    queryTime,
    // Metrics
    resultCount,

    // State
    searchQuery,
    searchResults,
    // Actions
    setSearchQuery,
  };
}
