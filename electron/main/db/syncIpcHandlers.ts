import { ipcMain } from "electron";

import { syncService } from "../services/syncService.js";

/**
 * Registers all sync-related IPC handlers
 */
export function registerSyncIpcHandlers(inMemorySettings: Record<string, any>) {
  // SD Card sync operations
  ipcMain.handle(
    "generateSyncChangeSummary",
    async (_event, sdCardPath?: string) => {
      return syncService.generateChangeSummary(inMemorySettings, sdCardPath);
    }
  );

  ipcMain.handle(
    "startKitSync",
    async (
      _event,
      options: {
        sdCardPath: string;
        wipeSdCard?: boolean;
      }
    ) => {
      return syncService.startKitSync(inMemorySettings, options);
    }
  );

  ipcMain.handle("cancelKitSync", async () => {
    syncService.cancelSync();
  });
}
