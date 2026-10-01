import { ipcMain } from "electron";

import { checkPathAccess } from "../security/pathAccess.js";
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
      // The summary lists what sync would delete from the card, so it reads
      // the card: the same folders as sync may write (RE-03).
      if (sdCardPath) {
        const access = checkPathAccess(sdCardPath, { write: true });
        if (!access.ok) return { error: access.error, success: false };
      }
      return syncService.generateChangeSummary(inMemorySettings, sdCardPath);
    },
  );

  ipcMain.handle("startKitSync", (_event, options: SyncOptions) => {
    // RE-03: sync writes to the target and deletes stale kits from it, so it
    // must be the SD card from settings/env or a folder the user picked.
    const access = checkPathAccess(options?.sdCardPath, { write: true });
    if (!access.ok) return { error: access.error, success: false };
    return syncService.startKitSync(inMemorySettings, options);
  });

  ipcMain.handle("cancelKitSync", () => {
    syncService.cancelSync();
  });
}
