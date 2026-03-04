import type { KitWithRelations } from "@romper/shared/db/schema";

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import KitDialogs from "./dialogs/KitDialogs";
import SyncUpdateDialog from "./dialogs/SyncUpdateDialog";
import ValidationResultsDialog from "./dialogs/ValidationResultsDialog";
import { useKitBrowser } from "./hooks/kit-management/useKitBrowser";
import { useKitDialogs } from "./hooks/kit-management/useKitDialogs";
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
  // Filter functionality
  favoritesCount?: number;
  getKitFavoriteState?: (kitName: string) => boolean;
  handleToggleFavorite?: (kitName: string) => void;

  handleToggleFavoritesFilter?: () => void;
  handleToggleModifiedFilter?: () => void;
  isSearching?: boolean;
  // Core data
  kits?: KitWithRelations[];
  localStorePath: null | string;
  modifiedCount?: number;
  onAboutClick?: () => void;
  // Core actions
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: () => Promise<void>;

  onSearchChange?: (query: string) => void;
  onSearchClear?: () => void;
  onSelectKit: (kitName: string) => void;
  onShowSettings: () => void;
  sampleCounts?: Record<string, [number, number, number, number]>;

  // Search functionality
  searchQuery?: string;
  searchResultCount?: number;
  setLocalStorePath?: (path: string) => void;
  showFavoritesOnly?: boolean;
  showModifiedOnly?: boolean;
}

// Constants
const SCROLL_DELAY_MS = 100;

const KitBrowser = React.forwardRef<KitBrowserHandle, KitBrowserProps>(
  (props, ref) => {
    const {
      // Use props from parent instead of duplicate hook
      favoritesCount,
      handleToggleFavorite,
      handleToggleFavoritesFilter,
      handleToggleModifiedFilter,
      modifiedCount,
      onMessage,
      onRefreshKits,
      setLocalStorePath,
      showFavoritesOnly,
      showModifiedOnly,
    } = props;
    const kitGridRef = useRef<KitGridHandle>(null);

    // Create wrapper function for async onRefreshKits to match void return expectation
    const handleRefreshKits = useCallback(() => {
      if (onRefreshKits) {
        onRefreshKits().catch((error) => {
          console.error("Failed to refresh kits:", error);
          onMessage?.("Failed to refresh kits", "error");
        });
      }
    }, [onRefreshKits, onMessage]);

    // Use kits directly from props since filtering is done by the parent useKitFilters hook
    const filteredKits = props.kits ?? [];

    // Create wrapper function for async onRefreshKits with scrollToKit parameter
    const handleRefreshKitsWithScroll = useCallback(
      (scrollToKit?: string) => {
        if (onRefreshKits) {
          onRefreshKits().catch((error) => {
            console.error("Failed to refresh kits:", error);
            onMessage?.("Failed to refresh kits", "error");
          });
        }
        // If scrollToKit is provided, scroll to that kit after a short delay using React ref
        if (scrollToKit && kitGridRef.current) {
          setTimeout(() => {
            kitGridRef.current?.scrollToKit(scrollToKit);
          }, SCROLL_DELAY_MS);
        }
      },
      [onRefreshKits, onMessage],
    );

    const logic = useKitBrowser({
      kitListRef: kitGridRef,
      kits: filteredKits,
      onMessage: props.onMessage,
      onRefreshKits: handleRefreshKitsWithScroll,
    });
    const {
      bankNames,
      duplicateKitDest,
      duplicateKitError,
      duplicateKitSource,
      focusedKit,
      globalBankHotkeyHandler,
      handleCreateKitInBank,
      handleDuplicateKit,
      handleVisibleBankChange,
      isCreatingKit,
      kits,
      scrollContainerRef,
      selectedBank,
      setDuplicateKitDest,
      setDuplicateKitSource,
      setFocusedKit,
    } = logic;

    // Compute whether filters are active (hide add-kit cards when filtered)
    const isFiltered =
      !!props.searchQuery?.trim() || !!showFavoritesOnly || !!showModifiedOnly;

    // Dialog management hook
    const dialogs = useKitDialogs({ onMessage, setLocalStorePath });
    const {
      handleCloseValidationDialog,
      handleShowLocalStoreWizard,
      localStoreWizardProps,
      showLocalStoreWizard,
      showValidationDialog,
    } = dialogs;

    // Sync functionality hook
    const sync = useKitSync({ onMessage, onRefreshKits });
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
      onToggleFavorite: handleToggleFavorite,
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
      onRefreshKits: handleRefreshKits,
    });

    // Expose handleScanAllKits through ref for parent components
    useImperativeHandle(ref, () => ({
      handleScanAllKits,
    }));

    return (
      <div
        className="h-full min-h-0 flex-1 flex flex-col bg-surface-1 rounded"
        ref={scrollContainerRef}
      >
        <KitBrowserHeader
          favoritesCount={favoritesCount}
          isSearching={props.isSearching}
          modifiedCount={modifiedCount}
          onAboutClick={props.onAboutClick}
          onSearchChange={props.onSearchChange}
          onSearchClear={props.onSearchClear}
          onShowLocalStoreWizard={handleShowLocalStoreWizard}
          onShowSettings={props.onShowSettings}
          onSyncToSdCard={handleSyncToSdCard}
          onToggleFavoritesFilter={handleToggleFavoritesFilter}
          onToggleModifiedFilter={handleToggleModifiedFilter}
          // Search props
          searchQuery={props.searchQuery}
          searchResultCount={props.searchResultCount}
          showFavoritesOnly={showFavoritesOnly}
          showModifiedOnly={showModifiedOnly}
        />
        <KitDialogs
          duplicateKitDest={duplicateKitDest}
          duplicateKitError={duplicateKitError}
          duplicateKitSource={duplicateKitSource}
          onCancelDuplicateKit={() => {
            setDuplicateKitSource(null);
            setDuplicateKitDest("");
            logic.setDuplicateKitError(null);
          }}
          onDuplicateKit={handleDuplicateKit}
          onDuplicateKitDestChange={setDuplicateKitDest}
          showDuplicateKit={!!duplicateKitSource}
        />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-row">
          <KitBankNav
            bankNames={bankNames}
            kits={kits}
            onBankClick={onBankClickWithScroll}
            selectedBank={selectedBank}
          />
          <KitGrid
            bankNames={bankNames}
            focusedKit={focusedKit}
            getKitFavoriteState={props.getKitFavoriteState}
            isCreatingKit={isCreatingKit}
            isFiltered={isFiltered}
            kitData={kits}
            kits={kits}
            onBankFocus={handleBankFocus}
            onCreateKitInBank={handleCreateKitInBank}
            onDuplicate={(kit) => {
              setDuplicateKitSource(kit);
              setDuplicateKitDest("");
              logic.setDuplicateKitError(null);
            }}
            onFocusKit={setFocusedKit} // NEW: keep parent in sync
            onSelectKit={props.onSelectKit}
            onToggleFavorite={handleToggleFavorite} // Task 20.1.2: Favorites toggle functionality
            onVisibleBankChange={handleVisibleBankChange} // NEW: update selected bank on scroll
            ref={kitGridRef}
            sampleCounts={props.sampleCounts}
          />
        </div>
        {/* Local Store Wizard Modal */}
        {showLocalStoreWizard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-surface-2 rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-border-subtle p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold mb-4 text-text-primary">
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
