import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";
import type {
  DbResult,
  KitEdit,
  KitWithRelations,
} from "@romper/shared/db/schema";

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
import { useTimeouts } from "../shared/useTimeouts";

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
  /** Adds a kit just created or copied, as main returned it (#452) */
  addKit: (kit: KitWithRelations) => void;
  allKitSamples: { [kit: string]: VoiceSamples };
  /**
   * Shows the kit an edit to its own fields or voices returned, without
   * reading it again (#452)
   */
  applyKitEdit: (kitName: string, edited: KitEdit) => void;
  /**
   * Shows that the store check found a kit quarantined, or no longer, in
   * place of reading the kit (#812). Nothing redraws if it already shows it.
   */
  applyQuarantine: (kitName: string, quarantined: boolean) => void;
  /** Shows the kit a sample edit returned, samples and all (#452) */
  applyReadKit: (kitName: string, kit: KitWithRelations) => void;
  getKitByName: (kitName: string) => KitWithRelations | undefined;
  /**
   * The kits. A kit whose samples couldn't be loaded, with none loaded
   * before to show, is unavailable: it's listed as not editable (#605).
   */
  kits: KitWithRelations[];
  /** Loads a kit's samples on opening it, if none loaded or the last load failed (#605) */
  loadKitSamplesOnOpen: (kitName: string) => Promise<void>;
  loadKitsData: (scrollToKit?: string) => Promise<void>;
  /**
   * Shows a sample gain main has saved, and the kit as modified since the
   * last write (main flags it with the gain, RE-35), on the loaded kit
   */
  markGainSaved: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    gainDb: number,
  ) => void;
  /**
   * Reloads every kit. For changes to the list itself (scan, write, setup,
   * kits created, copied or deleted); an edit to one kit uses refreshKit.
   * If the kits can't be read, the ones on screen stay.
   */
  refreshAllKitsAndSamples: () => Promise<void>;
  /**
   * Reloads one kit, with its voices and samples, in one call (#452). If
   * it can't be read, what's shown stays and the user is told (#605).
   */
  refreshKit: (kitName: string) => Promise<void>;
  /** Takes a deleted kit off the list without reading every kit (#452) */
  removeKit: (kitName: string) => void;
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

  // The scroll after a load is cleared if the hook unmounts first
  const timeouts = useTimeouts();

  // Kit reads are numbered as they're sent, so a slower, older response
  // can't put older data back over newer (#452). kitReads holds the number
  // of the read each kit on screen came from; listRead, the full load the
  // list came from.
  const lastRead = useRef(0);
  const kitReads = useRef(new Map<string, number>());
  const listRead = useRef(0);
  // Kits deleted, with the number of the delete, until a read sent after
  // it shows they're gone
  const removedKits = useRef(new Map<string, number>());
  // Changes main has saved that the renderer shows without a reload (a
  // kit an edit returned, a gain, BPM, favorite, name or editable flag),
  // numbered like reads. A read sent before one can't show it, so it's
  // applied over that read; a read sent after it supersedes it. Each is
  // keyed by what it changes, so a later change to the same thing replaces
  // it and the list stays short between reads.
  const savedChanges = useRef(
    new Map<
      string,
      {
        apply: (kit: KitWithRelations) => KitWithRelations;
        key: string;
        read: number;
      }[]
    >(),
  );

  // A kit as read by read number `read`, with the saved changes it can't
  // show. Forgets the changes it already shows.
  const withSavedChanges = useCallback(
    (kit: KitWithRelations, read: number) => {
      const changes = savedChanges.current.get(kit.name);
      if (!changes) return kit;
      const later = changes.filter((change) => change.read > read);
      if (later.length === 0) savedChanges.current.delete(kit.name);
      else savedChanges.current.set(kit.name, later);
      return later.reduce((shown, change) => change.apply(shown), kit);
    },
    [],
  );

  // Show a change main has saved on the loaded kit, and keep it over any
  // read sent before it. It replaces the earlier changes `replaces`
  // matches by key (by default, its own key). `apply` returns the kit
  // itself when it changes nothing, so nothing re-renders.
  const applySavedChange = useCallback(
    (
      kitName: string,
      key: string,
      apply: (kit: KitWithRelations) => KitWithRelations,
      replaces: (earlier: string) => boolean = (earlier) => earlier === key,
    ) => {
      const read = ++lastRead.current;
      const changes = (savedChanges.current.get(kitName) ?? []).filter(
        (change) => !replaces(change.key),
      );
      savedChanges.current.set(kitName, [...changes, { apply, key, read }]);
      setDbKits((prevKits) => {
        let changed = false;
        const next = prevKits.map((kit) => {
          if (kit.name !== kitName) return kit;
          const updated = apply(kit);
          changed = updated !== kit;
          return updated;
        });
        return changed ? next : prevKits;
      });
    },
    [],
  );

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

  // Show a full load's kits: the list it read, with any kit a later
  // single-kit read already refreshed kept as that read showed it
  const applyAllKits = useCallback(
    (read: number, readKits: KitWithRelations[]) => {
      listRead.current = read;
      // A kit deleted after this read was sent stays deleted
      const loadedKits = readKits
        .filter((kit) => (removedKits.current.get(kit.name) ?? 0) <= read)
        .map((kit) => withSavedChanges(kit, read));
      for (const [name, removed] of removedKits.current) {
        if (removed < read) removedKits.current.delete(name);
      }
      const loadedNames = new Set(loadedKits.map((kit) => kit.name));
      const newer = new Set<string>();
      for (const kit of loadedKits) {
        if ((kitReads.current.get(kit.name) ?? 0) > read) newer.add(kit.name);
        else kitReads.current.set(kit.name, read);
      }
      // A kit created after this read was sent, so it isn't in it, stays
      const added = [...kitReads.current]
        .filter(([name, kitRead]) => kitRead > read && !loadedNames.has(name))
        .map(([name]) => name);
      if (newer.size === 0 && added.length === 0) {
        setDbKits(loadedKits);
        setAllKitSamples(groupLoadedKitSamples(loadedKits));
      } else {
        setDbKits((prev) => {
          const shown = new Map(prev.map((kit) => [kit.name, kit]));
          const next = loadedKits.map((kit) =>
            newer.has(kit.name) ? (shown.get(kit.name) ?? kit) : kit,
          );
          for (const name of added) {
            const kit = shown.get(name);
            if (kit) next.push(kit);
          }
          return next;
        });
        setAllKitSamples((prev) => {
          const next = groupLoadedKitSamples(loadedKits);
          for (const name of [...newer, ...added]) {
            if (prev[name]) next[name] = prev[name];
          }
          return next;
        });
      }
      clearFailedKits();
      return loadedKits;
    },
    [groupLoadedKitSamples, clearFailedKits, withSavedChanges],
  );

  // Reads every kit. Resolves to the kits loaded, or null when a newer full
  // load has already landed. A kit read sent after this one keeps what it
  // showed. If the kits can't be read, the list empties, or with
  // keepOnFailure the kits on screen stay and this resolves to null (#452).
  const readAllKits = useCallback(
    async ({
      keepOnFailure,
    }: {
      keepOnFailure: boolean;
    }): Promise<KitWithRelations[] | null> => {
      const read = ++lastRead.current;
      let loadedKits: KitWithRelations[] | null = null;
      try {
        const kitsResult = await globalThis.electronAPI?.getKits?.();
        if (kitsResult?.success && kitsResult.data) {
          loadedKits = kitsResult.data;
        } else {
          console.error(
            "Failed to load kits from database:",
            kitsResult?.error,
          );
        }
      } catch (error) {
        console.error("Error loading kits from database:", error);
      }
      if (read < listRead.current) return null;
      if (!loadedKits && keepOnFailure) return null;
      return applyAllKits(read, loadedKits ?? []);
    },
    [applyAllKits],
  );

  // Main function to load all kits and their data
  const loadKitsData = useCallback(
    async (scrollToKit?: string) => {
      if (!isInitialized || !localStorePath || !isLocalStoreReady) {
        return;
      }
      console.info("[useKitDataManager] Loading kits from", localStorePath);

      // Load kits from database — the result includes bank relationships
      // and every kit's samples, so one IPC call covers everything. A store
      // that can't be read shows no kits: the ones on screen may be another
      // store's.
      const loadedKits = await readAllKits({ keepOnFailure: false });
      if (!loadedKits) return;

      // If a specific kit should be scrolled to, do it after data loads
      if (scrollToKit) {
        timeouts.set(() => {
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
    [isInitialized, isLocalStoreReady, localStorePath, readAllKits, timeouts],
  );

  // Show a kit read by read number `read`, unless what's on screen came
  // from a newer read
  const showReadKit = useCallback(
    (kitName: string, kit: KitWithRelations, read: number) => {
      if (
        read < listRead.current ||
        read < (kitReads.current.get(kitName) ?? 0) ||
        read < (removedKits.current.get(kitName) ?? 0)
      ) {
        return; // Newer data is already on screen, or the kit is gone
      }
      kitReads.current.set(kitName, read);

      const loaded = withSavedChanges(kit, read);
      const voices = groupDbSamplesByVoice(loaded.samples ?? []);
      setDbKits((prevKits) =>
        prevKits.map((shown) => (shown.name === kitName ? loaded : shown)),
      );
      setAllKitSamples((prev) => ({ ...prev, [kitName]: voices }));
      setFailedKits((prev) => {
        if (!prev.has(kitName)) return prev;
        const next = new Set(prev);
        next.delete(kitName);
        return next;
      });
    },
    [withSavedChanges],
  );

  // Reload one kit (its row, voices and samples) with one get-kit call,
  // instead of every kit (#452). A response older than what the kit shows
  // is dropped. If the kit can't be read, what's shown stays.
  const readKit = useCallback(
    async (kitName: string) => {
      const read = ++lastRead.current;
      let kit: KitWithRelations | null = null;
      try {
        const kitResult = await globalThis.electronAPI?.getKit?.(kitName);
        if (kitResult?.success && kitResult.data?.samples) {
          kit = kitResult.data;
        } else {
          console.error(`Failed to load kit ${kitName}:`, kitResult?.error);
        }
      } catch (error) {
        console.error(`Error loading kit ${kitName}:`, error);
      }
      if (!kit?.samples) return false;
      showReadKit(kitName, kit, read);
      return true;
    },
    [showReadKit],
  );

  // Show the kit a sample edit returned, samples and all, as a read made
  // when it arrived (#452)
  const applyReadKit = useCallback(
    (kitName: string, kit: KitWithRelations) => {
      if (kit.name !== kitName || !kit.samples) return;
      showReadKit(kitName, kit, ++lastRead.current);
    },
    [showReadKit],
  );

  // Show a kit that was just created or copied, as main returned it, in
  // place of reading every kit again (#452). It goes at the end, where a
  // full load lists it too: the list is in the order kits were added.
  const addKit = useCallback((kit: KitWithRelations) => {
    if (!kit.samples) return;
    const read = ++lastRead.current;
    removedKits.current.delete(kit.name);
    kitReads.current.set(kit.name, read);
    const voices = groupDbSamplesByVoice(kit.samples);
    setDbKits((prevKits) =>
      prevKits.some((shown) => shown.name === kit.name)
        ? prevKits.map((shown) => (shown.name === kit.name ? kit : shown))
        : [...prevKits, kit],
    );
    setAllKitSamples((prev) => ({ ...prev, [kit.name]: voices }));
  }, []);

  // Take a deleted kit off the list, in place of reading every kit again
  // (#452). A read sent before the delete doesn't bring it back.
  const removeKit = useCallback((kitName: string) => {
    removedKits.current.set(kitName, ++lastRead.current);
    kitReads.current.delete(kitName);
    savedChanges.current.delete(kitName);
    setDbKits((prevKits) =>
      prevKits.some((kit) => kit.name === kitName)
        ? prevKits.filter((kit) => kit.name !== kitName)
        : prevKits,
    );
    setAllKitSamples((prev) => {
      if (!(kitName in prev)) return prev;
      const next = { ...prev };
      delete next[kitName];
      return next;
    });
    setFailedKits((prev) => {
      if (!prev.has(kitName)) return prev;
      const next = new Set(prev);
      next.delete(kitName);
      return next;
    });
  }, []);

  // Reload one kit after any edit to it, on opening it without its samples,
  // and after an undo. If it can't be read, what's shown stays and the user
  // is told, whatever the edit was; a kit with no samples to show becomes
  // unavailable (#605, #452).
  const refreshKit = useCallback(
    async (kitName: string) => {
      if (await readKit(kitName)) return;
      setFailedKits((prev) =>
        prev.has(kitName) ? prev : new Set(prev).add(kitName),
      );
      onMessageRef.current?.(samplesFailedMessage(kitName), "error");
    },
    [readKit],
  );

  // Opening a kit loads its samples if none are loaded yet, or if the last
  // load failed, so reopening tries again, as the message says (#605)
  const loadKitSamplesOnOpen = useCallback(
    async (kitName: string) => {
      const listed = dbKitsRef.current.some((kit) => kit.name === kitName);
      const loaded = allKitSamplesRef.current[kitName] !== undefined;
      if (listed && (!loaded || failedKitsRef.current.has(kitName))) {
        await refreshKit(kitName);
      }
    },
    [refreshKit],
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

  // Reload every kit, after a change to the list itself. If they can't be
  // read, the kits on screen stay (approved on #452).
  const refreshAllKitsAndSamples = useCallback(async () => {
    await readAllKits({ keepOnFailure: true });
  }, [readAllKits]);

  // Get a specific kit by name from the cached data
  const getKitByName = useCallback(
    (kitName: string): KitWithRelations | undefined => {
      return kits.find((kit) => kit.name === kitName);
    },
    [kits],
  );

  // Show fields main has saved on the loaded kit, without a reload
  const updateKit = useCallback(
    (kitName: string, updates: Partial<KitWithRelations>) => {
      const fields = Object.keys(updates).sort((a, b) => a.localeCompare(b));
      applySavedChange(kitName, `kit:${fields.join(",")}`, (kit) => ({
        ...kit,
        ...updates,
      }));
    },
    [applySavedChange],
  );

  // Show a gain main has saved in the kit's sample row, and the kit as
  // modified since the last write, which main flagged with it (RE-35). The
  // kit's rows then stay what main holds, so the voice panels read the
  // gains from them instead of asking main again (#452). Leaves state alone
  // when both already show, so nothing re-renders.
  const markGainSaved = useCallback(
    (
      kitName: string,
      voiceNumber: number,
      slotNumber: number,
      gainDb: number,
    ) => {
      applySavedChange(kitName, `gain:${voiceNumber}:${slotNumber}`, (kit) => {
        const row = kit.samples?.find(
          (sample) =>
            sample.voice_number === voiceNumber &&
            sample.slot_number === slotNumber,
        );
        const gainChanged = row !== undefined && row.gain_db !== gainDb;
        if (!gainChanged && kit.modified_since_sync) return kit;
        return {
          ...kit,
          modified_since_sync: true,
          samples: gainChanged
            ? kit.samples?.map((sample) =>
                sample === row ? { ...sample, gain_db: gainDb } : sample,
              )
            : kit.samples,
        };
      });
    },
    [applySavedChange],
  );

  // Show what the store check found about a kit's files, as main saved it
  // (#812). The kit is only replaced if its flag differs, so a finding that
  // changes nothing the card shows redraws nothing (#462).
  const applyQuarantine = useCallback(
    (kitName: string, quarantined: boolean) => {
      applySavedChange(kitName, "quarantined", (kit) =>
        (kit.quarantined ?? false) === quarantined
          ? kit
          : { ...kit, quarantined },
      );
    },
    [applySavedChange],
  );

  // Show the kit an edit to its own fields or voices returned, in place of
  // reading it again (#452). It's everything about the kit but its
  // samples, so it replaces the kit-level changes saved before it.
  const applyKitEdit = useCallback(
    (kitName: string, edited: KitEdit) => {
      if (edited.name !== kitName) return;
      applySavedChange(
        kitName,
        "kit",
        (kit) => ({ ...kit, ...edited, samples: kit.samples }),
        (earlier) => earlier === "kit" || earlier.startsWith("kit:"),
      );
    },
    [applySavedChange],
  );

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
    addKit,
    allKitSamples,
    applyKitEdit,
    applyQuarantine,
    applyReadKit,
    getKitByName,
    kits,
    loadKitSamplesOnOpen,
    loadKitsData,
    markGainSaved,
    refreshAllKitsAndSamples,
    refreshKit,
    removeKit,
    sampleCounts,
    toggleKitEditable,
    toggleKitFavorite,
    updateKit,
    updateKitAlias,
  };
}
