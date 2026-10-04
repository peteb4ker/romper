import { useEffect } from "react";

interface UseStartupActionsProps {
  /** Whether the local store's status says it is there and valid */
  isLocalStoreReady: boolean;
  localStorePath: null | string;
}

/**
 * Hook for handling startup actions once the local store is open.
 *
 * The actions wait for the store's status: a saved store that is missing
 * at launch isn't scanned (#553). They run when the store becomes valid
 * (at launch, after Try Again, or after setting up a new store) and again
 * when the store changes.
 */
export function useStartupActions({
  isLocalStoreReady,
  localStorePath,
}: UseStartupActionsProps) {
  useEffect(() => {
    if (!localStorePath || !isLocalStoreReady) return;

    const runStartupActions = async () => {
      // Run bank scanning on startup (after migrations)
      try {
        console.info("[Startup] Running bank scanning...");
        const bankScanResult = await globalThis.electronAPI.scanBanks?.();
        if (bankScanResult?.success) {
          console.info(
            `[Startup] Bank scanning complete. Updated ${bankScanResult.data?.updatedBanks} banks.`,
          );
        } else {
          console.error(
            `[Startup] Bank scanning failed: ${bankScanResult?.error}`,
          );
        }
      } catch (error) {
        console.error(
          `[Startup] Bank scanning error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    void runStartupActions();
  }, [isLocalStoreReady, localStorePath]);
}
