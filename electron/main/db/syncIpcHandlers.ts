import { ipcMain } from "electron";

import { type SyncOptions, syncService } from "../services/syncService.js";

/**
 * Registers all sync-related IPC handlers
 */
export function registerSyncIpcHandlers(
  inMemorySettings: Record<string, unknown>,
) {
  // SD Card sync operations
  ipcMain.handle(
    "generateSyncChangeSummary",
    async (_event, sdCardPath?: string) => {
      return syncService.generateChangeSummary(inMemorySettings, sdCardPath);
    },
  );

  ipcMain.handle("startKitSync", (_event, options: SyncOptions) => {
    return syncService.startKitSync(inMemorySettings, options);
  });

  ipcMain.handle("cancelKitSync", () => {
    syncService.cancelSync();
  });
}
