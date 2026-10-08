import type { KitWithRelations } from "@romper/shared/db/schema";

import React, { useCallback, useRef } from "react";

import type { BulkScanProgress } from "./hooks/kit-management/useKitScan";

import LiveSyncUpdateDialog from "./dialogs/LiveSyncUpdateDialog";
import ValidationResultsDialog from "./dialogs/ValidationResultsDialog";
import { useKitBrowser } from "./hooks/kit-management/useKitBrowser";
import { useKitDeletion } from "./hooks/kit-management/useKitDeletion";
import { useKitDialogs } from "./hooks/kit-management/useKitDialogs";
import { useKitKeyboardNav } from "./hooks/kit-management/useKitKeyboardNav";
import { useKitSync } from "./hooks/kit-management/useKitSync";
import KitBankNav from "./KitBankNav";
import KitBrowserHeader from "./KitBrowserHeader";
import KitGrid, { KitGridHandle } from "./KitGrid";

interface KitBrowserProps {
  /** Scan All's progress; the scan itself runs in KitsView (RE-43) */
  bulkScanProgress?: BulkScanProgress;
  // Filter functionality
  favoritesCount?: number;
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
  /** Clears a Scan All result that stays because kits failed (#586) */
  onDismissBulkScan?: () => void;
  /** Adds a kit just created or copied, as main returned it (#452) */
  onKitAdded?: (kit: KitWithRelations) => void;
  /** Takes a deleted kit off the list (#452) */
  onKitDeleted?: (kitName: string) => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: () => Promise<void>;

  onSearchChange?: (query: string) => void;
  onSearchClear?: () => void;
  onSelectKit: (kitName: string) => void;
  onShowSettings: () => void;
  sampleCounts?: Record<string, [number, number, number, number]>;

  // Search functionality
  searchQuery?: string;
  showFavoritesOnly?: boolean;
  showModifiedOnly?: boolean;
}

// Constants
const SCROLL_DELAY_MS = 100;

// The grid's card duplicate action is its own popover (onDuplicateKit); one
// no-op, so the memoized grid gets the same prop each render (#462)
const noop = () => {};

