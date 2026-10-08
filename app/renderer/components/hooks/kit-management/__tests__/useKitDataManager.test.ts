import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../../../tests/factories/kit.factory";
import { createMockSample } from "../../../../../../tests/factories/sample.factory";
import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useKitDataManager } from "../useKitDataManager";

// Using real groupDbSamplesByVoice implementation to handle spaced slots correctly

describe("useKitDataManager", () => {
  const mockSamples = [
    createMockSample({ filename: "kick.wav", slot_number: 0, voice_number: 1 }),
    createMockSample({
      filename: "snare.wav",
      slot_number: 0,
      voice_number: 2,
    }),
  ];

  // getKits() returns each kit's samples inline — that single call is the
  // only data source the hook uses at startup (no per-kit fetching).
  const mockKits: KitWithRelations[] = [
    createMockKitWithRelations({ name: "A0", samples: mockSamples }),
    createMockKitWithRelations({ name: "A1", samples: mockSamples }),
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
        isLocalStoreReady: true,
        localStorePath: null,
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
        isLocalStoreReady: true,
        localStorePath: "/test/path",
      }),
    );

    expect(window.electronAPI.getKits).not.toHaveBeenCalled();
  });

  it("should not load data when the local store isn't ready", () => {
    renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: false,
        localStorePath: "/test/path",
      }),
    );

    expect(window.electronAPI.getKits).not.toHaveBeenCalled();
  });

  it("should load kits when initialized and ready", async () => {
    renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: true,
        localStorePath: "/test/path",
      }),
    );

    // Wait for useEffect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.electronAPI.getKits).toHaveBeenCalled();
  });

  it("does not fetch samples kit-by-kit at startup (N+1 regression guard)", async () => {
    renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: true,
        localStorePath: "/test/path",
      }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Startup samples come from the kits returned by getKits(); the
    // per-kit IPC call is reserved for single-kit reloads.
    expect(window.electronAPI.getKits).toHaveBeenCalledTimes(1);
    expect(window.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
  });

  it("should handle getKits API failure", async () => {
    vi.mocked(window.electronAPI.getKits).mockResolvedValue({
      error: "Failed to load kits",
      success: false,
    });

    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: true,
        localStorePath: "/test/path",
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
        isLocalStoreReady: true,
        localStorePath: "/test/path",
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
        isLocalStoreReady: true,
        localStorePath: "/test/path",
      }),
    );

    // Mock new sample data
    const newSamples = [
      createMockSample({
        filename: "new-kick.wav",
        slot_number: 100,
        voice_number: 1,
      }),
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

  it("should refresh all kits and samples", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: true,
        localStorePath: "/test/path",
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
        isLocalStoreReady: true,
        localStorePath: "/test/path",
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
        isLocalStoreReady: true,
        localStorePath: "/test/path",
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

  it("should handle empty kit name in reloadCurrentKitSamples", async () => {
    // Fresh mock for isolated test
    const freshMock = vi.fn().mockResolvedValue({
      data: mockSamples,
      success: true,
    });

    globalThis.electronAPI = {
      getAllSamplesForKit: freshMock,
      getKits: vi.fn().mockResolvedValue({ data: mockKits, success: true }),
    } as unknown as typeof globalThis.electronAPI;

    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: true,
        localStorePath: "/test/path",
      }),
    );

    await act(async () => {
      await result.current.reloadCurrentKitSamples("");
    });

    // The function will still call the API with empty string
    expect(freshMock).toHaveBeenCalledWith("");
  });

  it("should update state when props change", () => {
    const initialProps: Parameters<typeof useKitDataManager>[0] = {
      isInitialized: false,
      isLocalStoreReady: true,
      localStorePath: null,
    };
    const { rerender, result } = renderHook(
      (props) => useKitDataManager(props),
      { initialProps },
    );

    expect(result.current.kits).toEqual([]);

    // Change props to trigger data loading
    rerender({
      isInitialized: true,
      isLocalStoreReady: true,
      localStorePath: "/test/path",
    });

    // Should trigger loadKitsData
    expect(window.electronAPI.getKits).toHaveBeenCalled();
  });

  it("should provide loadKitsData function", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: true,
        localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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

  describe("[UC-11] markKitModified (RE-35)", () => {
    const loaded = async () => {
      const hook = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
        }),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      return hook;
    };

    it("shows the kit as modified without reloading the kits", async () => {
      const { result } = await loaded();
      vi.mocked(globalThis.electronAPI.getKits).mockClear();

      act(() => {
        result.current.markKitModified("A0");
      });

      expect(result.current.getKitByName("A0")?.modified_since_sync).toBe(true);
      expect(result.current.getKitByName("A1")?.modified_since_sync).toBe(
        false,
      );
      expect(globalThis.electronAPI.getKits).not.toHaveBeenCalled();
    });

    it("keeps the same kits when the kit is already modified, so a gain knob re-renders once", async () => {
      const { result } = await loaded();
      act(() => {
        result.current.markKitModified("A0");
      });
      const kits = result.current.kits;

      act(() => {
        result.current.markKitModified("A0");
      });

      expect(result.current.kits).toBe(kits);
    });
  });

  describe("[UC-10] toggleKitFavorite", () => {
    it("should successfully toggle kit favorite status", async () => {
      vi.mocked(window.electronAPI.toggleKitFavorite).mockResolvedValue({
        data: { isFavorite: true },
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let toggleResult: DbResult<{ isFavorite: boolean }> | undefined;
      await act(async () => {
        toggleResult = await result.current.toggleKitFavorite("A0");
      });

      expect(toggleResult).toEqual({
        data: { isFavorite: true },
        success: true,
      });
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let toggleResult: DbResult<{ isFavorite: boolean }> | undefined;
      await act(async () => {
        toggleResult = await result.current.toggleKitFavorite("A0");
      });

      expect(toggleResult).toEqual({
        error: "Failed to toggle favorite",
        success: false,
      });
    });

    it("should handle API exception", async () => {
      vi.mocked(window.electronAPI.toggleKitFavorite).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
        }),
      );

      // Wait for data to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let toggleResult: DbResult<{ isFavorite: boolean }> | undefined;
      await act(async () => {
        toggleResult = await result.current.toggleKitFavorite("A0");
      });

      expect(toggleResult).toEqual({
        error: "Network error",
        success: false,
      });
    });
  });

  describe("[UC-17] updateKitAlias", () => {
    it("should successfully update kit alias", async () => {
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
        updateKit: undefined,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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

  describe("[UC-17] toggleKitEditable", () => {
    it("should successfully toggle kit editable mode from false to true", async () => {
      vi.mocked(window.electronAPI.updateKit).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
        updateKit: undefined,
      });

      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
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
  // #605: a failed load keeps the samples already shown; a kit with none to
  // show is unavailable (locked) until its samples load. Either way the
  // user is told.
  describe("[UC-07] a kit whose samples can't be loaded", () => {
    const FAILED_A0 = "Couldn't load the samples for kit A0. Try reopening it.";
    const onMessage = vi.fn();

    const renderLoaded = async (kits: KitWithRelations[] = mockKits) => {
      vi.mocked(window.electronAPI.getKits).mockResolvedValue({
        data: kits,
        success: true,
      });
      const rendered = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
          onMessage,
        }),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      return rendered;
    };

    const failSamples = () =>
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
        error: "database is locked",
        success: false,
      });

    // A0 listed without its samples, so there's nothing to keep
    const unloadedA0 = createMockKitWithRelations({
      editable: true,
      name: "A0",
      samples: undefined,
    });

    describe("on a reload", () => {
      it("keeps the samples already shown and says so", async () => {
        const { result } = await renderLoaded();
        const shown = result.current.allKitSamples.A0;
        failSamples();

        await act(async () => {
          await result.current.reloadCurrentKitSamples("A0");
        });

        expect(result.current.allKitSamples.A0).toBe(shown);
        expect(result.current.sampleCounts.A0).toEqual([1, 1, 0, 0]);
        expect(onMessage).toHaveBeenCalledWith(FAILED_A0, "error");
      });

      it("keeps them when the call throws", async () => {
        const { result } = await renderLoaded();
        const shown = result.current.allKitSamples.A0;
        vi.mocked(window.electronAPI.getAllSamplesForKit).mockRejectedValue(
          new Error("IPC closed"),
        );

        await act(async () => {
          await result.current.reloadCurrentKitSamples("A0");
        });

        expect(result.current.allKitSamples.A0).toBe(shown);
        expect(onMessage).toHaveBeenCalledWith(FAILED_A0, "error");
      });

      it("leaves the kit as editable as it was", async () => {
        const { result } = await renderLoaded([
          createMockKitWithRelations({
            editable: true,
            name: "A0",
            samples: mockSamples,
          }),
        ]);
        failSamples();

        await act(async () => {
          await result.current.reloadCurrentKitSamples("A0");
        });

        expect(result.current.getKitByName("A0")?.editable).toBe(true);
      });

      it("tries again when the kit is opened again", async () => {
        const { result } = await renderLoaded();
        failSamples();
        await act(async () => {
          await result.current.reloadCurrentKitSamples("A0");
        });
        const newSamples = [
          createMockSample({ filename: "new.wav", voice_number: 3 }),
        ];
        vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
          data: newSamples,
          success: true,
        });

        await act(async () => {
          await result.current.loadKitSamplesOnOpen("A0");
        });

        expect(result.current.sampleCounts.A0).toEqual([0, 0, 1, 0]);
      });
    });

    describe("on a first open with nothing to keep", () => {
      it("shows the kit as unavailable, not editable, and says so", async () => {
        const { result } = await renderLoaded([unloadedA0, mockKits[1]]);
        failSamples();

        await act(async () => {
          await result.current.loadKitSamplesOnOpen("A0");
        });

        expect(window.electronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
          "A0",
        );
        expect(onMessage).toHaveBeenCalledWith(FAILED_A0, "error");
        expect(result.current.allKitSamples.A0).toBeUndefined();
        expect(result.current.getKitByName("A0")?.editable).toBe(false);
        expect(
          result.current.kits.find((kit) => kit.name === "A0")?.editable,
        ).toBe(false);
        // Other kits are untouched
        expect(result.current.getKitByName("A1")).toBe(mockKits[1]);
      });

      it("keeps the kit locked: turning editing on says why instead", async () => {
        const { result } = await renderLoaded([unloadedA0]);
        failSamples();
        await act(async () => {
          await result.current.loadKitSamplesOnOpen("A0");
        });
        onMessage.mockClear();

        await act(async () => {
          await result.current.toggleKitEditable("A0");
        });

        expect(window.electronAPI.updateKit).not.toHaveBeenCalled();
        expect(onMessage).toHaveBeenCalledWith(FAILED_A0, "error");
        expect(result.current.getKitByName("A0")?.editable).toBe(false);
      });

      it("shows the kit again once reopening loads its samples", async () => {
        const { result } = await renderLoaded([unloadedA0]);
        failSamples();
        await act(async () => {
          await result.current.loadKitSamplesOnOpen("A0");
        });
        vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
          data: mockSamples,
          success: true,
        });

        await act(async () => {
          await result.current.loadKitSamplesOnOpen("A0");
        });

        expect(result.current.sampleCounts.A0).toEqual([1, 1, 0, 0]);
        expect(result.current.getKitByName("A0")?.editable).toBe(true);
      });

      it("shows the kit again after a full refresh", async () => {
        const { result } = await renderLoaded([unloadedA0]);
        failSamples();
        await act(async () => {
          await result.current.loadKitSamplesOnOpen("A0");
        });
        vi.mocked(window.electronAPI.getKits).mockResolvedValue({
          data: [{ ...unloadedA0, samples: mockSamples }],
          success: true,
        });

        await act(async () => {
          await result.current.refreshAllKitsAndSamples();
        });

        expect(result.current.getKitByName("A0")?.editable).toBe(true);
        expect(result.current.sampleCounts.A0).toEqual([1, 1, 0, 0]);
      });

      it("loads the samples on opening when they can be loaded", async () => {
        const { result } = await renderLoaded([unloadedA0]);

        await act(async () => {
          await result.current.loadKitSamplesOnOpen("A0");
        });

        expect(result.current.allKitSamples.A0).toBeDefined();
        expect(result.current.getKitByName("A0")?.editable).toBe(true);
        expect(onMessage).not.toHaveBeenCalled();
      });
    });

    it("doesn't fetch on opening a kit whose samples are loaded", async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.loadKitSamplesOnOpen("A0");
      });

      expect(window.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("doesn't fetch for a kit that isn't in the list", async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.loadKitSamplesOnOpen("Z9");
      });

      expect(window.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
    });
  });

  describe("[Q-07] scrolling to a kit after a load (#709)", () => {
    const readyProps = {
      isInitialized: true,
      isLocalStoreReady: true,
      localStorePath: "/store",
    };
    let kitEl: HTMLElement;

    beforeEach(() => {
      vi.useFakeTimers();
      kitEl = document.createElement("div");
      kitEl.dataset.kit = "A1";
      kitEl.scrollIntoView = vi.fn();
      document.body.appendChild(kitEl);
    });

    afterEach(() => {
      kitEl.remove();
      vi.useRealTimers();
    });

    async function renderLoaded() {
      const hook = renderHook(() => useKitDataManager(readyProps));
      // Let the load on mount finish
      await act(async () => {});
      return hook;
    }

    it("scrolls the kit into view 100 ms after the kits load", async () => {
      const { result } = await renderLoaded();

      await act(() => result.current.loadKitsData("A1"));
      expect(kitEl.scrollIntoView).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(kitEl.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      });
    });

    it("doesn't scroll if it unmounts before the scroll", async () => {
      const { result, unmount } = await renderLoaded();
      await act(() => result.current.loadKitsData("A1"));
      expect(vi.getTimerCount()).toBe(1);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(100);
      expect(kitEl.scrollIntoView).not.toHaveBeenCalled();
    });

    it("schedules no scroll if it unmounts while the kits load", async () => {
      const { result, unmount } = await renderLoaded();
      let finishLoading!: (kits: DbResult<KitWithRelations[]>) => void;
      vi.mocked(globalThis.electronAPI.getKits).mockReturnValueOnce(
        new Promise((resolve) => {
          finishLoading = resolve;
        }),
      );

      const loading = result.current.loadKitsData("A1");
      unmount();
      finishLoading({ data: mockKits, success: true });
      await loading;

      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(100);
      expect(kitEl.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
