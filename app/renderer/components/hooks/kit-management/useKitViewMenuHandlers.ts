import type { KitBrowserHandle } from "@romper/app/renderer/components/KitBrowser";

import React, { useCallback, useRef } from "react";

import { useBankScanning } from "../shared/useBankScanning";
import { useMenuEvents } from "../shared/useMenuEvents";

interface UseKitViewMenuHandlersProps {
  canRedo?: boolean;
  canUndo?: boolean;
  onMessage: (text: string, type?: string, duration?: number) => void;
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
  canRedo = false,
  canUndo = false,
  onMessage,
  openChangeDirectory,
  openPreferences,
}: UseKitViewMenuHandlersProps): UseKitViewMenuHandlersReturn {
  // Ref to access KitBrowser scan functionality
  const kitBrowserRef = useRef<KitBrowserHandle | null>(null);

  // Bank scanning hook
  const { scanBanks } = useBankScanning({
    onMessage,
  });

  // Helper to dispatch keyboard events for undo/redo
  const dispatchUndoRedoEvent = useCallback((isRedo: boolean) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      ctrlKey: true, // For Windows/Linux
      key: "z",
      metaKey: true, // For Mac
      shiftKey: isRedo,
    });
    document.dispatchEvent(event);
  }, []);

  // Menu event handlers
  useMenuEvents({
    onAbout: () => {
      console.log("[useKitViewMenuHandlers] Menu about triggered");
    },
    onChangeLocalStoreDirectory: () => {
      console.log(
        "[useKitViewMenuHandlers] Menu change local store directory triggered",
      );
      openChangeDirectory();
    },
    onPreferences: () => {
      console.log("[useKitViewMenuHandlers] Menu preferences triggered");
      openPreferences();
    },
    onRedo: () => {
      console.log("[useKitViewMenuHandlers] Menu redo triggered");
      if (canRedo) {
        dispatchUndoRedoEvent(true);
      }
    },
    onScanAll: async () => {
      console.log("[useKitViewMenuHandlers] Menu scan all triggered");
      // Run bank scan first (fast), then kit scan
      await scanBanks();
      if (kitBrowserRef.current?.handleScanAllKits) {
        kitBrowserRef.current.handleScanAllKits();
      }
    },
    onUndo: () => {
      console.log("[useKitViewMenuHandlers] Menu undo triggered");
      if (canUndo) {
        dispatchUndoRedoEvent(false);
      }
    },
  });

  return {
    kitBrowserRef,
  };
}
