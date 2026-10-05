import { createLogger } from "../../../utils/logger";
import { isTypingTarget } from "../shared/useGlobalKeyboardShortcuts";
import { useMenuEvents } from "../shared/useMenuEvents";
import { SCAN_ALL_CONFIRM_MESSAGE } from "./useKitScan";

const log = createLogger("KitViewMenu");

interface UseKitViewMenuHandlersProps {
  /** Romper's redo, for Edit > Redo outside a text field */
  onRedo?: () => void;
  /** Scans every kit in the store, whatever the browser shows (RE-43) */
  onScanAllKits?: () => Promise<void> | void;
  /** Romper's undo, for Edit > Undo outside a text field */
  onUndo?: () => void;
  openChangeDirectory: () => void;
  openPreferences: () => void;
}

/**
 * Custom hook for handling menu events in KitsView
 * Provides dependency injection for better testability
 */
export function useKitViewMenuHandlers({
  onRedo,
  onScanAllKits,
  onUndo,
  openChangeDirectory,
  openPreferences,
}: UseKitViewMenuHandlersProps): void {
  // Menu event handlers
  useMenuEvents({
    onAbout: () => {
      log.debug("Menu about triggered");
    },
    onChangeLocalStoreDirectory: () => {
      log.debug("Menu change local store directory triggered");
      openChangeDirectory();
    },
    onPreferences: () => {
      log.debug("Menu preferences triggered");
      openPreferences();
    },
    onRedo: () => {
      log.debug("Menu redo triggered");
      runEditCommand("redo", onRedo);
    },
    onScanAll: () => {
      log.debug("Menu scan all triggered");
      // Scan All touches every kit, so ask first (RE-04)
      if (!globalThis.confirm(SCAN_ALL_CONFIRM_MESSAGE)) return;
      // Every kit, in the browser or the editor (RE-43). Bank names aren't
      // scanned: the store's bank name files are only written (#567)
      void onScanAllKits?.();
    },
    onUndo: () => {
      log.debug("Menu undo triggered");
      runEditCommand("undo", onUndo);
    },
  });
}

/**
 * Edit > Undo/Redo: a focused text field gets its own undo, as the native
 * menu role gave it; anything else gets Romper's (RE-65)
 */
function runEditCommand(command: "redo" | "undo", romperCommand?: () => void) {
  if (isTypingTarget(document.activeElement)) {
    document.execCommand(command); // NOSONAR - execCommand is the only way to reach the field's native undo stack (RE-65)
    return;
  }
  romperCommand?.();
}
