import type { SyncChangeSummary } from "@romper/app/renderer/components/dialogs/SyncUpdateDialog.types";
import type { SyncOptions } from "@romper/shared/electronApi.js";

import { useCallback, useState } from "react";

import { createLogger } from "../../../utils/logger";
import {
  createSyncProgressStore,
  type SyncProgressStore,
} from "./syncProgressStore";

const log = createLogger("Sync");

interface SyncUpdateDependencies {
  electronAPI?: typeof globalThis.electronAPI;
}

interface UseSyncUpdateResult {
  cancelSync: () => void;
  clearError: () => void;
  error: null | string;
  generateChangeSummary: (
    sdCardPath?: string,
  ) => Promise<null | SyncChangeSummary>;
  isLoading: boolean;
  startSync: (options: SyncOptions) => Promise<boolean>;
  /** Read with useSyncProgress; see syncProgressStore.ts. */
  syncProgressStore: SyncProgressStore;
}

export function useSyncUpdate(
  deps: SyncUpdateDependencies = {},
): UseSyncUpdateResult {
  const electronAPI = deps.electronAPI || globalThis.electronAPI;

  const [syncProgressStore] = useState(createSyncProgressStore);
  const setSyncProgress = syncProgressStore.set;
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
        log.debug("generateSyncChangeSummary result:", result);

        if (!result.success) {
          setError(result.error || "Failed to generate sync summary");
          return null;
        }

        log.debug("Returning summary data:", result.data);
        return result.data ?? null;
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
    async (options: SyncOptions): Promise<boolean> => {
      if (!electronAPI?.startKitSync) {
        setError("Sync functionality not available");
        return false;
      }

      setIsLoading(true);
      setError(null);
      setSyncProgress({
        currentFile: "",
        filesCompleted: 0,
        status: "preparing",
        totalFiles: 0, // Will be updated by progress events
      });

      // Progress events can be delivered after the write's result (a large
      // sync queues thousands), and must not overwrite the final state.
      let settled = false;
      let stopListening: (() => void) | undefined;
      try {
        stopListening = electronAPI.onSyncProgress?.((progress) => {
          if (!settled) setSyncProgress(progress);
        });

        const result = await electronAPI.startKitSync({
          sdCardPath: options.sdCardPath,
          skipInvalidFiles: options.skipInvalidFiles,
        });
        settled = true;

        if (!result.success) {
          setError(result.error || "Sync operation failed");
          setSyncProgress((prev) =>
            prev ? { ...prev, error: result.error, status: "error" } : null,
          );
          return false;
        }

        const finalStatus = result.data?.cancelled ? "cancelled" : "completed";
        // Main's count is exact; the last progress event may lag behind it
        const syncedFiles = result.data?.syncedFiles;
        setSyncProgress((prev) =>
          prev
            ? {
                ...prev,
                filesCompleted: syncedFiles ?? prev.filesCompleted,
                status: finalStatus,
              }
            : null,
        );
        return true;
      } catch (err) {
        settled = true;
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(`Sync failed: ${errorMessage}`);
        setSyncProgress((prev) =>
          prev ? { ...prev, error: errorMessage, status: "error" } : null,
        );
        return false;
      } finally {
        stopListening?.();
        setIsLoading(false);
      }
    },
    [electronAPI, setSyncProgress],
  );

  // Asks main to stop after the file in progress. The running startSync
  // call resolves with a cancelled outcome and sets the final state.
  const cancelSync = useCallback(() => {
    void electronAPI?.cancelKitSync?.();
  }, [electronAPI]);

  return {
    cancelSync,
    clearError,
    error,
    generateChangeSummary,
    isLoading,
    startSync,
    syncProgressStore,
  };
}
