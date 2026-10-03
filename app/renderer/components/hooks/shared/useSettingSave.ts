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

export interface SettingSave<K, V> {
  /** The value on screen before this change */
  current: V;
  key: K;
  /** Called once main has saved the latest change */
  onSaved?: () => void;
  /** Tells the user the latest change wasn't saved; `saved` is now on screen */
  report: (saved: V) => void;
  /** Puts the last saved value back on screen */
  restore: (saved: V) => void;
  /** Sends the save to main */
  send: () => Promise<DbResult | undefined> | undefined;
  /** The new value, already on screen */
  value: V;
  /** What's being saved, for the log */
  what: string;
}

/**
 * Waits for a save sent to main and says whether it failed: main refused it
 * (`success: false`) or the call threw. The reason goes to the log, not to
 * the user (RE-91).
 */
export async function saveFailed(
  save: Promise<DbResult | undefined> | undefined,
  what: string,
): Promise<boolean> {
  try {
    const result = await save;
    if (result && !result.success) {
      log.warn(`Saving ${what} failed:`, result.error);
      return true;
    }
    return false;
  } catch (error) {
    log.warn(`Saving ${what} failed:`, error);
    return true;
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
 */
export function useSettingSave<K, V>() {
  // The value main last saved, per key, once a change has been sent
  const saved = React.useRef(new Map<K, V>());
  // The latest change sent, per key
  const latest = React.useRef(new Map<K, number>());
  // When the latest change for a key last failed
  const lastFailure = React.useRef(new Map<K, number>());

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
    }: SettingSave<K, V>) => {
      if (!saved.current.has(key)) saved.current.set(key, current);
      const request = (latest.current.get(key) ?? 0) + 1;
      latest.current.set(key, request);

      const failed = await saveFailed(send(), what);
      if (!failed) saved.current.set(key, value);
      // A newer change is on its way; its answer decides
      if (latest.current.get(key) !== request) return;

      if (failed) {
        const previous = saved.current.has(key)
          ? (saved.current.get(key) as V)
          : current;
        restore(previous);
        const now = Date.now();
        const last = lastFailure.current.get(key);
        lastFailure.current.set(key, now);
        if (last == null || now - last > REPEAT_FAILURE_MS) report(previous);
      } else {
        lastFailure.current.delete(key);
        onSaved?.();
      }
    },
    [],
  );

  // Call when the values on screen are reloaded from main
  const reset = React.useCallback(() => {
    saved.current.clear();
  }, []);

  return { reset, save };
}
