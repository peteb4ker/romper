import React, { useCallback, useEffect } from "react";

import CriticalErrorDialog from "../components/dialogs/CriticalErrorDialog";
import InvalidLocalStoreDialog from "../components/dialogs/InvalidLocalStoreDialog";
import { EnvironmentBanner } from "../components/EnvironmentBanner";
import { useKitDataManager } from "../components/hooks/kit-management/useKitDataManager";
import { useKitFilters } from "../components/hooks/kit-management/useKitFilters";
import { useKitNavigation } from "../components/hooks/kit-management/useKitNavigation";
import { useKitSearch } from "../components/hooks/kit-management/useKitSearch";
import { useKitViewMenuHandlers } from "../components/hooks/kit-management/useKitViewMenuHandlers";
import { useLocalStoreSetupFlow } from "../components/hooks/kit-management/useLocalStoreSetupFlow";
import { useSampleRefreshListener } from "../components/hooks/kit-management/useSampleRefreshListener";
import { useDialogState } from "../components/hooks/shared/useDialogState";
import { useGlobalKeyboardShortcuts } from "../components/hooks/shared/useGlobalKeyboardShortcuts";
import { useMessageDisplay } from "../components/hooks/shared/useMessageDisplay";
import { useStartupActions } from "../components/hooks/shared/useStartupActions";
import KitBrowserContainer from "../components/KitBrowserContainer";
import KitEditorContainer from "../components/KitEditorContainer";
import KitViewDialogs from "../components/KitViewDialogs";
import LocalStoreWizardModal from "../components/LocalStoreWizardModal";
import { saveSelectedKitState } from "../utils/hmrStateManager";
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

  // Dialog state management
  const dialogState = useDialogState();

  // Local store configuration gate (setup wizard / invalid store / critical
  // environment error scenarios) and the wizard lifecycle around it
  const setupFlow = useLocalStoreSetupFlow({
    closeWizard: dialogState.closeWizard,
    isInitialized,
    localStoreStatus,
    refreshLocalStoreStatus,
    setShowWizard: dialogState.setShowWizard,
  });

  // Kit data management
  const {
    allKitSamples,
    getKitByName,
    kits,
    refreshAllKitsAndSamples,
    refreshSingleKitMetadata,
    reloadCurrentKitSamples,
    sampleCounts,
    toggleKitEditable,
    toggleKitFavorite,
    updateKitAlias,
  } = useKitDataManager({
    isInitialized,
    localStorePath,
    needsLocalStoreSetup:
      setupFlow.needsLocalStoreSetup || setupFlow.hasInvalidLocalStore,
  });

  // Kit navigation
  const navigation = useKitNavigation({
    allKitSamples,
    kits,
    refreshAllKitsAndSamples,
  });

  // Kit search functionality
  const search = useKitSearch({
    allKitSamples,
    kits,
  });

  // No-op message function for filters
  const noOpMessage = useCallback(() => {}, []);

  // Kit filters management for favorites functionality (applied after search)
  const kitFilters = useKitFilters({
    kits: search.filteredKits,
    onMessage: noOpMessage,
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
          void navigation.handleBack();
        }
      : undefined,
  });

  // Menu handlers
  const { kitBrowserRef } = useKitViewMenuHandlers({
    canRedo: keyboardShortcuts.canRedo,
    canUndo: keyboardShortcuts.canUndo,
    onMessage: showMessage,
    openChangeDirectory: dialogState.openChangeDirectory,
    openPreferences: dialogState.openPreferences,
  });

  // Startup actions
  useStartupActions({
    localStorePath,
    needsLocalStoreSetup:
      setupFlow.needsLocalStoreSetup || setupFlow.hasInvalidLocalStore,
  });

  // HMR: Save selected kit state before hot reload
  useEffect(() => {
    if ((import.meta as { hot?: unknown }).hot && navigation.selectedKit) {
      saveSelectedKitState(navigation.selectedKit);
    }
  }, [navigation.selectedKit]);

  // Reload the selected kit's samples when undo operations request it
  useSampleRefreshListener({
    reloadCurrentKitSamples,
    selectedKit: navigation.selectedKit,
  });

  // Handle samples reload request
  const handleRequestSamplesReload = useCallback(async () => {
    if (navigation.selectedKit) {
      await reloadCurrentKitSamples(navigation.selectedKit);
    }
  }, [navigation.selectedKit, reloadCurrentKitSamples]);

  // Handle targeted kit metadata refresh (voice aliases only, no sample reload)
  const handleRefreshKitMetadata = useCallback(async () => {
    if (navigation.selectedKit) {
      await refreshSingleKitMetadata(navigation.selectedKit);
    }
  }, [navigation.selectedKit, refreshSingleKitMetadata]);

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="kits-view">
      {/* Environment Variable Test Mode Banner */}
      {setupFlow.showEnvironmentBanner &&
        setupFlow.isEnvironmentOverride &&
        !setupFlow.hasCriticalEnvironmentError &&
        !setupFlow.isTestEnvironment && (
          <EnvironmentBanner
            localStorePath={localStoreStatus?.localStorePath}
            onDismiss={setupFlow.dismissEnvironmentBanner}
          />
        )}

      {navigation.selectedKit && navigation.selectedKitSamples && currentKit ? (
        <KitEditorContainer
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
          onRefreshKitMetadata={handleRefreshKitMetadata}
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
          isSearching={search.isSearching}
          // Other props
          kits={kitFilters.filteredKits}
          localStorePath={localStorePath}
          modifiedCount={kitFilters.modifiedCount}
          onAboutClick={() =>
            globalThis.dispatchEvent(new CustomEvent("menu-about"))
          }
          onMessage={showMessage}
          onRefreshKits={refreshAllKitsAndSamples}
          onSearchChange={search.searchChange}
          onSearchClear={search.clearSearch}
          onSelectKit={navigation.handleSelectKit}
          onShowSettings={dialogState.openPreferences}
          ref={kitBrowserRef}
          sampleCounts={sampleCounts}
          // Search props
          searchQuery={search.searchQuery}
          searchResultCount={search.searchResultCount}
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
          setupFlow.needsLocalStoreSetup
            ? () => globalThis.electronAPI?.closeApp?.()
            : undefined
        }
        onInitializationChange={setupFlow.setIsWizardInitializing}
        onSuccess={setupFlow.handleWizardSuccess}
        setLocalStorePath={setLocalStorePath}
      />

      {/* Invalid Local Store Modal - Blocking Dialog for C1-C6 scenarios */}
      <InvalidLocalStoreDialog
        errorMessage={
          localStoreStatus?.error || "Invalid local store configuration"
        }
        isOpen={
          setupFlow.hasInvalidLocalStore &&
          !setupFlow.hasCriticalEnvironmentError &&
          !setupFlow.isWizardInitializing
        }
        localStorePath={localStoreStatus?.localStorePath || null}
        onMessage={showMessage}
      />

      {/* Critical Environment Error Dialog */}
      <CriticalErrorDialog
        isOpen={Boolean(setupFlow.hasCriticalEnvironmentError)}
        message={`The environment variable ROMPER_LOCAL_PATH is set to "${localStoreStatus?.localStorePath}" but this path is invalid: ${localStoreStatus?.error}. The application cannot continue with an invalid environment override.`}
        onConfirm={setupFlow.handleCriticalError}
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
