import { useCallback, useSyncExternalStore } from "react";

import type { PlayOptions } from "../../kitTypes";

/** One slot's playback, as its waveform and play button read it */
export interface SlotPlayback {
  /** Region, start and stop times for the next or current play */
  options?: PlayOptions;
  /** The slot's waveform reports it's sounding */
  playing: boolean;
  /** Counts plays; each increment plays the slot */
  playTrigger: number;
  /** Counts stops (a choke or the Stop button); each increment stops it */
  stopTrigger: number;
  /** The volume the sequencer last played it at (0-100), if any */
  volume?: number;
}

/**
 * The kit editor's playback state per slot, keyed by `slotKey` ("voice:slot",
 * RE-45). It lives outside React state, so a trigger re-renders only the
 * slots whose playback changed, and not the editor, its 48 slots and the
 * sequencer (#482). The `syncProgressStore` pattern, with a listener set
 * per slot.
 */
export interface SlotPlaybackStore {
  /** The slot's playback; the same object until it changes */
  get: (key: string) => SlotPlayback;
  subscribe: (key: string, listener: () => void) => () => void;
  /**
   * Change a slot's playback. Its listeners hear only of a change: an
   * update that leaves every field as it was notifies no one.
   */
  update: (key: string, change: (slot: SlotPlayback) => SlotPlayback) => void;
}

/** A slot nothing has played: what every slot reads until it's triggered */
export const IDLE_SLOT: SlotPlayback = Object.freeze({
  playing: false,
  playTrigger: 0,
  stopTrigger: 0,
});

export function createSlotPlaybackStore(): SlotPlaybackStore {
  const slots = new Map<string, SlotPlayback>();
  const listeners = new Map<string, Set<() => void>>();

  return {
    get: (key) => slots.get(key) ?? IDLE_SLOT,
    subscribe: (key, listener) => {
      let keyListeners = listeners.get(key);
      if (!keyListeners) {
        keyListeners = new Set();
        listeners.set(key, keyListeners);
      }
      keyListeners.add(listener);
      return () => {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) listeners.delete(key);
      };
    },
    update: (key, change) => {
      const prev = slots.get(key) ?? IDLE_SLOT;
      const next = change(prev);
      if (sameSlot(prev, next)) return;
      slots.set(key, next);
      listeners.get(key)?.forEach((listener) => listener());
    },
  };
}

/** A slot's playback, re-rendering the caller only when that slot's changes */
export function useSlotPlayback(
  store: SlotPlaybackStore,
  key: string,
): SlotPlayback {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key],
  );
  const getSnapshot = useCallback(() => store.get(key), [store, key]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

function sameSlot(a: SlotPlayback, b: SlotPlayback): boolean {
  return (
    a.options === b.options &&
    a.playing === b.playing &&
    a.playTrigger === b.playTrigger &&
    a.stopTrigger === b.stopTrigger &&
    a.volume === b.volume
  );
}
