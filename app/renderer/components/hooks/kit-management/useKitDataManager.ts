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
  kits: KitWithRelations[];
  loadKitsData: (scrollToKit?: string) => Promise<void>;
  refreshAllKitsAndSamples: () => Promise<void>;
  refreshKitsOnly: () => Promise<void>;
  reloadCurrentKitSamples: (kitName: string) => Promise<void>;
  sampleCounts: Record<string, [number, number, number, number]>;
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
    []
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
            kitsResult?.error
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
          `[useKitDataManager] Loading samples for ${kitNames.length} kits...`
        );
        for (const kit of kitNames) {
          samples[kit] = await loadKitSamples(kit);
        }
        console.debug(
          `[useKitDataManager] Loaded samples for ${kitNames.length} kits`
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
            (name) => name === scrollToKit
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
    [isInitialized, localStorePath, needsLocalStoreSetup, loadKitSamples]
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
    [loadKitSamples]
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
            `[useKitDataManager] Refreshing samples for ${kitNames.length} kits...`
          );
          for (const kit of kitNames) {
            samples[kit] = await loadKitSamples(kit);
          }
          console.debug(
            `[useKitDataManager] Refreshed samples for ${kitNames.length} kits`
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

  // Helper function to refresh only kit metadata (for favorites, etc.)
  const refreshKitsOnly = useCallback(async () => {
    try {
      const kitsResult = await window.electronAPI?.getKitsMetadata?.();
      if (kitsResult?.success && kitsResult.data) {
        const kitsWithBanks = kitsResult.data as unknown as KitWithRelations[];
        setKits(kitsWithBanks);
      } else {
        console.error(
          "Failed to load kits metadata from database:",
          kitsResult?.error
        );
      }
    } catch (error) {
      console.error("Error loading kits metadata from database:", error);
    }
  }, []);

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
    kits,
    loadKitsData,
    refreshAllKitsAndSamples,
    refreshKitsOnly,
    reloadCurrentKitSamples,
    sampleCounts,
  };
}
