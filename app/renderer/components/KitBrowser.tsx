import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";

import type { KitWithRelations } from "../../../shared/db/schema";

import KitDialogs from "./dialogs/KitDialogs";
import SyncUpdateDialog from "./dialogs/SyncUpdateDialog";
import ValidationResultsDialog from "./dialogs/ValidationResultsDialog";
import { useKitBrowser } from "./hooks/useKitBrowser";
import { useKitScan } from "./hooks/useKitScan";
import { useSyncUpdate } from "./hooks/useSyncUpdate";
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
    const [showValidationDialog, setShowValidationDialog] = useState(false);

    // Task 20.1.4: Favorites filter state
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [favoritesCount, setFavoritesCount] = useState(0);

    // Task 20.2.2: Modified filter state
    const [showModifiedOnly, setShowModifiedOnly] = useState(false);
    const [modifiedCount, setModifiedCount] = useState(0);

    // Task 20.1.4 & 20.2.2: Filter kits based on active filters
    const filteredKits = React.useMemo(() => {
      let kits = props.kits ?? [];

      if (showFavoritesOnly) {
        kits = kits.filter((kit) => kit.is_favorite);
      }

      if (showModifiedOnly) {
        kits = kits.filter((kit) => kit.modified_since_sync);
      }

      return kits;
    }, [props.kits, showFavoritesOnly, showModifiedOnly]);

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

    const [showLocalStoreWizard, setShowLocalStoreWizard] =
      React.useState(false);
    const [showSyncDialog, setShowSyncDialog] = useState(false);
    const [currentSyncKit, setCurrentSyncKit] = useState<null | string>(null);
    const [currentChangeSummary, setCurrentChangeSummary] = useState<any>(null);

    // Sync functionality
    const {
      clearError: clearSyncError,
      error: syncError,
      generateChangeSummary,
      isLoading: isSyncLoading,
      startSync,
    } = useSyncUpdate();

    React.useEffect(() => {
      if (logic.sdCardWarning && onMessage) {
        onMessage(logic.sdCardWarning, "warning", 5000);
      }
    }, [logic.sdCardWarning, onMessage]);
    React.useEffect(() => {
      if (logic.error && onMessage) {
        onMessage(logic.error, "error", 7000);
      }
    }, [logic.error, onMessage]);

    // Task 20.1.2: Handler for favorites toggle
    const handleToggleFavorite = React.useCallback(
      async (kitName: string) => {
        try {
          const result = await window.electronAPI.toggleKitFavorite?.(kitName);
          if (result?.success) {
            const isFavorite = result.data?.is_favorite;
            onMessage?.(
              `Kit ${kitName} ${isFavorite ? "added to" : "removed from"} favorites`,
              "success",
              2000,
            );
            // Refresh kits to update the UI
            props.onRefreshKits?.();

            // Update favorites count
            const countResult =
              await window.electronAPI.getFavoriteKitsCount?.();
            if (countResult?.success && typeof countResult.data === "number") {
              setFavoritesCount(countResult.data);
            }
          } else {
            onMessage?.(
              `Failed to toggle favorite: ${result?.error || "Unknown error"}`,
              "error",
            );
          }
        } catch (error) {
          onMessage?.(
            `Failed to toggle favorite: ${error instanceof Error ? error.message : String(error)}`,
            "error",
          );
        }
      },
      [onMessage, props],
    );

    // Task 20.1.3: Favorite toggle keyboard shortcut handler
    const favoritesKeyboardHandler = React.useCallback(
      (e: KeyboardEvent) => {
        // Don't handle hotkeys when typing in inputs
        const target = e.target as Element;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
          return;
        }

        // F key to toggle favorite on focused kit
        if (e.key.toLowerCase() === "f" && focusedKit) {
          e.preventDefault();
          e.stopPropagation();
          handleToggleFavorite(focusedKit);
        }
      },
      [focusedKit, handleToggleFavorite],
    );

    // Register global A-Z navigation for bank selection and kit focus
    React.useEffect(() => {
      window.addEventListener("keydown", globalBankHotkeyHandler);
      window.addEventListener("keydown", favoritesKeyboardHandler);
      return () => {
        window.removeEventListener("keydown", globalBankHotkeyHandler);
        window.removeEventListener("keydown", favoritesKeyboardHandler);
      };
    }, [globalBankHotkeyHandler, favoritesKeyboardHandler]);

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

    // Sync handlers
    const handleSyncToSdCard = async () => {
      // Sync all kits to SD card
      setCurrentSyncKit("All Kits");

      // Generate change summary before showing dialog
      const changeSummary = await generateChangeSummary();
      if (!changeSummary) {
        if (onMessage && syncError) {
          onMessage(`Failed to analyze kits: ${syncError}`, "error");
        }
        return;
      }

      setCurrentChangeSummary(changeSummary);
      setShowSyncDialog(true);
    };

    const handleConfirmSync = async () => {
      if (!currentChangeSummary) return;

      const success = await startSync(currentChangeSummary);
      if (success) {
        setShowSyncDialog(false);
        setCurrentSyncKit(null);
        setCurrentChangeSummary(null);
        if (onMessage) {
          onMessage(`All kits synced successfully!`, "success", 3000);
        }
      } else if (onMessage && syncError) {
        onMessage(`Sync failed: ${syncError}`, "error");
      }
    };

    // Task 20.1.4: Fetch favorites count when kits change
    useEffect(() => {
      const fetchFavoritesCount = async () => {
        try {
          const result = await window.electronAPI.getFavoriteKitsCount?.();
          if (result?.success && typeof result.data === "number") {
            setFavoritesCount(result.data);
          }
        } catch (error) {
          console.error("Failed to fetch favorites count:", error);
        }
      };

      fetchFavoritesCount();
    }, [props.kits]); // Re-fetch when kits change

    // Task 20.2.2: Calculate modified count when kits change
    useEffect(() => {
      const modifiedKits =
        props.kits?.filter((kit) => kit.modified_since_sync) ?? [];
      setModifiedCount(modifiedKits.length);
    }, [props.kits]);

    // Task 20.1.4: Toggle favorites filter
    const handleToggleFavoritesFilter = () => {
      setShowFavoritesOnly(!showFavoritesOnly);
    };

    // Task 20.2.2: Toggle modified filter
    const handleToggleModifiedFilter = () => {
      setShowModifiedOnly(!showModifiedOnly);
    };

    const handleCloseSyncDialog = () => {
      setShowSyncDialog(false);
      setCurrentSyncKit(null);
      setCurrentChangeSummary(null);
      clearSyncError();
    };

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
          onShowLocalStoreWizard={() => setShowLocalStoreWizard(true)}
          onShowNewKit={() => setShowNewKit(true)}
          onSyncToSdCard={handleSyncToSdCard}
          onToggleFavoritesFilter={handleToggleFavoritesFilter}
          onToggleModifiedFilter={handleToggleModifiedFilter}
          onValidateLocalStore={() => setShowValidationDialog(true)}
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
              <LocalStoreWizardUI
                onClose={() => setShowLocalStoreWizard(false)}
                onSuccess={() => {
                  setShowLocalStoreWizard(false);
                  toast.success("Local store initialized successfully!", {
                    duration: 5000,
                  });
                }}
                setLocalStorePath={setLocalStorePath || (() => {})}
              />
            </div>
          </div>
        )}

        {/* ValidationResultsDialog */}
        {showValidationDialog && (
          <ValidationResultsDialog
            isOpen={showValidationDialog}
            localStorePath={props.localStorePath || undefined}
            onClose={() => setShowValidationDialog(false)}
            onMessage={props.onMessage}
          />
        )}

        {/* SyncUpdateDialog */}
        {showSyncDialog && currentSyncKit && currentChangeSummary && (
          <SyncUpdateDialog
            changeSummary={currentChangeSummary}
            isLoading={isSyncLoading}
            isOpen={showSyncDialog}
            kitName={currentSyncKit}
            onClose={handleCloseSyncDialog}
            onConfirm={handleConfirmSync}
          />
        )}
      </div>
    );
  },
);

export default React.memo(KitBrowser);
