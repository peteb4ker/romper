import type { RampleKitSaveView } from "@romper/shared/rampleKitSaveView";

import { getErrorMessage } from "@romper/shared/errorUtils";
import React from "react";

import { RAMPLE_SAVE_TEXT } from "./rampleSaveText";

/** What the "On the Rample" section has for the kit it shows. */
export type KitRampleSaveState =
  | { error: string; status: "error" }
  | { status: "idle" }
  | { status: "loaded"; view: RampleKitSaveView }
  | { status: "loading" };

interface Loaded {
  kitName: string;
  state: KitRampleSaveState;
}

/**
 * The settings the Rample saved for a kit (#800), read from main while the
 * section is open: nothing is read while it's collapsed, so opening a kit
 * costs no extra IPC call. Reading again each time it opens picks up a
 * newer copy of the card's `_save` folder.
 */
export function useKitRampleSave(
  kitName: string | undefined,
  open: boolean,
): KitRampleSaveState {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);

  React.useEffect(() => {
    if (!open || !kitName) return;
    let live = true;
    const settle = (state: KitRampleSaveState) => {
      if (live) setLoaded({ kitName, state });
    };
    const read = globalThis.electronAPI?.getKitRampleSave;
    if (!read) {
      settle({ error: RAMPLE_SAVE_TEXT.unknownError, status: "error" });
      return;
    }
    read(kitName)
      .then((result) => {
        settle(
          result.success && result.data
            ? { status: "loaded", view: result.data }
            : {
                error: result.error ?? RAMPLE_SAVE_TEXT.unknownError,
                status: "error",
              },
        );
      })
      .catch((error: unknown) => {
        settle({ error: getErrorMessage(error), status: "error" });
      });
    return () => {
      live = false;
    };
  }, [kitName, open]);

  if (!open || !kitName) return { status: "idle" };
  return loaded?.kitName === kitName ? loaded.state : { status: "loading" };
}
