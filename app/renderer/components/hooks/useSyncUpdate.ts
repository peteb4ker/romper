import { useCallback, useState } from "react";

import type { SyncChangeSummary } from "../dialogs/SyncUpdateDialog";

interface SyncProgress {
  currentFile: string;
  filesCompleted: number;
  totalFiles: number;
  bytesCompleted: number;
  totalBytes: number;
  status:
    | "preparing"
    | "copying"
    | "converting"
    | "finalizing"
    | "completed"
    | "error";
  error?: string;
}

interface UseSyncUpdateResult {
  syncProgress: SyncProgress | null;
  isLoading: boolean;
  error: string | null;
  generateChangeSummary: () => Promise<SyncChangeSummary | null>;
  startSync: (changeSummary: SyncChangeSummary) => Promise<boolean>;
  cancelSync: () => void;
  clearError: () => void;
}

interface SyncUpdateDependencies {
  electronAPI?: typeof window.electronAPI;
}

export function useSyncUpdate(
  deps: SyncUpdateDependencies = {},
): UseSyncUpdateResult {
  const electronAPI = deps.electronAPI || window.electronAPI;

  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generateChangeSummary =
    useCallback(async (): Promise<SyncChangeSummary | null> => {
      if (!electronAPI?.generateSyncChangeSummary) {
        setError("Sync functionality not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await electronAPI.generateSyncChangeSummary();

        if (!result.success) {
          setError(result.error || "Failed to generate sync summary");
          return null;
        }

        return result.data || null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(`Failed to generate sync summary: ${errorMessage}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    }, [electronAPI]);

  const startSync = useCallback(
    async (changeSummary: SyncChangeSummary): Promise<boolean> => {
      if (!electronAPI?.startKitSync) {
        setError("Sync functionality not available");
        return false;
      }

      setIsLoading(true);
      setError(null);
      setSyncProgress({
        currentFile: "",
        filesCompleted: 0,
        totalFiles:
          changeSummary.filesToCopy.length +
          changeSummary.filesToConvert.length,
        bytesCompleted: 0,
        totalBytes: changeSummary.estimatedSize,
        status: "preparing",
      });

      try {
        // Set up progress listener if available
        if (electronAPI.onSyncProgress) {
          electronAPI.onSyncProgress((progress: SyncProgress) => {
            setSyncProgress(progress);
          });
        }

        const result = await electronAPI.startKitSync({
          filesToCopy: changeSummary.filesToCopy,
          filesToConvert: changeSummary.filesToConvert,
        });

        if (!result.success) {
          setError(result.error || "Sync operation failed");
          setSyncProgress((prev) =>
            prev ? { ...prev, status: "error", error: result.error } : null,
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
          prev ? { ...prev, status: "error", error: errorMessage } : null,
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
    syncProgress,
    isLoading,
    error,
    generateChangeSummary,
    startSync,
    cancelSync,
    clearError,
  };
}
