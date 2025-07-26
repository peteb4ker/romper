import { useCallback } from "react";

interface UseBankScanningProps {
  localStorePath: string | null;
  onMessage?: (message: string, type?: string) => void;
}

/**
 * Hook for bank scanning operations
 */
export function useBankScanning({
  localStorePath,
  onMessage,
}: UseBankScanningProps) {
  const scanBanks = useCallback(async () => {
    if (!localStorePath) {
      onMessage?.("No local store configured", "error");
      return;
    }

    try {
      const result = await window.electronAPI.scanBanks?.(
        localStorePath + "/.romperdb",
        localStorePath,
      );
      if (result?.success) {
        onMessage?.(
          `Bank scanning complete. Updated ${result.data?.updatedBanks} banks.`,
          "success",
        );
      } else {
        onMessage?.(`Bank scanning failed: ${result?.error}`, "error");
      }
    } catch (error) {
      onMessage?.(
        `Bank scanning error: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }, [localStorePath, onMessage]);

  return {
    scanBanks,
  };
}
