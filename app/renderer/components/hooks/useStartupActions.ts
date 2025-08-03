import { useEffect } from "react";

interface UseStartupActionsProps {
  localStorePath: null | string;
  needsLocalStoreSetup: boolean;
}

/**
 * Hook for handling startup actions after local store is configured
 */
export function useStartupActions({
  localStorePath,
  needsLocalStoreSetup,
}: UseStartupActionsProps) {
  // Run startup actions when local store is configured
  useEffect(() => {
    if (!localStorePath || needsLocalStoreSetup) return;

    const runStartupActions = async () => {
      // Run bank scanning on startup (after migrations)
      try {
        console.log("[Startup] Running bank scanning...");
        const bankScanResult = await window.electronAPI.scanBanks?.();
        if (bankScanResult?.success) {
          console.log(
            `[Startup] Bank scanning complete. Updated ${bankScanResult.data?.updatedBanks} banks.`,
          );
        } else {
          console.warn(
            `[Startup] Bank scanning failed: ${bankScanResult?.error}`,
          );
        }
      } catch (error) {
        console.warn(
          `[Startup] Bank scanning error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    runStartupActions();
  }, [localStorePath, needsLocalStoreSetup]);
}
