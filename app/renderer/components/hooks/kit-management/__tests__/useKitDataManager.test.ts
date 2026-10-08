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
      // One kit with its samples, as main's get-kit returns it
      getKit: vi.fn((name: string) =>
        Promise.resolve({
          data: createMockKitWithRelations({ name, samples: mockSamples }),
          success: true,
        }),
      ),
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
    vi.mocked(window.electronAPI.getKit).mockResolvedValue({
      data: createMockKitWithRelations({ name: "A0", samples: newSamples }),
      success: true,
    });

    // Reload samples for A0: the kit and its samples come in one call
    await act(async () => {
      await result.current.refreshKit("A0");
    });

    expect(window.electronAPI.getKit).toHaveBeenCalledWith("A0");
    expect(window.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
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

  it("should handle empty kit name in refreshKit", async () => {
    const { result } = renderHook(() =>
      useKitDataManager({
        isInitialized: true,
        isLocalStoreReady: true,
        localStorePath: "/test/path",
      }),
    );

    await act(async () => {
      await result.current.refreshKit("");
    });

    // The function will still call the API with empty string
    expect(window.electronAPI.getKit).toHaveBeenCalledWith("");
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

  // RE-35: main flags the kit with the gain. #452: the gain goes into the
  // loaded kit's rows too, which the voice panels read instead of asking
  // main again.
  describe("[UC-11] [UC-24] markGainSaved (RE-35, #452)", () => {
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
    const kickGain = (
      result: { current: ReturnType<typeof useKitDataManager> },
      kit = "A0",
    ) =>
      result.current
        .getKitByName(kit)
        ?.samples?.find((s) => s.voice_number === 1 && s.slot_number === 0)
        ?.gain_db;

    it("shows the gain and the kit as modified without reloading anything", async () => {
      const { result } = await loaded();
      vi.mocked(globalThis.electronAPI.getKits).mockClear();
      const otherKit = result.current.getKitByName("A1");

      act(() => {
        result.current.markGainSaved("A0", 1, 0, 4);
      });

      expect(kickGain(result)).toBe(4);
      expect(result.current.getKitByName("A0")?.modified_since_sync).toBe(true);
      expect(result.current.getKitByName("A1")).toBe(otherKit);
      expect(globalThis.electronAPI.getKits).not.toHaveBeenCalled();
      expect(globalThis.electronAPI.getKit).not.toHaveBeenCalled();
    });

    it("keeps the same kits when the gain and the flag already show", async () => {
      const { result } = await loaded();
      act(() => {
        result.current.markGainSaved("A0", 1, 0, 4);
      });
      const kits = result.current.kits;

      act(() => {
        result.current.markGainSaved("A0", 1, 0, 4);
      });

      expect(result.current.kits).toBe(kits);
    });

    it("[Q-01] keeps a saved gain over a reload sent before it", async () => {
      const { result } = await loaded();
      let answer: (value: DbResult<KitWithRelations>) => void = () => {};
      vi.mocked(globalThis.electronAPI.getKit).mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      let reload: Promise<void>;
      act(() => {
        reload = result.current.refreshKit("A0");
      });
      act(() => {
        result.current.markGainSaved("A0", 1, 0, 4);
      });

      await act(async () => {
        answer({
          data: createMockKitWithRelations({
            alias: "Added a sample",
            name: "A0",
            samples: mockSamples,
          }),
          success: true,
        });
        await reload;
      });

      // The reload's other changes land, and the gain stays
      expect(result.current.getKitByName("A0")?.alias).toBe("Added a sample");
      expect(kickGain(result)).toBe(4);
      expect(result.current.getKitByName("A0")?.modified_since_sync).toBe(true);
    });

    it("shows what a reload sent after the save reads", async () => {
      const { result } = await loaded();
      act(() => {
        result.current.markGainSaved("A0", 1, 0, 4);
      });
      vi.mocked(globalThis.electronAPI.getKit).mockResolvedValueOnce({
        data: createMockKitWithRelations({
          name: "A0",
          samples: [createMockSample({ gain_db: -2 })],
        }),
        success: true,
      });

      await act(async () => {
        await result.current.refreshKit("A0");
      });

      expect(kickGain(result)).toBe(-2);
    });
  });

  // #452 step 3: an edit to a kit's own fields or voices returns the kit,
  // without its samples, and the renderer shows it instead of reading it
  describe("[Q-01] [UC-30] applyKitEdit (#452)", () => {
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
      vi.mocked(globalThis.electronAPI.getKits).mockClear();
      return hook;
    };
    const editOf = (pattern: number[][]) => {
      const kit = createMockKitWithRelations({
        modified_since_sync: true,
        name: "A0",
        step_pattern: pattern,
      });
      delete kit.samples;
      return kit;
    };

    it("shows the edited kit, keeping its samples, without asking main", async () => {
      const { result } = await loaded();
      const samples = result.current.getKitByName("A0")?.samples;
      const shownSamples = result.current.allKitSamples.A0;
      const otherKit = result.current.getKitByName("A1");

      act(() => {
        result.current.applyKitEdit("A0", editOf([[1]]));
      });

      expect(result.current.getKitByName("A0")?.step_pattern).toEqual([[1]]);
      expect(result.current.getKitByName("A0")?.samples).toBe(samples);
      expect(result.current.allKitSamples.A0).toBe(shownSamples);
      expect(result.current.getKitByName("A1")).toBe(otherKit);
      expect(globalThis.electronAPI.getKit).not.toHaveBeenCalled();
      expect(globalThis.electronAPI.getKits).not.toHaveBeenCalled();
    });

    it("ignores a kit returned for another kit's name", async () => {
      const { result } = await loaded();
      const kits = result.current.kits;

      act(() => {
        result.current.applyKitEdit("A1", editOf([[1]]));
      });

      expect(result.current.kits).toBe(kits);
    });

    it("keeps the latest edit over a reload sent before it", async () => {
      const { result } = await loaded();
      let answer: (value: DbResult<KitWithRelations>) => void = () => {};
      vi.mocked(globalThis.electronAPI.getKit).mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      let reload: Promise<void>;
      act(() => {
        reload = result.current.refreshKit("A0");
      });
      act(() => {
        result.current.applyKitEdit("A0", editOf([[1]]));
        result.current.applyKitEdit("A0", editOf([[1, 1]]));
      });

      await act(async () => {
        answer({
          data: createMockKitWithRelations({
            name: "A0",
            samples: [createMockSample({ filename: "added.wav" })],
            step_pattern: null,
          }),
          success: true,
        });
        await reload;
      });

      // The reload's samples land; the edit's pattern stays
      expect(result.current.getKitByName("A0")?.step_pattern).toEqual([[1, 1]]);
      expect(result.current.allKitSamples.A0[1][0]).toBe("added.wav");
    });

    it("shows what a reload sent after the edit reads", async () => {
      const { result } = await loaded();
      act(() => {
        result.current.applyKitEdit("A0", editOf([[1]]));
      });
      vi.mocked(globalThis.electronAPI.getKit).mockResolvedValueOnce({
        data: createMockKitWithRelations({
          name: "A0",
          samples: mockSamples,
          step_pattern: [[0]],
        }),
        success: true,
      });

      await act(async () => {
        await result.current.refreshKit("A0");
      });

      expect(result.current.getKitByName("A0")?.step_pattern).toEqual([[0]]);
    });
  });

  describe("[UC-10] a saved change and an older reload (#452)", () => {
    it("keeps a favorite saved after a full reload was sent", async () => {
      const { result } = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
        }),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      let answer: (value: DbResult<KitWithRelations[]>) => void = () => {};
      vi.mocked(globalThis.electronAPI.getKits).mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      let reload: Promise<void>;
      act(() => {
        reload = result.current.refreshAllKitsAndSamples();
      });
      await act(async () => {
        await result.current.toggleKitFavorite("A0");
      });

      await act(async () => {
        answer({ data: mockKits, success: true });
        await reload;
      });

      expect(result.current.getKitByName("A0")?.is_favorite).toBe(true);
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

    // The kit, samples and all, is read with one get-kit call (#452)
    const failSamples = () =>
      vi.mocked(window.electronAPI.getKit).mockResolvedValue({
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
          await result.current.refreshKit("A0");
        });

        expect(result.current.allKitSamples.A0).toBe(shown);
        expect(result.current.sampleCounts.A0).toEqual([1, 1, 0, 0]);
        expect(onMessage).toHaveBeenCalledWith(FAILED_A0, "error");
      });

      it("keeps them when the call throws", async () => {
        const { result } = await renderLoaded();
        const shown = result.current.allKitSamples.A0;
        vi.mocked(window.electronAPI.getKit).mockRejectedValue(
          new Error("IPC closed"),
        );

        await act(async () => {
          await result.current.refreshKit("A0");
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
          await result.current.refreshKit("A0");
        });

        expect(result.current.getKitByName("A0")?.editable).toBe(true);
      });

      it("tries again when the kit is opened again", async () => {
        const { result } = await renderLoaded();
        failSamples();
        await act(async () => {
          await result.current.refreshKit("A0");
        });
        const newSamples = [
          createMockSample({ filename: "new.wav", voice_number: 3 }),
        ];
        vi.mocked(window.electronAPI.getKit).mockResolvedValue({
          data: createMockKitWithRelations({ name: "A0", samples: newSamples }),
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

        expect(window.electronAPI.getKit).toHaveBeenCalledWith("A0");
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
        vi.mocked(window.electronAPI.getKit).mockResolvedValue({
          data: { ...unloadedA0, samples: mockSamples },
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
        vi.mocked(window.electronAPI.getKit).mockResolvedValue({
          data: { ...unloadedA0, samples: mockSamples },
          success: true,
        });

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

      expect(window.electronAPI.getKit).not.toHaveBeenCalled();
    });

    it("doesn't fetch for a kit that isn't in the list", async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.loadKitSamplesOnOpen("Z9");
      });

      expect(window.electronAPI.getKit).not.toHaveBeenCalled();
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

  // These replace tests that ran copies of the lookup, the optimistic
  // update and the counts instead of the hook (#601)
  describe("[Q-07] kit lookup, optimistic updates and sample counts (#601)", () => {
    const readyProps = {
      isInitialized: true,
      isLocalStoreReady: true,
      localStorePath: "/store",
    };

    // Samples filling the first `count` slots of a voice
    function voiceSamples(voice: number, count: number) {
      return Array.from({ length: count }, (_, slot) =>
        createMockSample({
          filename: `v${voice}s${slot}.wav`,
          slot_number: slot,
          voice_number: voice,
        }),
      );
    }

    async function renderWithKits(kits: KitWithRelations[]) {
      vi.mocked(globalThis.electronAPI.getKits).mockResolvedValue({
        data: kits,
        success: true,
      });
      const hook = renderHook(() => useKitDataManager(readyProps));
      // Let the load on mount finish
      await act(async () => {});
      return hook;
    }

    describe("[UC-07] getKitByName", () => {
      it("finds a kit by its exact name, case and all", async () => {
        const { result } = await renderWithKits([
          createMockKitWithRelations({ alias: "Drums", name: "A0" }),
          createMockKitWithRelations({ alias: "Bass", name: "A1" }),
        ]);

        expect(result.current.getKitByName("A1")?.alias).toBe("Bass");
        expect(result.current.getKitByName("a1")).toBeUndefined();
        expect(result.current.getKitByName("A")).toBeUndefined();
      });

      it("finds no kit before the kits load", () => {
        const { result } = renderHook(() =>
          useKitDataManager({ ...readyProps, isInitialized: false }),
        );

        expect(result.current.getKitByName("A0")).toBeUndefined();
      });

      it("finds no kit when the library has none", async () => {
        const { result } = await renderWithKits([]);

        expect(result.current.kits).toEqual([]);
        expect(result.current.getKitByName("A0")).toBeUndefined();
      });

      it("finds kits whose names have dashes, underscores or spaces", async () => {
        const names = [
          "Kit-With-Dashes",
          "Kit_With_Underscores",
          "Kit With Spaces",
        ];
        const { result } = await renderWithKits(
          names.map((name) => createMockKitWithRelations({ name })),
        );

        for (const name of names) {
          expect(result.current.getKitByName(name)?.name).toBe(name);
        }
      });
    });

    describe("[UC-17] updateKit", () => {
      const loadedKits = () => [
        createMockKitWithRelations({
          alias: null,
          bpm: 120,
          editable: false,
          is_favorite: false,
          name: "A0",
        }),
        createMockKitWithRelations({
          alias: "My Favorite Kit",
          bpm: 140,
          editable: true,
          is_favorite: true,
          name: "A1",
        }),
      ];

      it("updates several properties at once and keeps the rest", async () => {
        const { result } = await renderWithKits(loadedKits());

        act(() => {
          result.current.updateKit("A1", {
            alias: "Updated Alias",
            bpm: 160,
            is_favorite: false,
          });
        });

        expect(result.current.getKitByName("A1")).toMatchObject({
          alias: "Updated Alias",
          bank_letter: "A",
          bpm: 160,
          editable: true,
          is_favorite: false,
          name: "A1",
        });
        expect(result.current.getKitByName("A0")).toMatchObject({
          alias: null,
          bpm: 120,
          is_favorite: false,
        });
      });

      it("leaves the kits as they were for a kit that isn't listed", async () => {
        const { result } = await renderWithKits(loadedKits());
        const before = result.current.kits;

        act(() => {
          result.current.updateKit("B9", { is_favorite: true });
        });

        expect(result.current.kits).toEqual(before);
      });

      it("doesn't change the kit objects the load returned", async () => {
        const kits = loadedKits();
        const { result } = await renderWithKits(kits);
        const loadedA0 = result.current.getKitByName("A0");

        act(() => {
          result.current.updateKit("A0", { is_favorite: true });
        });

        expect(kits[0].is_favorite).toBe(false);
        expect(loadedA0?.is_favorite).toBe(false);
        expect(result.current.getKitByName("A0")?.is_favorite).toBe(true);
      });
    });

    describe("[UC-08] sampleCounts", () => {
      it("counts each kit's samples per voice", async () => {
        const { result } = await renderWithKits([
          createMockKitWithRelations({
            name: "A0",
            samples: [
              ...voiceSamples(1, 2),
              ...voiceSamples(2, 1),
              ...voiceSamples(4, 3),
            ],
          }),
          createMockKitWithRelations({
            name: "A1",
            samples: [...voiceSamples(1, 1), ...voiceSamples(3, 2)],
          }),
        ]);

        expect(result.current.sampleCounts).toEqual({
          A0: [2, 1, 0, 3],
          A1: [1, 0, 2, 0],
        });
      });

      it("counts a full voice of 12 samples", async () => {
        const { result } = await renderWithKits([
          createMockKitWithRelations({
            name: "A0",
            samples: [
              ...voiceSamples(1, 12),
              ...voiceSamples(2, 5),
              ...voiceSamples(3, 8),
              ...voiceSamples(4, 12),
            ],
          }),
        ]);

        expect(result.current.sampleCounts.A0).toEqual([12, 5, 8, 12]);
      });

      it("counts zero for an empty kit and for one loaded without its samples", async () => {
        const { result } = await renderWithKits([
          createMockKitWithRelations({ name: "A0", samples: [] }),
          createMockKitWithRelations({ name: "A1", samples: undefined }),
        ]);

        expect(result.current.sampleCounts).toEqual({
          A0: [0, 0, 0, 0],
          A1: [0, 0, 0, 0],
        });
      });

      it("has no counts when the library has no kits", async () => {
        const { result } = await renderWithKits([]);

        expect(result.current.sampleCounts).toEqual({});
      });
    });
  });

  // #452: an edit reloads only its kit, and a slower, older response can't
  // put older data back over newer
  describe("[Q-01] reloading one kit (#452)", () => {
    type KitResult = DbResult<KitWithRelations>;
    type KitsResult = DbResult<KitWithRelations[]>;

    /** A promise the test resolves when it chooses */
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    const kitWith = (name: string, filename: string, voice = 1) =>
      createMockKitWithRelations({
        name,
        samples: [createMockSample({ filename, voice_number: voice })],
        step_pattern: null,
      });
    const ok = <T>(data: T) => ({ data, success: true as const });

    const renderLoaded = async () => {
      const rendered = renderHook(() =>
        useKitDataManager({
          isInitialized: true,
          isLocalStoreReady: true,
          localStorePath: "/test/path",
        }),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      vi.mocked(window.electronAPI.getKits).mockClear();
      return rendered;
    };
    const voice1 = (
      result: { current: ReturnType<typeof useKitDataManager> },
      kit: string,
    ) => result.current.allKitSamples[kit]?.[1]?.[0];

    it("[UC-19] reloads the kit with one get-kit call, not every kit", async () => {
      const { result } = await renderLoaded();
      const otherKit = result.current.getKitByName("A1");
      vi.mocked(window.electronAPI.getKit).mockResolvedValue(
        ok(kitWith("A0", "added.wav")),
      );

      await act(async () => {
        await result.current.refreshKit("A0");
      });

      expect(window.electronAPI.getKit).toHaveBeenCalledTimes(1);
      expect(window.electronAPI.getKits).not.toHaveBeenCalled();
      expect(window.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
      // Both copies of the kit's samples change together
      expect(voice1(result, "A0")).toBe("added.wav");
      expect(result.current.getKitByName("A0")?.samples?.[0]?.filename).toBe(
        "added.wav",
      );
      // Other kits keep their objects, so they don't redraw
      expect(result.current.getKitByName("A1")).toBe(otherKit);
    });

    it("[UC-30] drops an older response that arrives after a newer one", async () => {
      const { result } = await renderLoaded();
      const first = deferred<KitResult>();
      const second = deferred<KitResult>();
      vi.mocked(window.electronAPI.getKit)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      let older: Promise<void>;
      let newer: Promise<void>;
      act(() => {
        older = result.current.refreshKit("A0");
        newer = result.current.refreshKit("A0");
      });
      await act(async () => {
        second.resolve(ok(kitWith("A0", "newer.wav")));
        await newer;
      });
      await act(async () => {
        first.resolve(ok(kitWith("A0", "older.wav")));
        await older;
      });

      expect(voice1(result, "A0")).toBe("newer.wav");
    });

    it("keeps a kit read sent after a full load that arrives later", async () => {
      const { result } = await renderLoaded();
      const full = deferred<KitsResult>();
      vi.mocked(window.electronAPI.getKits).mockReturnValueOnce(full.promise);
      vi.mocked(window.electronAPI.getKit).mockResolvedValue(
        ok(kitWith("A0", "edited.wav")),
      );

      let fullLoad: Promise<void>;
      act(() => {
        fullLoad = result.current.refreshAllKitsAndSamples();
      });
      await act(async () => {
        await result.current.refreshKit("A0");
      });
      await act(async () => {
        full.resolve(
          ok([kitWith("A0", "stale.wav"), kitWith("A1", "fresh.wav")]),
        );
        await fullLoad;
      });

      expect(voice1(result, "A0")).toBe("edited.wav");
      expect(result.current.getKitByName("A0")?.samples?.[0]?.filename).toBe(
        "edited.wav",
      );
      // The rest of the full load lands
      expect(voice1(result, "A1")).toBe("fresh.wav");
    });

    it("drops a kit read sent before a full load that landed first", async () => {
      const { result } = await renderLoaded();
      const kitRead = deferred<KitResult>();
      vi.mocked(window.electronAPI.getKit).mockReturnValueOnce(kitRead.promise);
      vi.mocked(window.electronAPI.getKits).mockResolvedValue(
        ok([kitWith("A0", "fresh.wav"), kitWith("A1", "fresh.wav")]),
      );

      let read: Promise<void>;
      act(() => {
        read = result.current.refreshKit("A0");
      });
      await act(async () => {
        await result.current.refreshAllKitsAndSamples();
      });
      await act(async () => {
        kitRead.resolve(ok(kitWith("A0", "stale.wav")));
        await read;
      });

      expect(voice1(result, "A0")).toBe("fresh.wav");
    });

    it("drops an older full load that arrives after a newer one", async () => {
      const { result } = await renderLoaded();
      const older = deferred<KitsResult>();
      vi.mocked(window.electronAPI.getKits)
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce(ok([kitWith("B0", "newer.wav")]));

      let olderLoad: Promise<void>;
      act(() => {
        olderLoad = result.current.refreshAllKitsAndSamples();
      });
      await act(async () => {
        await result.current.refreshAllKitsAndSamples();
      });
      await act(async () => {
        older.resolve(ok([kitWith("A0", "older.wav")]));
        await olderLoad;
      });

      expect(result.current.kits.map((kit) => kit.name)).toEqual(["B0"]);
    });

    it("[UC-36] keeps what's shown and says so when the kit can't be read", async () => {
      const onMessage = vi.fn();
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
      const { result } = rendered;
      const kitsShown = result.current.kits;
      const samplesShown = result.current.allKitSamples;
      vi.mocked(window.electronAPI.getKit).mockResolvedValue({
        error: "database is locked",
        success: false,
      });

      await act(async () => {
        await result.current.refreshKit("A0");
      });

      expect(result.current.kits).toBe(kitsShown);
      expect(result.current.allKitSamples).toBe(samplesShown);
      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't load the samples for kit A0. Try reopening it.",
        "error",
      );
    });

    // Approved on #452: Scan all, a write, and creating, duplicating or
    // deleting a kit reload every kit; if that fails, the kits stay
    describe("[UC-07] a full reload that fails", () => {
      it.each([
        [
          "says it failed",
          () =>
            vi.mocked(window.electronAPI.getKits).mockResolvedValue({
              error: "database is locked",
              success: false,
            }),
        ],
        [
          "throws",
          () =>
            vi
              .mocked(window.electronAPI.getKits)
              .mockRejectedValue(new Error("IPC closed")),
        ],
      ])("keeps the kits on screen when the read %s", async (_, fail) => {
        const { result } = await renderLoaded();
        const kitsShown = result.current.kits;
        const samplesShown = result.current.allKitSamples;
        fail();

        await act(async () => {
          await result.current.refreshAllKitsAndSamples();
        });

        expect(result.current.kits).toBe(kitsShown);
        expect(result.current.allKitSamples).toBe(samplesShown);
        expect(result.current.sampleCounts.A0).toEqual([1, 1, 0, 0]);
      });

      it("still lets a later reload show the new kits", async () => {
        const { result } = await renderLoaded();
        vi.mocked(window.electronAPI.getKits).mockResolvedValueOnce({
          error: "database is locked",
          success: false,
        });
        await act(async () => {
          await result.current.refreshAllKitsAndSamples();
        });
        vi.mocked(window.electronAPI.getKits).mockResolvedValueOnce(
          ok([kitWith("B0", "new.wav")]),
        );

        await act(async () => {
          await result.current.refreshAllKitsAndSamples();
        });

        expect(result.current.kits.map((kit) => kit.name)).toEqual(["B0"]);
      });

      it("empties the list when a store loads and can't be read: the kits shown may be another store's", async () => {
        const { rerender, result } = renderHook(
          ({ path }) =>
            useKitDataManager({
              isInitialized: true,
              isLocalStoreReady: true,
              localStorePath: path,
            }),
          { initialProps: { path: "/store/one" } },
        );
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(result.current.kits).toHaveLength(2);
        vi.mocked(window.electronAPI.getKits).mockResolvedValue({
          error: "database is locked",
          success: false,
        });

        rerender({ path: "/store/two" });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.kits).toEqual([]);
        expect(result.current.allKitSamples).toEqual({});
      });
    });

    it("treats a kit that's no longer there as unreadable", async () => {
      const { result } = await renderLoaded();
      const kitsShown = result.current.kits;
      // Main answers a kit it can't find with no kit
      vi.mocked(window.electronAPI.getKit).mockResolvedValue({ success: true });

      await act(async () => {
        await result.current.refreshKit("A0");
      });

      expect(result.current.kits).toBe(kitsShown);
    });
  });
});
