import { useSyncExternalStore } from "react";

import type { SyncProgressState } from "../../dialogs/SyncUpdateDialog.types";

export interface SyncProgressStore {
  get: () => null | SyncProgressState;
  set: (
    next:
      | ((prev: null | SyncProgressState) => null | SyncProgressState)
      | null
      | SyncProgressState,
  ) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Holds write progress outside React state, so a progress update re-renders
 * only the components that read it (the write panel, via useSyncProgress)
 * and not the kit browser that owns the sync hooks. Re-rendering the whole
 * kit grid on every update made the panel fall behind on large stores
 * (RE-61).
 */
export function createSyncProgressStore(): SyncProgressStore {
  let progress: null | SyncProgressState = null;
  const listeners = new Set<() => void>();

  return {
    get: () => progress,
    set: (next) => {
      const value = typeof next === "function" ? next(progress) : next;
      if (value === progress) return;
      progress = value;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useSyncProgress(
  store: SyncProgressStore,
): null | SyncProgressState {
  return useSyncExternalStore(store.subscribe, store.get);
}