const KitBrowser: React.FC<KitBrowserProps> = (props) => {
  const {
    // Use props from parent instead of duplicate hook
    favoritesCount,
    handleToggleFavorite,
    handleToggleFavoritesFilter,
    handleToggleModifiedFilter,
    modifiedCount,
    onKitAdded,
    onKitDeleted,
    onMessage,
    onRefreshKits,
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

  // Use kits directly from props since filtering is done by the parent
  // useKitFilters hook. useKitBrowser gives no kits one shared empty list.
  const filteredKits = props.kits;

  // Create wrapper function for async onRefreshKits with scrollToKit parameter
  // A new kit main returned goes on the list without reading every kit
  // (#452); otherwise the kits are read again
  const handleRefreshKitsWithScroll = useCallback(
    (scrollToKit?: string, created?: KitWithRelations) => {
      if (created && onKitAdded) {
        onKitAdded(created);
      } else if (onRefreshKits) {
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
    [onKitAdded, onRefreshKits, onMessage],
  );

  const logic = useKitBrowser({
    kitListRef: kitGridRef,
    kits: filteredKits,
    localStorePath: props.localStorePath,
    onMessage: props.onMessage,
    onRefreshKits: handleRefreshKitsWithScroll,
  });
  const {
    bankNames,
    duplicateKitDirect,
    focusedKit,
    globalBankHotkeyHandler,
    handleBankNameChange,
    handleCreateKitInBank,
    handleVisibleBankChange,
    isCreatingKit,
    kits,
    scrollContainerRef,
    selectedBank,
    setFocusedKit,
    showEmptyBank,
    shownEmptyBank,
  } = logic;

  // Compute whether filters are active (hide add-kit cards when filtered)
  const isFiltered =
    !!props.searchQuery?.trim() || !!showFavoritesOnly || !!showModifiedOnly;

  // A bank with no kits to show with an add-kit card (RE-64): the one
  // picked in the bank index, or bank A when the library is empty
  let emptyBank: null | string = null;
  if (!isFiltered) {
    emptyBank = shownEmptyBank ?? (kits.length === 0 ? "A" : null);
  }

  // Dialog management hook
  const { handleCloseValidationDialog, showValidationDialog } = useKitDialogs();

  // Kit deletion hook
  const deletion = useKitDeletion({
    onKitDeleted,
    onMessage,
    onRefreshKits: handleRefreshKits,
  });

  // Sync functionality hook
  const sync = useKitSync({ onMessage, onRefreshKits });
  const {
    cancelSync,
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
    syncProgressStore,
  } = sync;

  // Keyboard navigation hook
  useKitKeyboardNav({
    focusedKit,
    globalBankHotkeyHandler,
    onToggleFavorite: handleToggleFavorite,
  });

  // Handler for KitBankNav clicks and KitGrid keyboard navigation. Stable,
  // so typing a search or a scroll doesn't redraw the memoized grid (#462)
  const { focusBankInKitList } = logic;
  const focusBankInKitGrid = useCallback(
    (bank: string) => {
      if (focusBankInKitList) focusBankInKitList(bank);
    },
    [focusBankInKitList],
  );

  return (
    <div
      className="h-full min-h-0 flex-1 flex flex-col bg-surface-1 rounded"
      ref={scrollContainerRef}
    >
      <KitBrowserHeader
        bulkScanProgress={props.bulkScanProgress}
        favoritesCount={favoritesCount}
        isSearching={props.isSearching}
        modifiedCount={modifiedCount}
        onAboutClick={props.onAboutClick}
        onDismissBulkScan={props.onDismissBulkScan}
        onSearchChange={props.onSearchChange}
        onSearchClear={props.onSearchClear}
        onShowSettings={props.onShowSettings}
        onSyncToSdCard={handleSyncToSdCard}
        onToggleFavoritesFilter={handleToggleFavoritesFilter}
        onToggleModifiedFilter={handleToggleModifiedFilter}
        // Search props
        searchQuery={props.searchQuery}
        showFavoritesOnly={showFavoritesOnly}
        showModifiedOnly={showModifiedOnly}
      />
      <div className="flex-1 min-h-0 overflow-hidden flex flex-row">
        <KitBankNav
          bankNames={bankNames}
          kits={kits}
          onBankClick={focusBankInKitGrid}
          onEmptyBankClick={isFiltered ? undefined : showEmptyBank}
          selectedBank={selectedBank}
        />
        <KitGrid
          bankNames={bankNames}
          emptyBank={emptyBank}
          focusedKit={focusedKit}
          isCreatingKit={isCreatingKit}
          isFiltered={isFiltered}
          kitData={kits}
          kits={kits}
          newlyAnimatedKit={logic.newlyAnimatedKit}
          onBankFocus={focusBankInKitGrid}
          onBankNameChange={handleBankNameChange}
          onCreateKitInBank={handleCreateKitInBank}
          onDeleteKit={deletion.deleteKitDirect}
          onDuplicate={noop}
          onDuplicateKit={duplicateKitDirect}
          onFocusKit={setFocusedKit}
          onRequestDeleteSummary={deletion.requestDeleteSummary}
          onSelectKit={props.onSelectKit}
          onToggleFavorite={handleToggleFavorite}
          onVisibleBankChange={handleVisibleBankChange}
          ref={kitGridRef}
          sampleCounts={props.sampleCounts}
        />
      </div>
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
        <LiveSyncUpdateDialog
          isLoading={isSyncLoading}
          isOpen={showSyncDialog}
          kitName={currentSyncKit}
          localChangeSummary={currentChangeSummary}
          onCancelSync={cancelSync}
          onClose={handleCloseSyncDialog}
          onConfirm={handleConfirmSync}
          onGenerateChangeSummary={generateChangeSummary}
          onSdCardPathChange={onSdCardPathChange}
          sdCardPath={sdCardPath}
          syncProgressStore={syncProgressStore}
        />
      )}
    </div>
  );
};

export default React.memo(KitBrowser);
