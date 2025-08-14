import React, { useCallback, useEffect, useRef, useState } from "react";

import { useKit } from "../components/hooks/kit-management/useKit";
import { useKitDataManager } from "../components/hooks/kit-management/useKitDataManager";
import { useKitNavigation } from "../components/hooks/kit-management/useKitNavigation";
import { useKitViewMenuHandlers } from "../components/hooks/kit-management/useKitViewMenuHandlers";
import { useDialogState } from "../components/hooks/shared/useDialogState";
import { useGlobalKeyboardShortcuts } from "../components/hooks/shared/useGlobalKeyboardShortcuts";
import { useMessageDisplay } from "../components/hooks/shared/useMessageDisplay";
import { useStartupActions } from "../components/hooks/shared/useStartupActions";
import KitBrowserContainer from "../components/KitBrowserContainer";
import KitDetailsContainer from "../components/KitDetailsContainer";
import KitViewDialogs from "../components/KitViewDialogs";
import LocalStoreWizardModal from "../components/LocalStoreWizardModal";
import {
  restoreSelectedKitIfExists,
  saveSelectedKitState,
} from "../utils/hmrStateManager";
import { useSettings } from "../utils/SettingsContext";

/**
 * Main view component for kit management
 * Orchestrates kit browsing, selection, and editing functionality
 */
