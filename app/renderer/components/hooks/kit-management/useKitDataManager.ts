import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";
import type { KitWithRelations } from "@romper/shared/db/schema";

import { compareKitSlots } from "@romper/shared/kitUtilsShared";
import React, { useCallback, useEffect, useState } from "react";

import { groupDbSamplesByVoice } from "../../../utils/sampleGroupingUtils";

interface UseKitDataManagerProps {
  isInitialized: boolean;
  localStorePath: null | string;
  needsLocalStoreSetup: boolean;
}

interface UseKitDataManagerReturn {
  allKitSamples: { [kit: string]: VoiceSamples };
  getKitByName: (kitName: string) => KitWithRelations | undefined;
  kits: KitWithRelations[];
  loadKitsData: (scrollToKit?: string) => Promise<void>;
  refreshAllKitsAndSamples: () => Promise<void>;
  reloadCurrentKitSamples: (kitName: string) => Promise<void>;
  sampleCounts: Record<string, [number, number, number, number]>;
  toggleKitEditable: (kitName: string) => Promise<void>;
  toggleKitFavorite: (
    kitName: string,
  ) => Promise<{ isFavorite?: boolean; success: boolean }>;
  updateKit: (kitName: string, updates: Partial<KitWithRelations>) => void;
  updateKitAlias: (kitName: string, alias: string) => Promise<void>;
}

/**
 * Custom hook for managing kit and sample data loading
 * Handles all database operations for kits and samples
 */
export function useKitDataManager({
  isInitialized,
  localStorePath,
  needsLocalStoreSetup,
}: UseKitDataManagerProps): UseKitDataManagerReturn {
  const [kits, setKits] = useState<KitWithRelations[]>([]);
  const [allKitSamples, setAllKitSamples] = useState<{
    [kit: string]: VoiceSamples;
  }>({});

  // Helper function to load samples for a single kit
  const loadKitSamples = useCallback(
    async (kit: string): Promise<VoiceSamples> => {
      try {
        const samplesResult =
          await window.electronAPI?.getAllSamplesForKit?.(kit);

        if (samplesResult?.success && samplesResult.data) {
          const grouped = groupDbSamplesByVoice(samplesResult.data);
          return grouped;
        }
      } catch (error) {
        console.error(`Error loading samples for kit ${kit}:`, error);
      }

      return { 1: [], 2: [], 3: [], 4: [] };
    },
    [],
  );

  // Main function to load all kits and their data
  const loadKitsData = useCallback(
    async (scrollToKit?: string) => {
      if (!isInitialized || !localStorePath || needsLocalStoreSetup) {
        return;
      }
      console.info("[useKitDataManager] Loading kits from", localStorePath);

      // 1. Load kits from database (includes bank relationships)
      let kitNames: string[] = [];
      let loadedKits: KitWithRelations[] = [];
      try {
        const kitsResult = await window.electronAPI?.getKits?.();
        if (kitsResult?.success && kitsResult.data) {
          const kitsWithBanks =
            kitsResult.data as unknown as KitWithRelations[];
          setKits(kitsWithBanks);
          loadedKits = kitsWithBanks;
          kitNames = kitsWithBanks.map((kit: KitWithRelations) => kit.name);
        } else {
          console.error(
            "Failed to load kits from database:",
            kitsResult?.error,
          );
          setKits([]);
          loadedKits = [];
        }
      } catch (error) {
        console.error("Error loading kits from database:", error);
        setKits([]);
        loadedKits = [];
      }

      // 2. Load samples for each kit from database
      const samples: { [kit: string]: VoiceSamples } = {};
      if (kitNames.length > 0) {
        console.debug(
          `[useKitDataManager] Loading samples for ${kitNames.length} kits...`,
        );
        for (const kit of kitNames) {
          samples[kit] = await loadKitSamples(kit);
        }
        console.debug(
          `[useKitDataManager] Loaded samples for ${kitNames.length} kits`,
        );
      }
      setAllKitSamples(samples);

      // If a specific kit should be scrolled to, do it after data loads
      if (scrollToKit) {
        setTimeout(() => {
          // Use the loaded kits data instead of the stale kits state
          const sortedKitNames = loadedKits
            .map((k) => k.name)
            .sort(compareKitSlots);
          const kitIndex = sortedKitNames.findIndex(
            (name) => name === scrollToKit,
          );

          if (kitIndex !== -1) {
            const kitEl = document.querySelector(`[data-kit='${scrollToKit}']`);
            if (kitEl) {
              kitEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }, 100); // Small delay to ensure DOM is updated
      }
    },
    [isInitialized, localStorePath, needsLocalStoreSetup, loadKitSamples],
  );

  // Function to reload samples for a specific kit
  const reloadCurrentKitSamples = useCallback(
    async (kitName: string) => {
      try {
        const voices = await loadKitSamples(kitName);
        setAllKitSamples((prev) => ({
          ...prev,
          [kitName]: voices,
        }));
      } catch (error) {
        console.error(`Error reloading samples for kit ${kitName}:`, error);
      }
    },
    [loadKitSamples],
  );

  // Helper function to load all kits and samples from database
  const refreshAllKitsAndSamples = useCallback(async () => {
    try {
      const kitsResult = await window.electronAPI?.getKits?.();
      if (kitsResult?.success && kitsResult.data) {
        const kitsWithBanks = kitsResult.data as unknown as KitWithRelations[];
        setKits(kitsWithBanks);
        const kitNames = kitsWithBanks.map((kit: KitWithRelations) => kit.name);

        const samples: { [kit: string]: VoiceSamples } = {};
        if (kitNames.length > 0) {
          console.debug(
            `[useKitDataManager] Refreshing samples for ${kitNames.length} kits...`,
          );
          for (const kit of kitNames) {
            samples[kit] = await loadKitSamples(kit);
          }
          console.debug(
            `[useKitDataManager] Refreshed samples for ${kitNames.length} kits`,
          );
        }
        setAllKitSamples(samples);
      } else {
        console.error("Failed to load kits from database:", kitsResult?.error);
        setKits([]);
        setAllKitSamples({});
      }
    } catch (error) {
      console.error("Error loading data from database:", error);
      setKits([]);
      setAllKitSamples({});
    }
  }, [loadKitSamples]);

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
      setKits((prevKits) =>
        prevKits.map((kit) =>
          kit.name === kitName ? { ...kit, ...updates } : kit,
        ),
      );
    },
    [],
  );

  // Toggle kit favorite status
  const toggleKitFavorite = useCallback(
    async (kitName: string) => {
      try {
        const result = await window.electronAPI?.toggleKitFavorite?.(kitName);
        if (result?.success) {
          // Update local state immediately for optimistic UI update
          const newFavoriteState = result.data?.isFavorite ?? false;
          updateKit(kitName, { is_favorite: newFavoriteState });
          return { isFavorite: newFavoriteState, success: true };
        }
        return { success: false };
      } catch (error) {
        console.error("Error toggling kit favorite:", error);
        return { success: false };
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
      if (!window.electronAPI?.updateKit) {
        throw new Error("Update kit API not available");
      }

      try {
        const result = await window.electronAPI.updateKit(kitName, updates);
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
    [getKitByName, updateKitViaAPI],
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
    loadKitsData();
  }, [loadKitsData]);

  return {
    allKitSamples,
    getKitByName,
    kits,
    loadKitsData,
    refreshAllKitsAndSamples,
    reloadCurrentKitSamples,
    sampleCounts,
    toggleKitEditable,
    toggleKitFavorite,
    updateKit,
    updateKitAlias,
  };
}
