import { useEffect } from "react";

interface UseStoreCheckProps {
  /**
   * Whether the kit grid has loaded for `localStorePath`. The first status
   * request starts main's background check of the store's sample files, so
   * it waits for the grid (#812).
   */
  isGridLoaded: boolean;
  localStorePath: null | string;
  /** Shows a kit as quarantined, or not, without reading it again */
  onQuarantineFound: (kitName: string, quarantined: boolean) => void;
}

/**
 * Follows main's background check of the store's sample files (#812): a
 * file deleted or broken on disk quarantines its kit, and the kit card
 * shows it without the kit being opened. Only the kits whose finding
 * changed are patched; nothing is read again.
 */
export function useStoreCheck({
  isGridLoaded,
  localStorePath,
  onQuarantineFound,
}: UseStoreCheckProps): void {
  useEffect(() => {
    if (!isGridLoaded || !localStorePath) return;
    const api = globalThis.electronAPI;
    let active = true;
    // Listen before asking, so no push falls between the two
    const stopListening = api?.onStoreCheckUpdated?.((update) => {
      for (const kit of update.kits) {
        onQuarantineFound(kit.kitName, kit.quarantined);
      }
    });
    // What was found before this view (or a reloaded renderer) listened
    void api
      ?.getStoreCheckStatus?.()
      .then((result) => {
        if (!active || !result.success || !result.data) return;
        for (const kit of result.data.kits) {
          onQuarantineFound(kit.kitName, kit.quarantined);
        }
      })
      .catch((error: unknown) => {
        console.warn("[useStoreCheck] Couldn't read the store check:", error);
      });
    return () => {
      active = false;
      stopListening?.();
    };
  }, [isGridLoaded, localStorePath, onQuarantineFound]);
}
