import type { KitWithRelations } from "@romper/shared/db/types";

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
  console.log("[SEARCH DEBUG] useKitSearch hook initialized");
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
      console.log("[SEARCH DEBUG] performSearch called with query:", query);
      if (query.length < 2) {
        console.log("[SEARCH DEBUG] Query too short, clearing results");
        setSearchResults([]);
        setResultCount(0);
        setQueryTime(0);
        setIsSearching(false);
        return;
      }

      const normalizedQuery = query.toLowerCase().trim();
      console.log("[SEARCH DEBUG] Normalized query:", normalizedQuery);

      // Check cache first
      const cachedResult = searchCacheRef.current.get(normalizedQuery);
      if (cachedResult) {
        console.log("[SEARCH DEBUG] Found cached result:", cachedResult);
        setSearchResults(cachedResult.results);
        setResultCount(cachedResult.count);
        setQueryTime(cachedResult.time);
        setIsSearching(false);
        return;
      }

      console.log("[SEARCH DEBUG] No cache, starting search...");
      setIsSearching(true);

      const result = await performKitSearch({
        limit: 100,
        query: normalizedQuery,
      });

      console.log("[SEARCH DEBUG] performKitSearch returned:", result);

      if (result.success && result.data) {
        const { kits, queryTime: searchTime, totalCount } = result.data;

        console.log(
          "[SEARCH DEBUG] Search successful, found",
          totalCount,
          "kits",
        );
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
        console.log("[SEARCH DEBUG] Search failed:", result.error);
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
      console.log(
        "[SEARCH DEBUG] handleSearchChange called with query:",
        query,
      );
      setSearchQuery(query);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer for debounced search (300ms delay)
      debounceTimerRef.current = setTimeout(() => {
        console.log(
          "[SEARCH DEBUG] Debounce timer expired, calling performSearch",
        );
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
