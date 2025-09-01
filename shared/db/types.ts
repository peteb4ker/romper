import type { Kit, KitWithRelations, NewKit, NewSample } from "./schema.js";

export type { Kit, KitWithRelations, NewKit, NewSample };

export interface SearchCacheEntry {
  count: number;
  results: KitWithRelations[];
  time: number;
}

// Search-related types - consolidated to eliminate duplication
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
