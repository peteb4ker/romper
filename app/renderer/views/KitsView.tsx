import React, { useCallback, useEffect, useRef, useState } from "react";

import { useDialogState } from "../components/hooks/useDialogState";
import { useGlobalKeyboardShortcuts } from "../components/hooks/useGlobalKeyboardShortcuts";
import { useKit } from "../components/hooks/useKit";
import { useKitDataManager } from "../components/hooks/useKitDataManager";
import { useKitNavigation } from "../components/hooks/useKitNavigation";
import { useKitViewMenuHandlers } from "../components/hooks/useKitViewMenuHandlers";
import { useMessageDisplay } from "../components/hooks/useMessageDisplay";
import { useStartupActions } from "../components/hooks/useStartupActions";
import KitBrowserContainer from "../components/KitBrowserContainer";
import KitDetailsContainer from "../components/KitDetailsContainer";
import KitViewDialogs from "../components/KitViewDialogs";
import LocalStoreWizardModal from "../components/LocalStoreWizardModal";
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

  // Check if local store needs to be set up
  const needsLocalStoreSetup =
    isInitialized &&
    localStoreStatus !== null &&
    (!localStoreStatus?.isValid || !localStorePath);

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
    needsLocalStoreSetup,
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
    needsLocalStoreSetup,
  });

  // Auto-trigger wizard on startup if local store is not configured
  useEffect(() => {
    if (needsLocalStoreSetup && !wizardJustCompleted) {
      dialogState.setShowWizard(true);
    }
  }, [needsLocalStoreSetup, dialogState, wizardJustCompleted]);

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
    <div className="flex flex-col h-full min-h-0">
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
        isAutoTriggered={needsLocalStoreSetup}
        isOpen={dialogState.showWizard}
        onClose={dialogState.closeWizard}
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
