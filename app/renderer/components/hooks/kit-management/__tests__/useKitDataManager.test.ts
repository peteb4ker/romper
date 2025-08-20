import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useKitDataManager } from "../useKitDataManager";

// Using real groupDbSamplesByVoice implementation to handle spaced slots correctly

describe("useKitDataManager", () => {
  const mockKits: KitWithRelations[] = [
    {
      alias: null,
      bank_letter: "A",
      editable: false,
      name: "A0",
    } as KitWithRelations,
    {
      alias: null,
      bank_letter: "A",
      editable: false,
      name: "A1",
    } as KitWithRelations,
  ];

  const mockSamples = [
    {
      filename: "kick.wav",
      is_stereo: false,
      slot_number: 0,
      voice_number: 1,
    },
    {
      filename: "snare.wav",
      is_stereo: false,
      slot_number: 0,
      voice_number: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset window.electronAPI to default state for each test
    setupElectronAPIMock({
      getAllSamplesForKit: vi.fn().mockResolvedValue({
        data: mockSamples,
        success: true,
      }),
      getKits: vi.fn().mockResolvedValue({
        data: mockKits,
        success: true,
      }),
      toggleKitFavorite: vi.fn().mockResolvedValue({
        data: { isFavorite: true },
        success: true,
      }),
      updateKit: vi.fn().mockResolvedValue({
        success: true,
      }),
    });
  });

  it("should initialize with empty state", () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: false,
        localStorePath: null,
        needsLocalStoreSetup: false,
      }),
    );

    expect(result.current.kits).toEqual([]);
    expect(result.current.allKitSamples).toEqual({});
    expect(result.current.sampleCounts).toEqual({});
  });

  it("should not load data when not initialized", () => {
    renderHook(() =>
      useKitDataManager({
        isInitialized: false,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    expect(window.electronAPI.getKits).not.toHaveBeenCalled();
  });

  it("should not load data when local store needs setup", () => {
    renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: true,
      }),
    );

    expect(window.electronAPI.getKits).not.toHaveBeenCalled();
  });

  it("should load kits when initialized and ready", async () => {
    renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    // Wait for useEffect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.electronAPI.getKits).toHaveBeenCalled();
  });

  it("should handle getKits API failure", async () => {
    vi.mocked(window.electronAPI.getKits).mockResolvedValue({
      error: "Failed to load kits",
      success: false,
    });

    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    // Wait for useEffect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.kits).toEqual([]);
  });

  it("should handle getKits API exception", async () => {
    vi.mocked(window.electronAPI.getKits).mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    // Wait for useEffect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.kits).toEqual([]);
  });

  it("should reload samples for a specific kit", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    // Mock new sample data
    const newSamples = [
      {
        filename: "new-kick.wav",
        is_stereo: false,
        slot_number: 100,
        voice_number: 1,
      },
    ];
    vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
      data: newSamples,
      success: true,
    });

    // Reload samples for A0
    await act(async () => {
      await result.current.reloadCurrentKitSamples("A0");
    });

    expect(window.electronAPI.getAllSamplesForKit).toHaveBeenCalledWith("A0");
  });

  it("should handle sample reload failure", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
      error: "Failed to load samples",
      success: false,
    });

    await act(async () => {
      await result.current.reloadCurrentKitSamples("A0");
    });

    expect(window.electronAPI.getAllSamplesForKit).toHaveBeenCalledWith("A0");
  });

  it("should handle sample reload exception", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    vi.mocked(window.electronAPI.getAllSamplesForKit).mockRejectedValue(
      new Error("Network error"),
    );

    await act(async () => {
      await result.current.reloadCurrentKitSamples("A0");
    });

    expect(window.electronAPI.getAllSamplesForKit).toHaveBeenCalledWith("A0");
  });

  it("should refresh all kits and samples", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    // Mock updated data
    const newKits = [
      {
        alias: null,
        bank_letter: "B",
        editable: false,
        name: "B0",
      } as KitWithRelations,
    ];
    vi.mocked(window.electronAPI.getKits).mockResolvedValue({
      data: newKits,
      success: true,
    });

    await act(async () => {
      await result.current.refreshAllKitsAndSamples();
    });

    expect(window.electronAPI.getKits).toHaveBeenCalled();
  });

  it("should handle refresh all kits failure", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    vi.mocked(window.electronAPI.getKits).mockResolvedValue({
      error: "Failed to refresh kits",
      success: false,
    });

    await act(async () => {
      await result.current.refreshAllKitsAndSamples();
    });

    expect(window.electronAPI.getKits).toHaveBeenCalled();
  });

  it("should calculate sample counts correctly", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    // Wait for async data loading to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Sample counts should be calculated from loaded kits and samples
    expect(result.current.sampleCounts).toBeDefined();

    // Both kits should have sample counts (from mock data: kick.wav in voice 1, snare.wav in voice 2)
    expect(result.current.sampleCounts["A0"]).toEqual([1, 1, 0, 0]);
    expect(result.current.sampleCounts["A1"]).toEqual([1, 1, 0, 0]);
  });

  it("should handle null kit name in reloadCurrentKitSamples", async () => {
    // Fresh mock for isolated test
    const freshMock = vi.fn().mockResolvedValue({
      data: mockSamples,
      success: true,
    });

    globalThis.window = {
      ...globalThis.window,
      electronAPI: {
        getAllSamplesForKit: freshMock,
        getKits: vi.fn().mockResolvedValue({ data: mockKits, success: true }),
      },
    };

    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    await act(async () => {
      await result.current.reloadCurrentKitSamples(null);
    });

    // The function will still call the API with null
    expect(freshMock).toHaveBeenCalledWith(null);
  });

  it("should handle empty kit name in reloadCurrentKitSamples", async () => {
    // Fresh mock for isolated test
    const freshMock = vi.fn().mockResolvedValue({
      data: mockSamples,
      success: true,
    });

    globalThis.window = {
      ...globalThis.window,
      electronAPI: {
        getAllSamplesForKit: freshMock,
        getKits: vi.fn().mockResolvedValue({ data: mockKits, success: true }),
      },
    };

    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    await act(async () => {
      await result.current.reloadCurrentKitSamples("");
    });

    // The function will still call the API with empty string
    expect(freshMock).toHaveBeenCalledWith("");
  });

  it("should update state when props change", () => {
    const { rerender, result } = renderHook(
      (props) => useKitDataManager(props),
      {
        initialProps: {
          isInitialized: false,
          localStorePath: null,
          needsLocalStoreSetup: false,
        },
      },
    );

    expect(result.current.kits).toEqual([]);

    // Change props to trigger data loading
    rerender({
      isInitialized: true,
      localStorePath: "/test/path",
      needsLocalStoreSetup: false,
    });

    // Should trigger loadKitsData
    expect(window.electronAPI.getKits).toHaveBeenCalled();
  });

  it("should provide loadKitsData function", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        localStorePath: "/test/path",
        needsLocalStoreSetup: false,
      }),
    );

    await act(async () => {
      await result.current.loadKitsData();
    });

    expect(window.electronAPI.getKits).toHaveBeenCalled();
  });

  describe("getKitByName", () => {
    it("should return kit when it exists", async () => {
      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const kit = result.current.getKitByName("A0");
      expect(kit).toBeDefined();
      expect(kit?.name).toBe("A0");
      expect(kit?.bank_letter).toBe("A");
    });

    it("should return undefined for non-existing kit", async () => {
      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const kit = result.current.getKitByName("NonExistent");
      expect(kit).toBeUndefined();
    });
  });

  describe("updateKit", () => {
    it("should update kit properties in state", async () => {
      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Update kit with new properties
      act(() => {
        result.current.updateKit("A0", {
          alias: "Updated Kit",
          editable: true,
        });
      });

      const updatedKit = result.current.getKitByName("A0");
      expect(updatedKit?.alias).toBe("Updated Kit");
      expect(updatedKit?.editable).toBe(true);
      expect(updatedKit?.name).toBe("A0"); // Should preserve other properties
    });

    it("should not affect other kits", async () => {
      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Update one kit
      act(() => {
        result.current.updateKit("A0", { alias: "Updated Kit" });
      });

      // Check that other kit is unchanged
      const otherKit = result.current.getKitByName("A1");
      expect(otherKit?.alias).toBeNull();
      expect(otherKit?.name).toBe("A1");
    });
  });

  describe("toggleKitFavorite", () => {
    it("should successfully toggle kit favorite status", async () => {
      vi.mocked(window.electronAPI.toggleKitFavorite).mockResolvedValue({
        data: { isFavorite: true },
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let toggleResult: { isFavorite?: boolean; success: boolean };
      await act(async () => {
        toggleResult = await result.current.toggleKitFavorite("A0");
      });

      expect(toggleResult.success).toBe(true);
      expect(toggleResult.isFavorite).toBe(true);
      expect(window.electronAPI.toggleKitFavorite).toHaveBeenCalledWith("A0");

      // Check that local state was updated
      const kit = result.current.getKitByName("A0");
      expect(kit?.is_favorite).toBe(true);
    });

    it("should handle API failure", async () => {
      vi.mocked(window.electronAPI.toggleKitFavorite).mockResolvedValue({
        error: "Failed to toggle favorite",
        success: false,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let toggleResult: { isFavorite?: boolean; success: boolean };
      await act(async () => {
        toggleResult = await result.current.toggleKitFavorite("A0");
      });

      expect(toggleResult.success).toBe(false);
      expect(toggleResult.isFavorite).toBeUndefined();
    });

    it("should handle API exception", async () => {
      vi.mocked(window.electronAPI.toggleKitFavorite).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let toggleResult: { isFavorite?: boolean; success: boolean };
      await act(async () => {
        toggleResult = await result.current.toggleKitFavorite("A0");
      });

      expect(toggleResult.success).toBe(false);
      expect(toggleResult.isFavorite).toBeUndefined();
    });
  });

  describe("updateKitAlias", () => {
    it("should successfully update kit alias", async () => {
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateKitAlias("A0", "New Alias");
      });

      expect(window.electronAPI.updateKit).toHaveBeenCalledWith("A0", {
        alias: "New Alias",
      });

      // Check that local state was updated
      const kit = result.current.getKitByName("A0");
      expect(kit?.alias).toBe("New Alias");
    });

    it("should handle API failure", async () => {
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        error: "Failed to update alias",
        success: false,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await expect(
          result.current.updateKitAlias("A0", "New Alias"),
        ).rejects.toThrow("Failed to update alias");
      });
    });

    it("should handle API exception", async () => {
      vi.mocked(window.electronAPI.updateKit).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await expect(
          result.current.updateKitAlias("A0", "New Alias"),
        ).rejects.toThrow("Network error");
      });
    });

    it("should throw error when updateKit API not available", async () => {
      // Mock missing API by setting updateKit to undefined
      setupElectronAPIMock({
        updateKit: undefined as unknown,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await expect(
          result.current.updateKitAlias("A0", "New Alias"),
        ).rejects.toThrow("Update kit API not available");
      });
    });
  });

  describe("toggleKitEditable", () => {
    it("should successfully toggle kit editable mode from false to true", async () => {
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Initially kit should be non-editable
      const initialKit = result.current.getKitByName("A0");
      expect(initialKit?.editable).toBe(false);

      await act(async () => {
        await result.current.toggleKitEditable("A0");
      });

      expect(window.electronAPI.updateKit).toHaveBeenCalledWith("A0", {
        editable: true,
      });

      // Check that local state was updated
      const updatedKit = result.current.getKitByName("A0");
      expect(updatedKit?.editable).toBe(true);
    });

    it("should successfully toggle kit editable mode from true to false", async () => {
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // First set kit to editable
      act(() => {
        result.current.updateKit("A0", { editable: true });
      });

      // Now toggle it back to false
      await act(async () => {
        await result.current.toggleKitEditable("A0");
      });

      expect(window.electronAPI.updateKit).toHaveBeenCalledWith("A0", {
        editable: false,
      });

      // Check that local state was updated
      const updatedKit = result.current.getKitByName("A0");
      expect(updatedKit?.editable).toBe(false);
    });

    it("should handle non-existing kit", async () => {
      // Ensure updateKit API is available for this test
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await expect(
          result.current.toggleKitEditable("NonExistent"),
        ).rejects.toThrow("Kit NonExistent not found");
      });
    });

    it("should handle API failure", async () => {
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        error: "Failed to toggle editable mode",
        success: false,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await expect(result.current.toggleKitEditable("A0")).rejects.toThrow(
          "Failed to toggle editable mode",
        );
      });
    });

    it("should handle API exception", async () => {
      vi.mocked(window.electronAPI.updateKit).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await expect(result.current.toggleKitEditable("A0")).rejects.toThrow(
          "Network error",
        );
      });
    });

    it("should throw error when updateKit API not available", async () => {
      // Mock missing API by setting updateKit to undefined
      setupElectronAPIMock({
        updateKit: undefined as unknown,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          localStorePath: "/test/path",
          needsLocalStoreSetup: false,
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await expect(result.current.toggleKitEditable("A0")).rejects.toThrow(
          "Update kit API not available",
        );
      });
    });
  });
});
