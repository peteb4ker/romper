import { ipcMain } from "electron";

import { syncService } from "../services/syncService.js";

/**
 * Registers all sync-related IPC handlers
 */
export function registerSyncIpcHandlers(inMemorySettings: Record<string, any>) {
  // SD Card sync operations
  ipcMain.handle("generateSyncChangeSummary", async () => {
    return syncService.generateChangeSummary(inMemorySettings);
  });

  ipcMain.handle(
    "startKitSync",
    async (
      _event,
      syncData: {
        filesToConvert: Array<{
          destinationPath: string;
          filename: string;
          kitName: string;
          operation: "convert" | "copy";
          sourcePath: string;
        }>;
        filesToCopy: Array<{
          destinationPath: string;
          filename: string;
          kitName: string;
          operation: "convert" | "copy";
          sourcePath: string;
        }>;
      },
    ) => {
      return syncService.startKitSync(inMemorySettings, syncData);
    },
  );

  ipcMain.handle("cancelKitSync", async () => {
    syncService.cancelSync();
  });
}
