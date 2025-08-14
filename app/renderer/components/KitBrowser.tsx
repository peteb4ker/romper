import type { KitWithRelations } from "@romper/shared/db/schema";

import React, { useEffect, useImperativeHandle, useRef } from "react";

import KitDialogs from "./dialogs/KitDialogs";
import SyncUpdateDialog from "./dialogs/SyncUpdateDialog";
import ValidationResultsDialog from "./dialogs/ValidationResultsDialog";
import { useKitBrowser } from "./hooks/kit-management/useKitBrowser";
import { useKitDialogs } from "./hooks/kit-management/useKitDialogs";
import { useKitFilters } from "./hooks/kit-management/useKitFilters";
import { useKitKeyboardNav } from "./hooks/kit-management/useKitKeyboardNav";
import { useKitScan } from "./hooks/kit-management/useKitScan";
import { useKitSync } from "./hooks/kit-management/useKitSync";
import KitBankNav from "./KitBankNav";
import KitBrowserHeader from "./KitBrowserHeader";
import KitGrid, { KitGridHandle } from "./KitGrid";
import LocalStoreWizardUI from "./LocalStoreWizardUI";

export interface KitBrowserHandle {
  handleScanAllKits: () => void;
}

interface KitBrowserProps {
  kits?: KitWithRelations[];
  localStorePath: null | string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: () => void;
  onSelectKit: (kitName: string) => void;
  sampleCounts?: Record<string, [number, number, number, number]>;
  setLocalStorePath?: (path: string) => void;
}

