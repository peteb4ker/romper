import type { KitBrowserHandle } from "@romper/app/renderer/components/KitBrowser";

import React, { useRef } from "react";

import { createLogger } from "../../../utils/logger";
import { useBankScanning } from "../shared/useBankScanning";
import { isTypingTarget } from "../shared/useGlobalKeyboardShortcuts";
import { useMenuEvents } from "../shared/useMenuEvents";
import { SCAN_ALL_CONFIRM_MESSAGE } from "./useKitScan";

const log = createLogger("KitViewMenu");

interface UseKitViewMenuHandlersProps {
  onMessage: (text: string, type?: string, duration?: number) => void;
  /** Romper's redo, for Edit > Redo outside a text field */
  onRedo?: () => void;
  /** Romper's undo, for Edit > Undo outside a text field */
  onUndo?: () => void;
  openChangeDirectory: () => void;
  openPreferences: () => void;
}

interface UseKitViewMenuHandlersReturn {
  kitBrowserRef: React.RefObject<KitBrowserHandle | null>;
}

/**
 * Custom hook for handling menu events in KitsView
 * Provides dependency injection for better testability
 */
export function useKitViewMenuHandlers({
  onMessage,
  onRedo,
  onUndo,
  openChangeDirectory,
  openPreferences,
}: UseKitViewMenuHandlersProps): UseKitViewMenuHandlersReturn {
  // Ref to access KitBrowser scan functionality
  const kitBrowserRef = useRef<KitBrowserHandle | null>(null);

  // Bank scanning hook
  const { scanBanks } = useBankScanning({
    onMessage,
  });

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
      // Run bank scan first (fast), then kit scan
      void scanBanks().then(() => {
        if (kitBrowserRef.current?.handleScanAllKits) {
          kitBrowserRef.current.handleScanAllKits();
        }
      });
    },
    onUndo: () => {
      log.debug("Menu undo triggered");
      runEditCommand("undo", onUndo);
    },
  });

  return {
    kitBrowserRef,
  };
}

/**
 * Edit > Undo/Redo: a focused text field gets its own undo, as the native
 * menu role gave it; anything else gets Romper's (RE-65)
 */
function runEditCommand(command: "redo" | "undo", romperCommand?: () => void) {
  if (isTypingTarget(document.activeElement)) {
    // The page's only way to reach the browser's own text undo stack
    document.execCommand(command);
    return;
  }
  romperCommand?.();
}
