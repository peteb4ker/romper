import { ipcMain } from "electron";

import { createDbHandler } from "./ipcHandlerUtils.js";
import {
  getFavoriteKits,
  getFavoriteKitsCount,
  setKitFavorite,
  toggleKitFavorite,
} from "./romperDbCoreORM.js";

/**
 * Registers all favorites-related IPC handlers
 */
export function registerFavoritesIpcHandlers(
  inMemorySettings: Record<string, any>,
) {
  // Task 20.1: Favorites system IPC handlers
  ipcMain.handle(
    "toggle-kit-favorite",
    createDbHandler(inMemorySettings, toggleKitFavorite),
  );

  ipcMain.handle(
    "set-kit-favorite",
    createDbHandler(inMemorySettings, setKitFavorite),
  );

  ipcMain.handle(
    "get-favorite-kits",
    createDbHandler(inMemorySettings, getFavoriteKits),
  );

  ipcMain.handle(
    "get-favorite-kits-count",
    createDbHandler(inMemorySettings, getFavoriteKitsCount),
  );
}
