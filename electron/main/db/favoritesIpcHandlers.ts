import { ipcMain } from "electron";

import { createDbHandler } from "./ipcHandlerUtils.js";
import { toggleKitFavorite } from "./romperDbCoreORM.js";

/**
 * Registers all favorites-related IPC handlers
 */
export function registerFavoritesIpcHandlers(
  inMemorySettings: Record<string, unknown>,
) {
  // Task 20.1: Favorites system IPC handlers
  ipcMain.handle(
    "toggle-kit-favorite",
    createDbHandler(inMemorySettings, toggleKitFavorite),
  );
}