const KitBrowser = React.forwardRef<KitBrowserHandle, KitBrowserProps>(
  (props, ref) => {
    const { onMessage, setLocalStorePath } = props;
    const kitGridRef = useRef<KitGridHandle>(null);

    // Filter management hook
    const filters = useKitFilters({
      kits: props.kits,
      onMessage,
      onRefreshKits: props.onRefreshKits,
    });
    const {
      favoritesCount,
      filteredKits,
      handleToggleFavorite,
      handleToggleFavoritesFilter,
      handleToggleModifiedFilter,
      modifiedCount,
      showFavoritesOnly,
      showModifiedOnly,
    } = filters;

    const logic = useKitBrowser({
      kitListRef: kitGridRef,
      kits: filteredKits,
      onMessage: props.onMessage,
      onRefreshKits: props.onRefreshKits,
    });
    const {
      bankNames,
      duplicateKitDest,
      duplicateKitError,
      duplicateKitSource,
      focusedKit,
      globalBankHotkeyHandler,
      handleCreateKit,
      handleCreateNextKit,
      handleDuplicateKit,
      handleVisibleBankChange,
      kits,
      newKitError,
      newKitSlot,
      nextKitSlot,
      scrollContainerRef,
      selectedBank,
      setDuplicateKitDest,
      setDuplicateKitSource,
      setFocusedKit,
      setNewKitSlot,
      setShowNewKit,
      showNewKit,
    } = logic;

    // Dialog management hook
    const dialogs = useKitDialogs({ onMessage, setLocalStorePath });
    const {
      handleCloseValidationDialog,
      handleShowLocalStoreWizard,
      handleShowValidationDialog,
      localStoreWizardProps,
      showLocalStoreWizard,
      showValidationDialog,
    } = dialogs;

    // Sync functionality hook
    const sync = useKitSync({ onMessage });
    const {
      currentChangeSummary,
      currentSyncKit,
      generateChangeSummary,
      handleCloseSyncDialog,
      handleConfirmSync,
      handleSyncToSdCard,
      isSyncLoading,
      onSdCardPathChange,
      sdCardPath,
      showSyncDialog,
      syncProgress,
    } = sync;

    // Keyboard navigation hook
    useKitKeyboardNav({
      focusedKit,
      globalBankHotkeyHandler,
      onToggleFavorite: (kitName: string) => {
        void handleToggleFavorite(kitName);
      },
    });

    // Effect handlers for messages
    useEffect(() => {
      if (logic.sdCardWarning && onMessage) {
        onMessage(logic.sdCardWarning, "warning", 5000);
      }
    }, [logic.sdCardWarning, onMessage]);

    useEffect(() => {
      if (logic.error && onMessage) {
        onMessage(logic.error, "error", 7000);
      }
    }, [logic.error, onMessage]);

    // Handler for KitBankNav and KitGrid keyboard navigation
    const focusBankInKitGrid = (bank: string) => {
      if (logic.focusBankInKitList) logic.focusBankInKitList(bank);
    };

    // Handler for KitBankNav (renamed to avoid conflict)
    const onBankClickWithScroll = (bank: string) => {
      focusBankInKitGrid(bank);
    };

    // Handler for KitGrid keyboard navigation to update selectedBank
    const handleBankFocus = (bank: string) => {
      focusBankInKitGrid(bank);
    };

    // Use the new useKitScan hook for scanning logic
    const { handleScanAllKits } = useKitScan({
      kits,
      onRefreshKits: props.onRefreshKits,
    });

    // Expose handleScanAllKits through ref for parent components
    useImperativeHandle(ref, () => ({
      handleScanAllKits,
    }));

    return (
      <div
        className="h-full min-h-0 flex-1 flex flex-col bg-gray-50 dark:bg-slate-800 rounded"
        ref={scrollContainerRef}
      >
        <KitBrowserHeader
          bankNav={
            <KitBankNav
              bankNames={bankNames}
              kits={kits}
              onBankClick={onBankClickWithScroll}
              selectedBank={selectedBank}
            />
          }
          favoritesCount={favoritesCount}
          modifiedCount={modifiedCount}
          nextKitSlot={nextKitSlot}
          onCreateNextKit={handleCreateNextKit}
          onScanAllKits={handleScanAllKits}
          onShowLocalStoreWizard={handleShowLocalStoreWizard}
          onShowNewKit={() => setShowNewKit(true)}
          onSyncToSdCard={handleSyncToSdCard}
          onToggleFavoritesFilter={handleToggleFavoritesFilter}
          onToggleModifiedFilter={handleToggleModifiedFilter}
          onValidateLocalStore={handleShowValidationDialog}
          showFavoritesOnly={showFavoritesOnly}
          showModifiedOnly={showModifiedOnly}
        />
        <KitDialogs
          duplicateKitDest={duplicateKitDest}
          duplicateKitError={duplicateKitError}
          duplicateKitSource={duplicateKitSource}
          newKitError={newKitError}
          newKitSlot={newKitSlot}
          onCancelDuplicateKit={() => {
            setDuplicateKitSource(null);
            setDuplicateKitDest("");
            logic.setDuplicateKitError(null);
          }}
          onCancelNewKit={() => {
            setShowNewKit(false);
            setNewKitSlot("");
            // Fix: setNewKitError and setDuplicateKitError should be called from logic, not as standalone names
            logic.setNewKitError(null);
          }}
          onCreateKit={handleCreateKit}
          onDuplicateKit={handleDuplicateKit}
          onDuplicateKitDestChange={setDuplicateKitDest}
          onNewKitSlotChange={setNewKitSlot}
          showDuplicateKit={!!duplicateKitSource}
          showNewKit={showNewKit}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <KitGrid
            bankNames={bankNames}
            focusedKit={focusedKit}
            kitData={kits}
            kits={kits}
            onBankFocus={handleBankFocus}
            onDuplicate={(kit) => {
              setDuplicateKitSource(kit);
              setDuplicateKitDest("");
              logic.setDuplicateKitError(null);
            }}
            onFocusKit={setFocusedKit} // NEW: keep parent in sync
            onSelectKit={props.onSelectKit}
            onVisibleBankChange={handleVisibleBankChange} // NEW: update selected bank on scroll
            ref={kitGridRef}
            sampleCounts={props.sampleCounts}
            // onToggleFavorite={handleToggleFavorite} // Task 20.1.2: Favorites toggle - temporarily disabled
          />
        </div>
        {/* Local Store Wizard Modal */}
        {showLocalStoreWizard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-slate-900 rounded shadow-lg p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold mb-4">
                Romper Local Store Setup
              </h2>
              <LocalStoreWizardUI {...localStoreWizardProps} />
            </div>
          </div>
        )}

        {/* ValidationResultsDialog */}
        {showValidationDialog && (
          <ValidationResultsDialog
            isOpen={showValidationDialog}
            localStorePath={props.localStorePath || undefined}
            onClose={handleCloseValidationDialog}
            onMessage={props.onMessage}
          />
        )}

        {/* SyncUpdateDialog */}
        {showSyncDialog && currentSyncKit && (
          <SyncUpdateDialog
            isLoading={isSyncLoading}
            isOpen={showSyncDialog}
            kitName={currentSyncKit}
            localChangeSummary={currentChangeSummary}
            onClose={handleCloseSyncDialog}
            onConfirm={handleConfirmSync}
            onGenerateChangeSummary={generateChangeSummary}
            onSdCardPathChange={onSdCardPathChange}
            sdCardPath={sdCardPath}
            syncProgress={syncProgress}
          />
        )}
      </div>
    );
  },
);

export default React.memo(KitBrowser);
