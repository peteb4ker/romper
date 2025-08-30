import type { KitWithRelations } from "@romper/shared/db/schema";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { performKitSearch, SearchCache } from "../searchUtils";

// Mock window.electronAPI
const mockSearchKits = vi.fn();

// Set up global window mock
vi.stubGlobal("window", {
  electronAPI: {
    searchKits: mockSearchKits,
  },
});

describe("SearchCache", () => {
  let cache: SearchCache;
  const mockEntry = {
    count: 1,
    results: [{ name: "kit1" } as KitWithRelations],
    time: 100,
  };

  beforeEach(() => {
    cache = new SearchCache(3, 1000); // maxSize=3, ttl=1000ms for testing
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("basic operations", () => {
    it("should store and retrieve entries", () => {
      cache.set("test query", mockEntry);
      const result = cache.get("test query");
      expect(result).toEqual(mockEntry);
    });

    it("should normalize queries (case and whitespace)", () => {
      cache.set("Test Query  ", mockEntry);

      expect(cache.get("test query")).toEqual(mockEntry);
      expect(cache.get("TEST QUERY")).toEqual(mockEntry);
      expect(cache.get("  test query  ")).toEqual(mockEntry);
    });

    it("should return undefined for non-existent entries", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should clear all entries", () => {
      cache.set("query1", mockEntry);
      cache.set("query2", mockEntry);

      cache.clear();

      expect(cache.get("query1")).toBeUndefined();
      expect(cache.get("query2")).toBeUndefined();
    });
  });

  describe("size limits", () => {
    it("should respect maxSize limit", () => {
      // Fill cache to max size
      cache.set("query1", mockEntry);
      cache.set("query2", mockEntry);
      cache.set("query3", mockEntry);

      // Add one more - should evict oldest
      cache.set("query4", mockEntry);

      expect(cache.get("query1")).toBeUndefined(); // Evicted
      expect(cache.get("query2")).toEqual(mockEntry);
      expect(cache.get("query3")).toEqual(mockEntry);
      expect(cache.get("query4")).toEqual(mockEntry);
    });
  });

  describe("TTL (Time To Live)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should remove entries after TTL expires", () => {
      cache.set("test query", mockEntry);
      expect(cache.get("test query")).toEqual(mockEntry);

      // Fast-forward past TTL
      vi.advanceTimersByTime(1001);

      expect(cache.get("test query")).toBeUndefined();
    });

    it("should not remove entries before TTL expires", () => {
      cache.set("test query", mockEntry);

      // Fast-forward but not past TTL
      vi.advanceTimersByTime(500);

      expect(cache.get("test query")).toEqual(mockEntry);
    });
  });
});

describe("performKitSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the window mock
    vi.stubGlobal("window", {
      electronAPI: {
        searchKits: mockSearchKits,
      },
    });
  });

  it("should return successful result when API succeeds", async () => {
    const mockResponse = {
      data: {
        kits: [{ name: "kit1" } as KitWithRelations],
        queryTime: 50,
        totalCount: 1,
      },
      success: true,
    };
    mockSearchKits.mockResolvedValue(mockResponse);

    const result = await performKitSearch({ limit: 10, query: "test" });

    expect(result).toEqual(mockResponse);
    expect(mockSearchKits).toHaveBeenCalledWith({
      limit: 10,
      query: "test",
    });
  });

  it("should handle API failure", async () => {
    const mockResponse = {
      error: "Database error",
      success: false,
    };
    mockSearchKits.mockResolvedValue(mockResponse);

    const result = await performKitSearch({ query: "test" });

    expect(result).toEqual(mockResponse);
  });

  it("should handle missing API", async () => {
    mockSearchKits.mockResolvedValue(null);

    const result = await performKitSearch({ query: "test" });

    expect(result).toEqual({
      error: "Search API not available",
      success: false,
    });
  });

  it("should handle API exceptions", async () => {
    const error = new Error("Network error");
    mockSearchKits.mockRejectedValue(error);

    const result = await performKitSearch({ query: "test" });

    expect(result).toEqual({
      error: "Network error",
      success: false,
    });
  });

  it("should handle non-Error exceptions", async () => {
    mockSearchKits.mockRejectedValue("String error");

    const result = await performKitSearch({ query: "test" });

    expect(result).toEqual({
      error: "String error",
      success: false,
    });
  });
});
