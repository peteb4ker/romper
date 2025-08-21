import React, { useCallback, useEffect, useRef, useState } from "react";

import CriticalErrorDialog from "../components/dialogs/CriticalErrorDialog";
import InvalidLocalStoreDialog from "../components/dialogs/InvalidLocalStoreDialog";
import { useKitDataManager } from "../components/hooks/kit-management/useKitDataManager";
import { useKitFilters } from "../components/hooks/kit-management/useKitFilters";
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

  // Determine local store configuration state according to requirements
  // A1-A3: No local store configured - show setup wizard
  // Also includes test environment overrides with invalid paths (for wizard tests)
  const isTestEnvironment =
    (import.meta.env as ImportMeta["env"] & { MODE?: string; VITE_ROMPER_TEST_MODE?: string }).MODE === "test" ||
    (import.meta.env as ImportMeta["env"] & { MODE?: string; VITE_ROMPER_TEST_MODE?: string }).VITE_ROMPER_TEST_MODE === "true";
  const isEnvironmentOverride =
    localStoreStatus?.isEnvironmentOverride || false;
  const needsLocalStoreSetup =
    isInitialized &&
    localStoreStatus !== null &&
    (!localStoreStatus.hasLocalStore ||
      (isTestEnvironment &&
        isEnvironmentOverride &&
        !localStoreStatus.isValid));

  // D: Environment variable override - show test mode banner

  // C1-C6: Local store configured but invalid - show modal blocking error dialog
  // Exception: In test environment with env override, don't block - let tests proceed
  const hasInvalidLocalStore =
    isInitialized &&
    localStoreStatus !== null &&
    Boolean(localStoreStatus.hasLocalStore) &&
    !localStoreStatus.isValid &&
    !(isTestEnvironment && isEnvironmentOverride);

  // Critical environment variable error - should close app
  const hasCriticalEnvironmentError = Boolean(
    localStoreStatus?.isCriticalEnvironmentError,
  );

  const [showEnvironmentBanner, setShowEnvironmentBanner] = useState(false);

  // Show environment banner when environment override is detected
  useEffect(() => {
    if (isEnvironmentOverride) {
      setShowEnvironmentBanner(true);
    }
  }, [isEnvironmentOverride]);

  // Dialog state management
  const dialogState = useDialogState();

  // Track if we just completed the wizard to prevent re-opening
  const [wizardJustCompleted, setWizardJustCompleted] = useState(false);

  // Track wizard initialization state to suppress invalid store dialog
  const [isWizardInitializing, setIsWizardInitializing] = useState(false);

  // Kit data management
  const {
    allKitSamples,
    getKitByName,
    kits,
    refreshAllKitsAndSamples,
    reloadCurrentKitSamples,
    sampleCounts,
    toggleKitEditable,
    toggleKitFavorite,
    updateKitAlias,
  } = useKitDataManager({
    isInitialized,
    localStorePath,
    needsLocalStoreSetup: needsLocalStoreSetup || hasInvalidLocalStore,
  });

  // Kit navigation
  const navigation = useKitNavigation({
    allKitSamples,
    kits,
    refreshAllKitsAndSamples,
  });

  // Kit filters management for favorites functionality
  const kitFilters = useKitFilters({
    kits,
    onMessage: showMessage,
  });

  // Get current kit from shared data for keyboard shortcuts
  const currentKit = navigation.selectedKit
    ? getKitByName(navigation.selectedKit)
    : undefined;

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
    needsLocalStoreSetup: needsLocalStoreSetup || hasInvalidLocalStore,
  });

  // Auto-trigger wizard on startup if local store is not configured
  useEffect(() => {
    if (needsLocalStoreSetup && !wizardJustCompleted) {
      dialogState.setShowWizard(true);
    }
  }, [needsLocalStoreSetup, dialogState, wizardJustCompleted]);

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
    if ((import.meta as ImportMeta & { hot?: unknown }).hot && navigation.selectedKit) {
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

  // Critical error handler
  const handleCriticalError = useCallback(() => {
    if (window.electronAPI?.closeApp) {
      window.electronAPI.closeApp();
    } else {
      // Fallback for development or if API is not available
      window.close();
    }
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="kits-view">
      {/* Environment Variable Test Mode Banner */}
      {showEnvironmentBanner &&
        isEnvironmentOverride &&
        !hasCriticalEnvironmentError &&
        !isTestEnvironment && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-yellow-700 text-sm font-medium">
                  🧪 Test Mode: Using ROMPER_LOCAL_PATH environment override
                </span>
                <span className="ml-2 text-yellow-600 text-xs font-mono">
                  {localStoreStatus?.localStorePath}
                </span>
              </div>
              <button
                className="text-yellow-600 hover:text-yellow-800 text-sm"
                onClick={() => setShowEnvironmentBanner(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

      {navigation.selectedKit && navigation.selectedKitSamples && currentKit ? (
        <KitDetailsContainer
          kit={currentKit}
          kitIndex={navigation.currentKitIndex}
          kitName={navigation.selectedKit}
          kits={navigation.sortedKits}
          onAddUndoAction={keyboardShortcuts.addUndoAction}
          onBack={navigation.handleBack}
          onKitUpdated={refreshAllKitsAndSamples}
          onMessage={showMessage}
          onNextKit={navigation.handleNextKit}
          onPrevKit={navigation.handlePrevKit}
          onRequestSamplesReload={handleRequestSamplesReload}
          onToggleEditableMode={toggleKitEditable}
          onToggleFavorite={toggleKitFavorite}
          onUpdateKitAlias={updateKitAlias}
          samples={navigation.selectedKitSamples}
        />
      ) : (
        <KitBrowserContainer
          // Favorites filter props
          favoritesCount={kitFilters.favoritesCount}
          getKitFavoriteState={kitFilters.getKitFavoriteState}
          handleToggleFavorite={kitFilters.handleToggleFavorite}
          handleToggleFavoritesFilter={kitFilters.handleToggleFavoritesFilter}
          handleToggleModifiedFilter={kitFilters.handleToggleModifiedFilter}
          // Other props
          kits={kitFilters.filteredKits}
          localStorePath={localStorePath}
          modifiedCount={kitFilters.modifiedCount}
          onMessage={showMessage}
          onRefreshKits={refreshAllKitsAndSamples}
          onSelectKit={navigation.handleSelectKit}
          onShowSettings={dialogState.openPreferences}
          ref={kitBrowserRef}
          sampleCounts={sampleCounts}
          setLocalStorePath={setLocalStorePath}
          showFavoritesOnly={kitFilters.showFavoritesOnly}
          showModifiedOnly={kitFilters.showModifiedOnly}
        />
      )}

      {/* Local Store Wizard Modal */}
      <LocalStoreWizardModal
        isOpen={dialogState.showWizard}
        onClose={dialogState.closeWizard}
        onCloseApp={
          needsLocalStoreSetup
            ? () => window.electronAPI?.closeApp?.()
            : undefined
        }
        onInitializationChange={setIsWizardInitializing}
        onSuccess={handleWizardSuccess}
        setLocalStorePath={setLocalStorePath}
      />

      {/* Invalid Local Store Modal - Blocking Dialog for C1-C6 scenarios */}
      <InvalidLocalStoreDialog
        errorMessage={
          localStoreStatus?.error || "Invalid local store configuration"
        }
        isOpen={
          hasInvalidLocalStore &&
          !hasCriticalEnvironmentError &&
          !isWizardInitializing
        }
        localStorePath={localStoreStatus?.localStorePath || null}
        onMessage={showMessage}
      />

      {/* Critical Environment Error Dialog */}
      <CriticalErrorDialog
        isOpen={Boolean(hasCriticalEnvironmentError)}
        message={`The environment variable ROMPER_LOCAL_PATH is set to "${localStoreStatus?.localStorePath}" but this path is invalid: ${localStoreStatus?.error}. The application cannot continue with an invalid environment override.`}
        onConfirm={handleCriticalError}
        title="Critical Configuration Error"
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
