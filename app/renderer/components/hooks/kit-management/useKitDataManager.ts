import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";
import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";

import { compareKitSlots } from "@romper/shared/kitUtilsShared";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { samplesFailedMessage } from "../../../utils/kitLoadMessages";
import { groupDbSamplesByVoice } from "../../../utils/sampleGroupingUtils";

interface UseKitDataManagerProps {
  isInitialized: boolean;
  /**
   * Whether the local store's status says it is there and valid. Kits load
   * only then: a saved store that is missing at launch has no database to
   * read (#553).
   */
  isLocalStoreReady: boolean;
  localStorePath: null | string;
  /** Shows a message to the user, e.g. when a kit's samples can't be loaded */
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

interface UseKitDataManagerReturn {
  allKitSamples: { [kit: string]: VoiceSamples };
  getKitByName: (kitName: string) => KitWithRelations | undefined;
  /**
   * The kits. A kit whose samples couldn't be loaded, with none loaded
   * before to show, is unavailable: it's listed as not editable (#605).
   */
  kits: KitWithRelations[];
  /** Loads a kit's samples on opening it, if none loaded or the last load failed (#605) */
  loadKitSamplesOnOpen: (kitName: string) => Promise<void>;
  loadKitsData: (scrollToKit?: string) => Promise<void>;
  markKitModified: (kitName: string) => void;
  refreshAllKitsAndSamples: () => Promise<void>;
  refreshSingleKitMetadata: (kitName: string) => Promise<void>;
  reloadCurrentKitSamples: (kitName: string) => Promise<void>;
  sampleCounts: Record<string, [number, number, number, number]>;
  toggleKitEditable: (kitName: string) => Promise<void>;
  toggleKitFavorite: (
    kitName: string,
  ) => Promise<DbResult<{ isFavorite: boolean }>>;
  updateKit: (kitName: string, updates: Partial<KitWithRelations>) => void;
  updateKitAlias: (kitName: string, alias: string) => Promise<void>;
}

const NO_KITS: ReadonlySet<string> = new Set();

/**
 * Custom hook for managing kit and sample data loading
 * Handles all database operations for kits and samples
 */
export function useKitDataManager({
  isInitialized,
  isLocalStoreReady,
  localStorePath,
  onMessage,
}: UseKitDataManagerProps): UseKitDataManagerReturn {
  const [dbKits, setDbKits] = useState<KitWithRelations[]>([]);
  const [allKitSamples, setAllKitSamples] = useState<{
    [kit: string]: VoiceSamples;
  }>({});

  // Kits whose last sample load failed (#605). A full load replaces every
  // kit's samples, so it clears them.
  const [failedKits, setFailedKits] = useState<ReadonlySet<string>>(NO_KITS);

  // Read through refs so loadKitSamplesOnOpen stays stable
  const dbKitsRef = useRef(dbKits);
  const allKitSamplesRef = useRef(allKitSamples);
  const failedKitsRef = useRef(failedKits);
  useEffect(() => {
    dbKitsRef.current = dbKits;
    allKitSamplesRef.current = allKitSamples;
    failedKitsRef.current = failedKits;
  }, [dbKits, allKitSamples, failedKits]);
  const clearFailedKits = useCallback(() => setFailedKits(NO_KITS), []);

  // Read through a ref so the reload callbacks stay stable
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // getKits() already returns each kit's samples (batched in the db layer);
  // group them per voice here instead of re-fetching kit-by-kit over IPC —
  // the per-kit loop was an N+1 that serialized startup on IPC round trips.
  // A kit that came without its samples gets no entry, rather than four
  // empty voices, so opening it loads them (#605).
  const groupLoadedKitSamples = useCallback(
    (loadedKits: KitWithRelations[]) => {
      const samples: { [kit: string]: VoiceSamples } = {};
      for (const kit of loadedKits) {
        if (kit.samples) samples[kit.name] = groupDbSamplesByVoice(kit.samples);
      }
      return samples;
    },
    [],
  );

  // Loads one kit's samples; null if they couldn't be loaded. An empty
  // result here would show a full kit as empty (#605).
  const loadKitSamples = useCallback(
    async (kit: string): Promise<null | VoiceSamples> => {
      try {
        const samplesResult =
          await globalThis.electronAPI?.getAllSamplesForKit?.(kit);

        if (samplesResult?.success && samplesResult.data) {
          return groupDbSamplesByVoice(samplesResult.data);
        }
        console.error(
          `Failed to load samples for kit ${kit}:`,
          samplesResult?.error,
        );
      } catch (error) {
        console.error(`Error loading samples for kit ${kit}:`, error);
      }
      return null;
    },
    [],
  );

  // Main function to load all kits and their data
  const loadKitsData = useCallback(
    async (scrollToKit?: string) => {
      if (!isInitialized || !localStorePath || !isLocalStoreReady) {
        return;
      }
      console.info("[useKitDataManager] Loading kits from", localStorePath);

      // Load kits from database — the result includes bank relationships
      // and every kit's samples, so one IPC call covers everything
      let loadedKits: KitWithRelations[] = [];
      try {
        const kitsResult = await globalThis.electronAPI?.getKits?.();
        if (kitsResult?.success && kitsResult.data) {
          const kitsWithBanks = kitsResult.data;
          setDbKits(kitsWithBanks);
          loadedKits = kitsWithBanks;
        } else {
          console.error(
            "Failed to load kits from database:",
            kitsResult?.error,
          );
          setDbKits([]);
          loadedKits = [];
        }
      } catch (error) {
        console.error("Error loading kits from database:", error);
        setDbKits([]);
        loadedKits = [];
      }

      setAllKitSamples(groupLoadedKitSamples(loadedKits));
      clearFailedKits();

      // If a specific kit should be scrolled to, do it after data loads
      if (scrollToKit) {
        setTimeout(() => {
          // Use the loaded kits data instead of the stale kits state
          const sortedKitNames = loadedKits
            .map((k) => k.name)
            .sort(compareKitSlots);
          const kitIndex = sortedKitNames.indexOf(scrollToKit);

          if (kitIndex !== -1) {
            const kitEl = document.querySelector(`[data-kit='${scrollToKit}']`);
            if (kitEl) {
              kitEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }, 100); // Small delay to ensure DOM is updated
      }
    },
    [
      isInitialized,
      isLocalStoreReady,
      localStorePath,
      groupLoadedKitSamples,
      clearFailedKits,
    ],
  );

  // Reload one kit's samples. If they can't be loaded, the samples already
  // shown stay; a kit with none to show becomes unavailable (#605).
  const reloadCurrentKitSamples = useCallback(
    async (kitName: string) => {
      const voices = await loadKitSamples(kitName);
      if (voices) {
        setAllKitSamples((prev) => ({ ...prev, [kitName]: voices }));
        setFailedKits((prev) => {
          if (!prev.has(kitName)) return prev;
          const next = new Set(prev);
          next.delete(kitName);
          return next;
        });
        return;
      }
      setFailedKits((prev) =>
        prev.has(kitName) ? prev : new Set(prev).add(kitName),
      );
      onMessageRef.current?.(samplesFailedMessage(kitName), "error");
    },
    [loadKitSamples],
  );

  // Opening a kit loads its samples if none are loaded yet, or if the last
  // load failed, so reopening tries again, as the message says (#605)
  const loadKitSamplesOnOpen = useCallback(
    async (kitName: string) => {
      const listed = dbKitsRef.current.some((kit) => kit.name === kitName);
      const loaded = allKitSamplesRef.current[kitName] !== undefined;
      if (listed && (!loaded || failedKitsRef.current.has(kitName))) {
        await reloadCurrentKitSamples(kitName);
      }
    },
    [reloadCurrentKitSamples],
  );

  // Kits whose samples couldn't be loaded and that have none to show. They
  // show as not editable, the way the editor shows a locked kit, so nothing
  // is dropped into slots that may be full in the library (#605).
  const unavailableKits = useMemo(() => {
    const unavailable = new Set<string>();
    for (const kitName of failedKits) {
      if (allKitSamples[kitName] === undefined) unavailable.add(kitName);
    }
    return unavailable;
  }, [failedKits, allKitSamples]);
  const kits = useMemo(
    () =>
      unavailableKits.size === 0
        ? dbKits
        : dbKits.map((kit) =>
            unavailableKits.has(kit.name) && kit.editable
              ? { ...kit, editable: false }
              : kit,
          ),
    [dbKits, unavailableKits],
  );

  // Refresh metadata for a single kit (voice aliases, etc.) without reloading all samples
  const refreshSingleKitMetadata = useCallback(async (kitName: string) => {
    try {
      const kitResult = await globalThis.electronAPI?.getKit?.(kitName);
      if (kitResult?.success && kitResult.data) {
        const updatedKit = kitResult.data;
        setDbKits((prevKits) =>
          prevKits.map((kit) => (kit.name === kitName ? updatedKit : kit)),
        );
      }
    } catch (error) {
      console.error(`Error refreshing kit metadata for ${kitName}:`, error);
    }
  }, []);

  // Helper function to load all kits and samples from database
  const refreshAllKitsAndSamples = useCallback(async () => {
    try {
      const kitsResult = await globalThis.electronAPI?.getKits?.();
      if (kitsResult?.success && kitsResult.data) {
        const kitsWithBanks = kitsResult.data;
        setDbKits(kitsWithBanks);
        setAllKitSamples(groupLoadedKitSamples(kitsWithBanks));
      } else {
        console.error("Failed to load kits from database:", kitsResult?.error);
        setDbKits([]);
        setAllKitSamples({});
      }
    } catch (error) {
      console.error("Error loading data from database:", error);
      setDbKits([]);
      setAllKitSamples({});
    }
    clearFailedKits();
  }, [groupLoadedKitSamples, clearFailedKits]);

  // Get a specific kit by name from the cached data
  const getKitByName = useCallback(
    (kitName: string): KitWithRelations | undefined => {
      return kits.find((kit) => kit.name === kitName);
    },
    [kits],
  );

  // Update kit data in local state (optimistic update)
  const updateKit = useCallback(
    (kitName: string, updates: Partial<KitWithRelations>) => {
      setDbKits((prevKits) =>
        prevKits.map((kit) =>
          kit.name === kitName ? { ...kit, ...updates } : kit,
        ),
      );
    },
    [],
  );

  // Show a kit as modified since the last write after an edit main has
  // already flagged (RE-35). Leaves state alone when it's already flagged,
  // so a gain knob turned step by step re-renders once.
  const markKitModified = useCallback((kitName: string) => {
    setDbKits((prevKits) =>
      prevKits.some((kit) => kit.name === kitName && !kit.modified_since_sync)
        ? prevKits.map((kit) =>
            kit.name === kitName ? { ...kit, modified_since_sync: true } : kit,
          )
        : prevKits,
    );
  }, []);

  // Toggle kit favorite status
  const toggleKitFavorite = useCallback(
    async (kitName: string): Promise<DbResult<{ isFavorite: boolean }>> => {
      try {
        const result =
          await globalThis.electronAPI?.toggleKitFavorite?.(kitName);
        if (result?.success) {
          // Update local state immediately for optimistic UI update
          const newFavoriteState = result.data?.isFavorite ?? false;
          updateKit(kitName, { is_favorite: newFavoriteState });
          return { data: { isFavorite: newFavoriteState }, success: true };
        }
        return {
          error: result?.error ?? "Toggle favorite API not available",
          success: false,
        };
      } catch (error) {
        console.error("Error toggling kit favorite:", error);
        return {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
    [updateKit],
  );

  // Helper function to update kit via API and sync local state
  const updateKitViaAPI = useCallback(
    async (
      kitName: string,
      updates: {
        alias?: string;
        editable?: boolean;
      },
      errorContext: string,
    ) => {
      if (!globalThis.electronAPI?.updateKit) {
        throw new Error("Update kit API not available");
      }

      try {
        const result = await globalThis.electronAPI.updateKit(kitName, updates);
        if (result.success) {
          // Update local state with properly typed updates
          const stateUpdates: Partial<KitWithRelations> = {};
          if (updates.alias !== undefined) stateUpdates.alias = updates.alias;
          if (updates.editable !== undefined)
            stateUpdates.editable = updates.editable;
          updateKit(kitName, stateUpdates);
        } else {
          throw new Error(result.error || `Failed to ${errorContext}`);
        }
      } catch (error) {
        console.error(`Error ${errorContext}:`, error);
        throw error;
      }
    },
    [updateKit],
  );

  // Update kit alias
  const updateKitAlias = useCallback(
    async (kitName: string, alias: string) => {
      await updateKitViaAPI(kitName, { alias }, "update kit alias");
    },
    [updateKitViaAPI],
  );

  // Toggle kit editable mode
  const toggleKitEditable = useCallback(
    async (kitName: string) => {
      // An unavailable kit stays locked until its samples load (#605)
      if (unavailableKits.has(kitName)) {
        onMessageRef.current?.(samplesFailedMessage(kitName), "error");
        return;
      }
      const kit = getKitByName(kitName);
      if (!kit) {
        throw new Error(`Kit ${kitName} not found`);
      }

      const newEditableState = !kit.editable;
      await updateKitViaAPI(
        kitName,
        { editable: newEditableState },
        "toggle editable mode",
      );
    },
    [getKitByName, unavailableKits, updateKitViaAPI],
  );

  // Calculate sample counts for all kits
  const sampleCounts = React.useMemo(() => {
    const counts: Record<string, [number, number, number, number]> = {};
    for (const kit of kits) {
      const kitName = kit.name;
      const voices = allKitSamples[kitName] ?? { 1: [], 2: [], 3: [], 4: [] };
      const kitCounts = [1, 2, 3, 4].map((v) => voices[v]?.length ?? 0) as [
        number,
        number,
        number,
        number,
      ];
      counts[kitName] = kitCounts;
    }

    return counts;
  }, [kits, allKitSamples]);

  // Load all kits and samples on mount and when dependencies change
  useEffect(() => {
    void loadKitsData();
  }, [loadKitsData]);

  return {
    allKitSamples,
    getKitByName,
    kits,
    loadKitSamplesOnOpen,
    loadKitsData,
    markKitModified,
    refreshAllKitsAndSamples,
    refreshSingleKitMetadata,
    reloadCurrentKitSamples,
    sampleCounts,
    toggleKitEditable,
    toggleKitFavorite,
    updateKit,
    updateKitAlias,
  };
}
