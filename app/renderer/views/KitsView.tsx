import React, { useCallback, useEffect, useMemo, useRef } from "react";

import CriticalErrorDialog from "../components/dialogs/CriticalErrorDialog";
import InvalidLocalStoreDialog from "../components/dialogs/InvalidLocalStoreDialog";
import { EnvironmentBanner } from "../components/EnvironmentBanner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useKitDataManager } from "../components/hooks/kit-management/useKitDataManager";
import { useKitFilters } from "../components/hooks/kit-management/useKitFilters";
import { useKitNavigation } from "../components/hooks/kit-management/useKitNavigation";
import {
  type BulkScanProgress,
  useKitScan,
} from "../components/hooks/kit-management/useKitScan";
import { useKitSearch } from "../components/hooks/kit-management/useKitSearch";
import { useKitViewMenuHandlers } from "../components/hooks/kit-management/useKitViewMenuHandlers";
import { useLocalStoreSetupFlow } from "../components/hooks/kit-management/useLocalStoreSetupFlow";
import { useSampleRefreshListener } from "../components/hooks/kit-management/useSampleRefreshListener";
import { useDialogState } from "../components/hooks/shared/useDialogState";
import { useGlobalKeyboardShortcuts } from "../components/hooks/shared/useGlobalKeyboardShortcuts";
import { useMessageApi } from "../components/hooks/shared/useMessageApi";
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

  // The app-wide toast stack (main.tsx). Calling useMessageDisplay here
  // made a second, unrendered stack, so no message from this view showed
  // (RE-11).
  const { showMessage } = useMessageApi();

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

  // Kit filters management for favorites functionality (applied after search)
  const kitFilters = useKitFilters({
    kits: search.filteredKits,
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
          void navigation.handleBack();
        }
      : undefined,
  });

  // Scan All covers every kit in the store, not the kits the current search
  // or filters show, and runs from the kit editor too (RE-43). The browser
  // header shows its progress; with the editor open, the result is a toast.
  const selectedKitRef = useRef(navigation.selectedKit);
  useEffect(() => {
    selectedKitRef.current = navigation.selectedKit;
  }, [navigation.selectedKit]);
  const handleScanAllFinished = useCallback(
    (progress: BulkScanProgress) => {
      if (!selectedKitRef.current) return;
      if (progress.status === "complete") {
        showMessage(progress.message, "success");
      } else if (progress.status === "error") {
        showMessage(progress.message, "error");
      }
    },
    [showMessage],
  );
  const { bulkScanProgress, handleScanAllKits } = useKitScan({
    kits,
    onFinished: handleScanAllFinished,
    onRefreshKits: refreshAllKitsAndSamples,
  });

  // Menu handlers
  useKitViewMenuHandlers({
    onMessage: showMessage,
    onRedo: keyboardShortcuts.redoIfAllowed,
    onScanAllKits: handleScanAllKits,
    onUndo: keyboardShortcuts.undoIfAllowed,
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

  // Reload the selected kit's samples and data (its sequence) when undo
  // operations request it
  useSampleRefreshListener({
    refreshKitMetadata: refreshSingleKitMetadata,
    reloadCurrentKitSamples,
    selectedKit: navigation.selectedKit,
  });

  // Lets the sequencer's Undo button undo its own edits
  const { nextUndo, undo } = keyboardShortcuts;
  const sequenceUndo = useMemo(
    () => ({
      canUndo: nextUndo?.type === "SEQUENCE_EDIT",
      undo: () => void undo(),
    }),
    [nextUndo, undo],
  );

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
        !setupFlow.hasCriticalEnvironmentError && (
          <EnvironmentBanner
            localStorePath={localStoreStatus?.localStorePath}
            onDismiss={setupFlow.dismissEnvironmentBanner}
          />
        )}

      {navigation.selectedKit && navigation.selectedKitSamples && currentKit ? (
        <ErrorBoundary
          area="Kit editor"
          backLabel="Back to kits"
          onBack={() => {
            void navigation.handleBack();
          }}
          resetKey={navigation.selectedKit}
        >
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
            sequenceUndo={sequenceUndo}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary area="Kit list">
          <KitBrowserContainer
            bulkScanProgress={bulkScanProgress}
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
            sampleCounts={sampleCounts}
            // Search props
            searchQuery={search.searchQuery}
            searchResultCount={search.searchResultCount}
            setLocalStorePath={setLocalStorePath}
            showFavoritesOnly={kitFilters.showFavoritesOnly}
            showModifiedOnly={kitFilters.showModifiedOnly}
          />
        </ErrorBoundary>
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
        // Forgetting the saved store opens the setup wizard (RE-80)
        onRerunWizard={() => void setLocalStorePath(null)}
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
