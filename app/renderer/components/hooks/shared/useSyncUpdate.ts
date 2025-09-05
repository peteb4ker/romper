import type { SyncChangeSummary } from "@romper/app/renderer/components/dialogs/SyncUpdateDialog.types";

import { useCallback, useState } from "react";

interface SyncProgress {
  bytesCompleted: number;
  currentFile: string;
  error?: string;
  filesCompleted: number;
  status:
    | "completed"
    | "converting"
    | "copying"
    | "error"
    | "finalizing"
    | "preparing";
  totalBytes: number;
  totalFiles: number;
}

interface SyncUpdateDependencies {
  electronAPI?: typeof window.electronAPI;
}

interface UseSyncUpdateResult {
  cancelSync: () => void;
  clearError: () => void;
  error: null | string;
  generateChangeSummary: (
    sdCardPath?: string,
  ) => Promise<null | SyncChangeSummary>;
  isLoading: boolean;
  startSync: (options: {
    sdCardPath: string;
    wipeSdCard?: boolean;
  }) => Promise<boolean>;
  syncProgress: null | SyncProgress;
}

export function useSyncUpdate(
  deps: SyncUpdateDependencies = {},
): UseSyncUpdateResult {
  const electronAPI = deps.electronAPI || window.electronAPI;

  const [syncProgress, setSyncProgress] = useState<null | SyncProgress>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generateChangeSummary = useCallback(
    async (sdCardPath?: string): Promise<null | SyncChangeSummary> => {
      if (!electronAPI?.generateSyncChangeSummary) {
        setError("Sync functionality not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await electronAPI.generateSyncChangeSummary(sdCardPath);
        console.log("[Frontend] generateSyncChangeSummary result:", result);

        if (!result.success) {
          setError(result.error || "Failed to generate sync summary");
          return null;
        }

        console.log("[Frontend] Returning summary data:", result.data);
        return (result.data as unknown as SyncChangeSummary) || null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(`Failed to generate sync summary: ${errorMessage}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [electronAPI],
  );

  const startSync = useCallback(
    async (options: {
      sdCardPath: string;
      wipeSdCard?: boolean;
    }): Promise<boolean> => {
      if (!electronAPI?.startKitSync) {
        setError("Sync functionality not available");
        return false;
      }

      setIsLoading(true);
      setError(null);
      setSyncProgress({
        bytesCompleted: 0,
        currentFile: "",
        filesCompleted: 0,
        status: "preparing",
        totalBytes: 0, // Will be updated by progress events
        totalFiles: 0, // Will be updated by progress events
      });

      try {
        // Set up progress listener if available
        if (electronAPI.onSyncProgress) {
          electronAPI.onSyncProgress((progress: SyncProgress) => {
            setSyncProgress(progress);
          });
        }

        const result = await electronAPI.startKitSync({
          sdCardPath: options.sdCardPath,
          wipeSdCard: options.wipeSdCard,
        });

        if (!result.success) {
          setError(result.error || "Sync operation failed");
          setSyncProgress((prev) =>
            prev ? { ...prev, error: result.error, status: "error" } : null,
          );
          return false;
        }

        setSyncProgress((prev) =>
          prev ? { ...prev, status: "completed" } : null,
        );
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(`Sync failed: ${errorMessage}`);
        setSyncProgress((prev) =>
          prev ? { ...prev, error: errorMessage, status: "error" } : null,
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [electronAPI],
  );

  const cancelSync = useCallback(() => {
    if (electronAPI?.cancelKitSync) {
      electronAPI.cancelKitSync();
    }

    setSyncProgress(null);
    setIsLoading(false);
    setError(null);
  }, [electronAPI]);

  return {
    cancelSync,
    clearError,
    error,
    generateChangeSummary,
    isLoading,
    startSync,
    syncProgress,
  };
}
