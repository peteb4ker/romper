import type { StoreCheckKitFinding } from "@romper/shared/electronApi";

import {
  type StoreCheckSummary,
  summarizeStoreCheck,
} from "@romper/shared/storeCheckWording";
import { useCallback, useSyncExternalStore } from "react";

/**
 * What main's store check has found, as the badge, the status bar item and
 * the "Library check" dialog read it (#824, stage 3 of
 * docs/developer/store-check.md). It lives outside React state, for two
 * reasons: the status bar is mounted by `main.tsx`, outside the kit view
 * that follows the check, and a push about one kit must redraw only that
 * kit's card, not the grid (#462). The `slotPlaybackStore` pattern, with a
 * listener set per kit.
 *
 * It also tells when a pass has found missing sample files it hadn't
 * before, so the one-time message appears once per new problem.
 */
export interface StoreCheckStore {
  /** Merge the kits a push carried; a kit with nothing found is dropped */
  apply: (kits: StoreCheckKitFinding[]) => void;
  /** Start following `storePath`: another store's findings are forgotten */
  begin: (storePath: null | string) => void;
  closeDialog: () => void;
  getDialogOpen: () => boolean;
  /** A kit's finding; the same object until it changes */
  getFinding: (kitName: string) => StoreCheckKitFinding | undefined;
  /** The notice's totals; the same object until a finding changes */
  getSummary: () => StoreCheckSummary;
  openDialog: () => void;
  /** Replace everything with the status main holds */
  replace: (kits: StoreCheckKitFinding[]) => void;
  /** Forget everything, including which problems were announced */
  reset: () => void;
  /** Hears of any change, for the notice */
  subscribe: (listener: () => void) => () => void;
  /** Hears of a change to one kit's finding, for its card */
  subscribeKit: (kitName: string, listener: () => void) => () => void;
  /**
   * How many kits have missing sample files this pass found that weren't
   * known before; asking again gives zero until another is found
   */
  takeNewMissing: () => number;
}

export function createStoreCheckStore(): StoreCheckStore {
  const findings = new Map<string, StoreCheckKitFinding>();
  const listeners = new Set<() => void>();
  const kitListeners = new Map<string, Set<() => void>>();
  /** Missing files already announced (or present when the store was opened), by kit */
  const known = new Map<string, number>();
  const unannounced = new Set<string>();
  let dialogOpen = false;
  let storePath: null | string = null;
  let summary: null | StoreCheckSummary = null;

  const notify = (kits: Iterable<string>) => {
    summary = null;
    for (const kit of kits) {
      kitListeners.get(kit)?.forEach((listener) => listener());
    }
    listeners.forEach((listener) => listener());
  };

  /** Show a kit's finding; true if that changed what is held */
  const set = (finding: StoreCheckKitFinding): boolean => {
    const before = findings.get(finding.kitName);
    if (isClean(finding)) {
      known.delete(finding.kitName);
      unannounced.delete(finding.kitName);
      return findings.delete(finding.kitName);
    }
    if (before && sameFinding(before, finding)) return false;
    findings.set(finding.kitName, finding);
    const announced = known.get(finding.kitName) ?? 0;
    if (finding.missing > announced) unannounced.add(finding.kitName);
    if (finding.missing === 0) unannounced.delete(finding.kitName);
    known.set(finding.kitName, finding.missing);
    return true;
  };

  const store: StoreCheckStore = {
    apply: (kits) => {
      const changed = kits.filter(set).map((kit) => kit.kitName);
      if (changed.length > 0) notify(changed);
    },
    begin: (next) => {
      if (next === storePath) return;
      storePath = next;
      store.reset();
    },
    closeDialog: () => {
      if (!dialogOpen) return;
      dialogOpen = false;
      notify([]);
    },
    getDialogOpen: () => dialogOpen,
    getFinding: (kitName) => findings.get(kitName),
    getSummary: () => (summary ??= summarizeStoreCheck(findings.values())),
    openDialog: () => {
      if (dialogOpen) return;
      dialogOpen = true;
      notify([]);
    },
    replace: (kits) => {
      const names = new Set(kits.map((kit) => kit.kitName));
      const gone = [...findings.keys()].filter((name) => !names.has(name));
      const changed = [
        ...gone.filter((name) => set(cleanFinding(name))),
        ...kits.filter(set).map((kit) => kit.kitName),
      ];
      if (changed.length > 0) notify(changed);
    },
    reset: () => {
      const names = [...findings.keys()];
      findings.clear();
      known.clear();
      unannounced.clear();
      dialogOpen = false;
      notify(names);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeKit: (kitName, listener) => {
      let forKit = kitListeners.get(kitName);
      if (!forKit) {
        forKit = new Set();
        kitListeners.set(kitName, forKit);
      }
      forKit.add(listener);
      return () => {
        forKit.delete(listener);
        if (forKit.size === 0) kitListeners.delete(kitName);
      };
    },
    takeNewMissing: () => {
      const count = unannounced.size;
      unannounced.clear();
      return count;
    },
  };
  return store;
}

/** The store the app follows: one check at a time */
export const storeCheckStore = createStoreCheckStore();

/** A kit's finding, redrawing the caller only when that kit's changes */
export function useKitStoreFinding(
  kitName: string,
  store: StoreCheckStore = storeCheckStore,
): StoreCheckKitFinding | undefined {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeKit(kitName, listener),
    [store, kitName],
  );
  const get = useCallback(() => store.getFinding(kitName), [store, kitName]);
  return useSyncExternalStore(subscribe, get);
}

/** Whether the "Library check" dialog is open */
export function useLibraryCheckDialogOpen(
  store: StoreCheckStore = storeCheckStore,
): boolean {
  return useSyncExternalStore(store.subscribe, store.getDialogOpen);
}

/** What the notice shows */
export function useStoreCheckSummary(
  store: StoreCheckStore = storeCheckStore,
): StoreCheckSummary {
  return useSyncExternalStore(store.subscribe, store.getSummary);
}

function cleanFinding(kitName: string): StoreCheckKitFinding {
  return {
    folderMissing: false,
    kitName,
    missing: 0,
    notConnected: [],
    notResponding: [],
    quarantined: false,
    unavailableVolumes: [],
    unreadable: 0,
    untracked: [],
  };
}

/** Nothing found: main sends a kit that is clean again with zero counts */
function isClean(finding: StoreCheckKitFinding): boolean {
  return (
    finding.missing === 0 &&
    finding.unreadable === 0 &&
    !finding.quarantined &&
    !finding.folderMissing &&
    finding.untracked.length === 0 &&
    finding.unavailableVolumes.length === 0 &&
    finding.notConnected.length === 0 &&
    finding.notResponding.length === 0
  );
}

function sameFinding(a: StoreCheckKitFinding, b: StoreCheckKitFinding) {
  return JSON.stringify(a) === JSON.stringify(b);
}
