import { handle } from "../ipcHandle.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { readKitRampleSave } from "./rampleKitSaveView.js";

/**
 * The Rample `_save` channels (#786). Read-only: they read the store's
 * copies of the card's `_save` folder, never the card.
 */
export function registerRampleSaveIpcHandlers(
  inMemorySettings: Record<string, unknown>,
): void {
  // The kit editor's "On the Rample" section, when it opens (#800)
  handle("get-kit-rample-save", (_event, kitName: unknown) => {
    const localStorePath =
      ServicePathManager.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }
    if (typeof kitName !== "string") {
      return { error: "Kit name must be a string", success: false };
    }
    return readKitRampleSave(localStorePath, kitName);
  });
}
