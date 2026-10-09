import type { DbResult } from "@romper/shared/db/schema";

import React from "react";

import { createLogger } from "../../../utils/logger";

const log = createLogger("save");

/**
 * A failure this soon after the last one for the same setting is part of the
 * same gesture (wheel notches, arrow presses, quick clicks), so it isn't
 * reported again (#511)
 */
export const REPEAT_FAILURE_MS = 1000;

export interface SettingSave<K, V, D = unknown> {
  /** The value on screen before this change */
  current: V;
  key: K;
  /**
   * Called once main has saved the latest change, with what main returned
   * with it (an edited kit, #452)
   */
  onSaved?: (data: D | undefined) => void;
  /** Tells the user the latest change wasn't saved; `saved` is now on screen */
  report: (saved: V) => void;
  /** Puts the last saved value back on screen */
  restore: (saved: V) => void;
  /** Sends the save to main */
  send: () => Promise<DbResult<D> | undefined> | undefined;
  /** The new value, already on screen */
  value: V;
  /** What's being saved, for the log */
  what: string;
}

/**
 * Waits for a save sent to main and says whether it failed: main refused it
 * (`success: false`), the call threw, or there was no answer at all because
 * the preload method or `electronAPI` is missing (#543). The reason goes to
 * the log, not to the user (RE-91).
 */
export async function saveFailed(
  save: Promise<DbResult | undefined> | undefined,
  what: string,
): Promise<boolean> {
  return (await saveResult(save, what)).failed;
}

/**
 * saveFailed, with what main returned with a save that succeeded (an
 * edited kit, #452)
 */
export async function saveResult<D>(
  save: Promise<DbResult<D> | undefined> | undefined,
  what: string,
): Promise<{ data?: D; failed: boolean }> {
  try {
    const result = await save;
    if (!result) {
      log.warn(`Saving ${what} failed: no answer from main`);
      return { failed: true };
    }
    if (!result.success) {
      log.warn(`Saving ${what} failed:`, result.error);
      return { failed: true };
    }
    return { data: result.data, failed: false };
  } catch (error) {
    log.warn(`Saving ${what} failed:`, error);
    return { failed: true };
  }
}

/**
 * Saves a setting the screen already shows (a gain knob, a level slider, a
 * sample mode) and, if main doesn't save it, puts the last saved value back
 * and tells the user (RE-91).
 *
 * A drag sends a save per step. Main answers them in order, so only the
 * latest change for a key decides what's restored, and a drag that fails
 * gives one message rather than one per step. Changes that each finish
 * before the next starts (wheel notches, arrow presses) also give one
 * message while they keep failing less than `REPEAT_FAILURE_MS` apart.
 *
 * `save` resolves to whether main saved this change. `pending` gives the
 * latest change sent for a key while any change for it is still saving, so
 * a value main returns in the meantime doesn't take it off screen (#778).
 */
export function useSettingSave<K, V, D = unknown>() {
  // The value main last saved, per key, once a change has been sent
  const saved = React.useRef(new Map<K, V>());
  // The latest change sent, per key
  const latest = React.useRef(new Map<K, number>());
  // When the latest change for a key last failed
  const lastFailure = React.useRef(new Map<K, number>());
  // The latest change sent and how many are still saving, per key
  const inFlight = React.useRef(new Map<K, { count: number; value: V }>());

  const save = React.useCallback(
    async ({
      current,
      key,
      onSaved,
      report,
      restore,
      send,
      value,
      what,
    }: SettingSave<K, V, D>): Promise<boolean> => {
      if (!saved.current.has(key)) saved.current.set(key, current);
      const request = (latest.current.get(key) ?? 0) + 1;
      latest.current.set(key, request);
      const sending = inFlight.current.get(key);
      inFlight.current.set(key, { count: (sending?.count ?? 0) + 1, value });

      const { data, failed } = await saveResult(send(), what);
      if (!failed) saved.current.set(key, value);
      const saving = inFlight.current.get(key);
      if (saving && saving.count > 1) saving.count -= 1;
      else inFlight.current.delete(key);
      // A newer change is on its way; its answer decides
      if (latest.current.get(key) !== request) return !failed;

      if (failed) {
        const previous = saved.current.has(key)
          ? (saved.current.get(key) as V)
          : current;
        restore(previous);
        // An older change still saving keeps what's now on screen
        const older = inFlight.current.get(key);
        if (older) older.value = previous;
        const now = Date.now();
        const last = lastFailure.current.get(key);
        lastFailure.current.set(key, now);
        if (last == null || now - last > REPEAT_FAILURE_MS) report(previous);
      } else {
        lastFailure.current.delete(key);
        onSaved?.(data);
      }
      return !failed;
    },
    [],
  );

  // Call when the values on screen are reloaded from main
  const reset = React.useCallback(() => {
    saved.current.clear();
  }, []);

  /**
   * The latest change sent for `key` while any change for it is still
   * saving; undefined once main has answered them all
   */
  const pending = React.useCallback((key: K): { value: V } | undefined => {
    const saving = inFlight.current.get(key);
    return saving && { value: saving.value };
  }, []);

  return { pending, reset, save };
}
