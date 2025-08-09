import { useCallback } from "react";

interface UseBankScanningProps {
  onMessage?: (message: string, type?: string) => void;
}

/**
 * Hook for bank scanning operations
 */
export function useBankScanning({ onMessage }: UseBankScanningProps) {
  const scanBanks = useCallback(async () => {
    try {
      const result = await window.electronAPI.scanBanks?.();
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
  }, [onMessage]);

  return {
    scanBanks,
  };
}
