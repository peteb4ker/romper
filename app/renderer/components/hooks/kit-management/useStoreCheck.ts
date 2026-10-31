import type { StoreCheckState } from "@romper/shared/electronApi";

import { describeNewMissingFiles } from "@romper/shared/storeCheckWording";
import { useEffect } from "react";

import { useLatestRef } from "../shared/useLatestRef";
import { storeCheckStore } from "./storeCheckStore";

interface UseStoreCheckProps {
  /**
   * Whether the kit grid has loaded for `localStorePath`. The first status
   * request starts main's background check of the store's sample files, so
   * it waits for the grid (#812).
   */
  isGridLoaded: boolean;
  localStorePath: null | string;
  /** Shows the one-time message when a pass finds missing files (#824) */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /** Shows a kit as quarantined, or not, without reading it again */
  onQuarantineFound: (kitName: string, quarantined: boolean) => void;
}

/**
 * Follows main's background check of the store's files (#812, #820, #824).
 * A file deleted or broken on disk quarantines its kit, and the kit card
 * shows it without the kit being opened. The rest of what the check finds
 * goes to `storeCheckStore`, for the badge, the status bar item and the
 * "Library check" dialog. Only the kits whose finding changed are patched;
 * nothing is read again.
 *
 * When a pass ends having found missing sample files it hadn't found
 * before, one message says so; known problems don't repeat it.
 */
export function useStoreCheck({
  isGridLoaded,
  localStorePath,
  onMessage,
  onQuarantineFound,
}: UseStoreCheckProps): void {
  const messageRef = useLatestRef(onMessage);

  // Another store has other findings
  useEffect(() => {
    storeCheckStore.begin(localStorePath);
  }, [localStorePath]);

  useEffect(() => {
    if (!isGridLoaded || !localStorePath) return;
    const api = globalThis.electronAPI;
    let active = true;
    const announce = (state: StoreCheckState) => {
      if (state !== "idle") return;
      const kits = storeCheckStore.takeNewMissing();
      if (kits > 0)
        messageRef.current?.(describeNewMissingFiles(kits), "warning");
    };
    // Listen before asking, so no push falls between the two
    const stopListening = api?.onStoreCheckUpdated?.((update) => {
      storeCheckStore.apply(update.kits);
      for (const kit of update.kits) {
        onQuarantineFound(kit.kitName, kit.quarantined);
      }
      announce(update.state);
    });
    // What was found before this view (or a reloaded renderer) listened
    void api
      ?.getStoreCheckStatus?.()
      .then((result) => {
        if (!active || !result.success || !result.data) return;
        storeCheckStore.replace(result.data.kits);
        for (const kit of result.data.kits) {
          onQuarantineFound(kit.kitName, kit.quarantined);
        }
        announce(result.data.state);
      })
      .catch((error: unknown) => {
        console.warn("[useStoreCheck] Couldn't read the store check:", error);
      });
    return () => {
      active = false;
      stopListening?.();
    };
  }, [isGridLoaded, localStorePath, messageRef, onQuarantineFound]);
}
