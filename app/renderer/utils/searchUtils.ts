import type { KitWithRelations } from "@romper/shared/db/schema";

export interface SearchCacheEntry {
  count: number;
  results: KitWithRelations[];
  time: number;
}

export interface SearchParams {
  limit?: number;
  query: string;
}

export interface SearchResult {
  data?: {
    kits: KitWithRelations[];
    queryTime: number;
    totalCount: number;
  };
  error?: string;
  success: boolean;
}

/**
 * Manage search result cache with size limits and TTL
 */
export class SearchCache {
  private cache = new Map<string, SearchCacheEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 20, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  clear(): void {
    this.cache.clear();
  }

  get(query: string): SearchCacheEntry | undefined {
    return this.cache.get(query.toLowerCase().trim());
  }

  set(query: string, entry: SearchCacheEntry): void {
    const normalizedQuery = query.toLowerCase().trim();

    // Add to cache
    this.cache.set(normalizedQuery, entry);

    // Limit cache size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Set TTL cleanup
    setTimeout(() => {
      this.cache.delete(normalizedQuery);
    }, this.ttlMs);
  }
}

/**
 * Perform search operation via Electron IPC
 */
export async function performKitSearch(
  params: SearchParams,
): Promise<SearchResult> {
  try {
    const result = await window.electronAPI.searchKits?.(params);
    return result || { error: "Search API not available", success: false };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      success: false,
    };
  }
}
