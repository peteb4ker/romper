import type { KitBrowserHandle } from "@romper/app/renderer/components/KitBrowser";

import React, { useCallback, useRef } from "react";

import { useBankScanning } from "../shared/useBankScanning";
import { useMenuEvents } from "../shared/useMenuEvents";
import { useValidationResults } from "../shared/useValidationResults";

interface UseKitViewMenuHandlersProps {
  canRedo?: boolean;
  canUndo?: boolean;
  localStorePath: null | string;
  onMessage: (text: string, type?: string, duration?: number) => void;
  openChangeDirectory: () => void;
  openPreferences: () => void;
  openWizard: () => void;
}

interface UseKitViewMenuHandlersReturn {
  kitBrowserRef: React.RefObject<KitBrowserHandle | null>;
  openValidationDialog: () => void;
}

/**
 * Custom hook for handling menu events in KitsView
 * Provides dependency injection for better testability
 */
export function useKitViewMenuHandlers({
  canRedo = false,
  canUndo = false,
  localStorePath,
  onMessage,
  openChangeDirectory,
  openPreferences,
  openWizard,
}: UseKitViewMenuHandlersProps): UseKitViewMenuHandlersReturn {
  // Ref to access KitBrowser scan functionality
  const kitBrowserRef = useRef<KitBrowserHandle | null>(null);

  // Validation results hook for database validation
  const { openValidationDialog: openValidationDialogAsync } =
    useValidationResults({
      localStorePath: localStorePath ?? "",
      onMessage: (text, type) => {
        console.log("[useKitViewMenuHandlers] Validation message:", text);
        onMessage(text, type);
      },
    });

  // Wrapper to handle async validation dialog opening
  const openValidationDialog = useCallback(() => {
    openValidationDialogAsync().catch((error) => {
      console.error(
        "[useKitViewMenuHandlers] Error opening validation dialog:",
        error
      );
      onMessage("Failed to open validation dialog", "error");
    });
  }, [openValidationDialogAsync, onMessage]);

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
      // Could show an about dialog here
    },
    onChangeLocalStoreDirectory: () => {
      console.log(
        "[useKitViewMenuHandlers] Menu change local store directory triggered"
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
    onScanAllKits: () => {
      console.log("[useKitViewMenuHandlers] Menu scan all kits triggered");
      if (kitBrowserRef.current?.handleScanAllKits) {
        kitBrowserRef.current.handleScanAllKits();
      }
    },
    onScanBanks: () => {
      console.log("[useKitViewMenuHandlers] Menu scan banks triggered");
      scanBanks();
    },
    onSetupLocalStore: () => {
      console.log("[useKitViewMenuHandlers] Menu setup local store triggered");
      openWizard();
    },
    onUndo: () => {
      console.log("[useKitViewMenuHandlers] Menu undo triggered");
      if (canUndo) {
        dispatchUndoRedoEvent(false);
      }
    },
    onValidateDatabase: () => {
      console.log("[useKitViewMenuHandlers] Menu validate database triggered");
      openValidationDialog();
    },
  });

  return {
    kitBrowserRef,
    openValidationDialog,
  };
}