const KitsView: React.FC = () => {
  const {
    isInitialized,
    localStorePath,
    localStoreStatus,
    refreshLocalStoreStatus,
    setLocalStorePath,
  } = useSettings();

  const { showMessage } = useMessageDisplay();

  // Get the effective local store path (from status, which includes env overrides)
  const effectiveLocalStorePath =
    localStoreStatus?.localStorePath || localStorePath;

  // Check if local store needs to be set up (no local store configured at all)
  const needsLocalStoreSetup =
    isInitialized && localStoreStatus !== null && !effectiveLocalStorePath;

  // Check if local store is configured but invalid (should show error + change directory)
  const hasInvalidLocalStore =
    isInitialized &&
    localStoreStatus !== null &&
    effectiveLocalStorePath &&
    !localStoreStatus?.isValid;

  // Dialog state management
  const dialogState = useDialogState();

  // Track if we just completed the wizard to prevent re-opening
  const [wizardJustCompleted, setWizardJustCompleted] = useState(false);

  // Kit data management
  const {
    allKitSamples,
    kits,
    loadKitsData,
    refreshAllKitsAndSamples,
    reloadCurrentKitSamples,
    sampleCounts,
  } = useKitDataManager({
    isInitialized,
    localStorePath,
    needsLocalStoreSetup: Boolean(needsLocalStoreSetup || hasInvalidLocalStore),
  });

  // Kit navigation
  const navigation = useKitNavigation({
    allKitSamples,
    kits,
    refreshAllKitsAndSamples,
  });

  // Get current kit's editable state for keyboard shortcuts
  const { kit: currentKit } = useKit({ kitName: navigation.selectedKit ?? "" });

  // Global keyboard shortcuts
  const keyboardShortcuts = useGlobalKeyboardShortcuts({
    currentKitName: navigation.selectedKit ?? undefined,
    isEditMode: currentKit?.editable ?? false,
    onBackNavigation: navigation.selectedKit
      ? () => {
          navigation.handleBack();
        }
      : undefined,
  });

  // Menu handlers
  const { kitBrowserRef } = useKitViewMenuHandlers({
    canRedo: keyboardShortcuts.canRedo,
    canUndo: keyboardShortcuts.canUndo,
    localStorePath,
    onMessage: showMessage,
    openChangeDirectory: dialogState.openChangeDirectory,
    openPreferences: dialogState.openPreferences,
    openWizard: dialogState.openWizard,
  });

  // Startup actions
  useStartupActions({
    localStorePath,
    needsLocalStoreSetup: Boolean(needsLocalStoreSetup || hasInvalidLocalStore),
  });

  // Auto-trigger wizard on startup if local store is not configured
  useEffect(() => {
    if (needsLocalStoreSetup && !wizardJustCompleted) {
      dialogState.setShowWizard(true);
    }
  }, [needsLocalStoreSetup, dialogState, wizardJustCompleted]);

  // Handle invalid local store - show error message and offer to change directory
  useEffect(() => {
    if (hasInvalidLocalStore && localStoreStatus?.error) {
      showMessage(
        `${localStoreStatus.error} Please select a new local store directory.`,
        "error",
        8000, // Show for 8 seconds
      );
      // Automatically open the change directory dialog
      dialogState.setShowChangeDirectoryDialog(true);
    }
  }, [hasInvalidLocalStore, localStoreStatus?.error, showMessage, dialogState]);

  // HMR: Restore selected kit state after hot reload
  useEffect(() => {
    restoreSelectedKitIfExists(
      kits,
      navigation.selectedKit,
      navigation.setSelectedKit,
    );
  }, [kits, navigation.selectedKit, navigation.setSelectedKit]);

  // HMR: Save selected kit state before hot reload
  useEffect(() => {
    if ((import.meta as any).hot && navigation.selectedKit) {
      saveSelectedKitState(navigation.selectedKit);
    }
  }, [navigation.selectedKit]);

  // Reset wizardJustCompleted when needsLocalStoreSetup becomes false
  useEffect(() => {
    if (!needsLocalStoreSetup && wizardJustCompleted) {
      setWizardJustCompleted(false);
    }
  }, [needsLocalStoreSetup, wizardJustCompleted]);

  // Store latest values in refs to avoid recreating event listener
  const selectedKitRef = useRef(navigation.selectedKit);
  const reloadCurrentKitSamplesRef = useRef(reloadCurrentKitSamples);

  // Update refs when values change
  useEffect(() => {
    selectedKitRef.current = navigation.selectedKit;
  }, [navigation.selectedKit]);

  useEffect(() => {
    reloadCurrentKitSamplesRef.current = reloadCurrentKitSamples;
  }, [reloadCurrentKitSamples]);

  // Listen for refresh events from undo operations - stable event listener
  useEffect(() => {
    const handleRefreshSamples = (event: Event) => {
      const customEvent = event as CustomEvent<{ kitName: string }>;
      if (customEvent.detail.kitName === selectedKitRef.current) {
        console.log(
          "[KitsView] Refreshing samples after undo operation for kit:",
          selectedKitRef.current,
        );
        reloadCurrentKitSamplesRef.current(selectedKitRef.current);
      }
    };

    document.addEventListener("romper:refresh-samples", handleRefreshSamples);

    return () => {
      document.removeEventListener(
        "romper:refresh-samples",
        handleRefreshSamples,
      );
    };
  }, []); // Empty dependency array - event listener is created only once

  // Handle samples reload request
  const handleRequestSamplesReload = useCallback(async () => {
    if (navigation.selectedKit) {
      await reloadCurrentKitSamples(navigation.selectedKit);
    }
  }, [navigation.selectedKit, reloadCurrentKitSamples]);

  // Wizard success handler
  const handleWizardSuccess = useCallback(async () => {
    setWizardJustCompleted(true);
    dialogState.closeWizard();
    await refreshLocalStoreStatus();
  }, [dialogState, refreshLocalStoreStatus]);

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="kits-view">
      {navigation.selectedKit && navigation.selectedKitSamples ? (
        <KitDetailsContainer
          kitIndex={navigation.currentKitIndex}
          kitName={navigation.selectedKit}
          kits={navigation.sortedKits}
          onAddUndoAction={keyboardShortcuts.addUndoAction}
          onBack={navigation.handleBack}
          onMessage={showMessage}
          onNextKit={navigation.handleNextKit}
          onPrevKit={navigation.handlePrevKit}
          onRequestSamplesReload={handleRequestSamplesReload}
          samples={navigation.selectedKitSamples}
        />
      ) : (
        <KitBrowserContainer
          kits={navigation.sortedKits}
          localStorePath={localStorePath}
          onMessage={showMessage}
          onRefreshKits={loadKitsData}
          onSelectKit={navigation.handleSelectKit}
          ref={kitBrowserRef}
          sampleCounts={sampleCounts}
          setLocalStorePath={setLocalStorePath}
        />
      )}

      {/* Local Store Wizard Modal */}
      <LocalStoreWizardModal
        initialError={localStoreStatus?.error}
        isOpen={dialogState.showWizard}
        onClose={dialogState.closeWizard}
        onCloseApp={
          needsLocalStoreSetup
            ? () => window.electronAPI?.closeApp?.()
            : undefined
        }
        onSuccess={handleWizardSuccess}
        setLocalStorePath={setLocalStorePath}
      />

      {/* Other Dialogs */}
      <KitViewDialogs
        onCloseChangeDirectory={dialogState.closeChangeDirectory}
        onClosePreferences={dialogState.closePreferences}
        onMessage={showMessage}
        showChangeDirectoryDialog={dialogState.showChangeDirectoryDialog}
        showPreferencesDialog={dialogState.showPreferencesDialog}
      />
    </div>
  );
};

export default KitsView;
