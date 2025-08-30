import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as searchUtils from "../../../../utils/searchUtils";
import { useKitSearch } from "../useKitSearch";

// Mock the search utilities
vi.mock("../../../../utils/searchUtils", () => ({
  performKitSearch: vi.fn(),
  SearchCache: vi.fn().mockImplementation(() => ({
    clear: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

const mockPerformKitSearch = vi.mocked(searchUtils.performKitSearch);
const mockSearchCache = vi.mocked(searchUtils.SearchCache);

describe("useKitSearch", () => {
  const mockKits: KitWithRelations[] = [
    { alias: "Test Kit 1", name: "kit1" } as KitWithRelations,
    { alias: "Test Kit 2", name: "kit2" } as KitWithRelations,
  ];

  const mockOnMessage = vi.fn();
  let mockCacheInstance: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockCacheInstance = {
      clear: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    };
    mockSearchCache.mockImplementation(() => mockCacheInstance);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should have correct initial values", () => {
      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      expect(result.current.searchQuery).toBe("");
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isSearching).toBe(false);
      expect(result.current.hasActiveSearch).toBe(false);
      expect(result.current.resultCount).toBe(0);
      expect(result.current.queryTime).toBe(0);
    });

    it("should initialize search cache", () => {
      renderHook(() => useKitSearch({ onMessage: mockOnMessage }));
      expect(mockSearchCache).toHaveBeenCalledWith();
    });
  });

  describe("hasActiveSearch computed value", () => {
    it("should return false for queries less than 2 characters", () => {
      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.setSearchQuery("a");
      });

      expect(result.current.hasActiveSearch).toBe(false);
    });

    it("should return true for queries 2+ characters", () => {
      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.setSearchQuery("ab");
      });

      expect(result.current.hasActiveSearch).toBe(true);
    });
  });

  describe("setSearchQuery", () => {
    it("should update search query immediately", () => {
      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.setSearchQuery("test");
      });

      expect(result.current.searchQuery).toBe("test");
    });
  });

  describe("handleSearchChange (debounced)", () => {
    it("should update query and debounce search execution", async () => {
      mockPerformKitSearch.mockResolvedValue({
        data: {
          kits: mockKits,
          queryTime: 50,
          totalCount: 2,
        },
        success: true,
      });

      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("test query");
      });

      expect(result.current.searchQuery).toBe("test query");
      expect(mockPerformKitSearch).not.toHaveBeenCalled();

      // Fast-forward past debounce delay
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockPerformKitSearch).toHaveBeenCalledWith({
        limit: 100,
        query: "test query",
      });
    });

    it("should not search for queries less than 2 characters", async () => {
      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("a");
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockPerformKitSearch).not.toHaveBeenCalled();
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });

    it("should cancel previous debounced search when new query comes in", async () => {
      mockPerformKitSearch.mockResolvedValue({
        data: { kits: mockKits, queryTime: 50, totalCount: 2 },
        success: true,
      });

      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("first");
      });

      act(() => {
        result.current.handleSearchChange("second");
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockPerformKitSearch).toHaveBeenCalledTimes(1);
      expect(mockPerformKitSearch).toHaveBeenCalledWith({
        limit: 100,
        query: "second",
      });
    });
  });

  describe("search execution", () => {
    it("should use cache when available", async () => {
      const cachedResult = {
        count: 2,
        results: mockKits,
        time: 50,
      };
      mockCacheInstance.get.mockReturnValue(cachedResult);

      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("cached query");
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockCacheInstance.get).toHaveBeenCalledWith("cached query");
      expect(mockPerformKitSearch).not.toHaveBeenCalled();
      expect(result.current.searchResults).toEqual(mockKits);
      expect(result.current.resultCount).toBe(2);
      expect(result.current.queryTime).toBe(50);
    });

    it("should perform search when not cached", async () => {
      mockCacheInstance.get.mockReturnValue(undefined);
      mockPerformKitSearch.mockResolvedValue({
        data: {
          kits: mockKits,
          queryTime: 100,
          totalCount: 2,
        },
        success: true,
      });

      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("new query");
      });

      expect(result.current.isSearching).toBe(false);

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockPerformKitSearch).toHaveBeenCalledWith({
        limit: 100,
        query: "new query",
      });
      expect(result.current.searchResults).toEqual(mockKits);
      expect(result.current.resultCount).toBe(2);
      expect(result.current.queryTime).toBe(100);
      expect(result.current.isSearching).toBe(false);
    });

    it("should cache successful search results", async () => {
      mockCacheInstance.get.mockReturnValue(undefined);
      mockPerformKitSearch.mockResolvedValue({
        data: {
          kits: mockKits,
          queryTime: 100,
          totalCount: 2,
        },
        success: true,
      });

      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("new query");
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockCacheInstance.set).toHaveBeenCalledWith("new query", {
        count: 2,
        results: mockKits,
        time: 100,
      });
    });

    it("should handle search failures", async () => {
      mockCacheInstance.get.mockReturnValue(undefined);
      mockPerformKitSearch.mockResolvedValue({
        error: "Database error",
        success: false,
      });

      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("failing query");
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockOnMessage).toHaveBeenCalledWith(
        "Search failed: Database error",
        "error",
      );
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.resultCount).toBe(0);
      expect(result.current.queryTime).toBe(0);
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe("clearSearch", () => {
    it("should reset all search state", async () => {
      // Set up some search state first
      mockCacheInstance.get.mockReturnValue(undefined);
      mockPerformKitSearch.mockResolvedValue({
        data: { kits: mockKits, queryTime: 50, totalCount: 2 },
        success: true,
      });

      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("test");
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Now clear
      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.searchQuery).toBe("");
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.resultCount).toBe(0);
      expect(result.current.queryTime).toBe(0);
      expect(result.current.isSearching).toBe(false);
      expect(mockCacheInstance.clear).toHaveBeenCalled();
    });

    it("should cancel pending debounced search", () => {
      const { result } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("test");
        result.current.clearSearch();
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockPerformKitSearch).not.toHaveBeenCalled();
    });
  });

  describe("cleanup on unmount", () => {
    it("should clear timers and cache on unmount", () => {
      const { result, unmount } = renderHook(() =>
        useKitSearch({ onMessage: mockOnMessage }),
      );

      act(() => {
        result.current.handleSearchChange("test");
      });

      unmount();

      // Should not execute search after unmount
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockPerformKitSearch).not.toHaveBeenCalled();
      expect(mockCacheInstance.clear).toHaveBeenCalled();
    });
  });
});
