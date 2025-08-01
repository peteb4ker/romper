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

interface KitBrowserProps {
  onSelectKit: (kitName: string) => void;
  localStorePath: string | null;
  kits?: KitWithRelations[];
  sampleCounts?: Record<string, [number, number, number, number]>;
  onRefreshKits?: () => void;
  onMessage?: (msg: { text: string; type?: string; duration?: number }) => void;
  setLocalStorePath?: (path: string) => void;
}

export interface KitBrowserHandle {
  handleScanAllKits: () => void;
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
      kits: filteredKits,
      kitListRef: kitGridRef,
      onRefreshKits: props.onRefreshKits,
      onMessage: props.onMessage,
    });
    const {
      kits,
      showNewKit,
      setShowNewKit,
      newKitSlot,
      setNewKitSlot,
      newKitError,
      nextKitSlot,
      duplicateKitSource,
      setDuplicateKitSource,
      duplicateKitDest,
      setDuplicateKitDest,
      duplicateKitError,
      bankNames,
      scrollContainerRef,
      handleCreateKit,
      handleCreateNextKit,
      handleDuplicateKit,
      selectedBank,
      focusedKit,
      setFocusedKit,
      globalBankHotkeyHandler,
      handleVisibleBankChange,
    } = logic;

    const [showLocalStoreWizard, setShowLocalStoreWizard] =
      React.useState(false);
    const [showSyncDialog, setShowSyncDialog] = useState(false);
    const [currentSyncKit, setCurrentSyncKit] = useState<string | null>(null);
    const [currentChangeSummary, setCurrentChangeSummary] = useState<any>(null);

    // Sync functionality
    const {
      generateChangeSummary,
      startSync,
      isLoading: isSyncLoading,
      error: syncError,
      clearError: clearSyncError,
    } = useSyncUpdate();

    React.useEffect(() => {
      if (logic.sdCardWarning && onMessage) {
        onMessage({
          text: logic.sdCardWarning,
          type: "warning",
          duration: 5000,
        });
      }
    }, [logic.sdCardWarning, onMessage]);
    React.useEffect(() => {
      if (logic.error && onMessage) {
        onMessage({ text: logic.error, type: "error", duration: 7000 });
      }
    }, [logic.error, onMessage]);

    // Task 20.1.2: Handler for favorites toggle
    const handleToggleFavorite = React.useCallback(
      async (kitName: string) => {
        try {
          const result = await window.electronAPI.toggleKitFavorite?.(kitName);
          if (result?.success) {
            const isFavorite = result.data?.is_favorite;
            onMessage?.({
              text: `Kit ${kitName} ${isFavorite ? "added to" : "removed from"} favorites`,
              type: "success",
              duration: 2000,
            });
            // Refresh kits to update the UI
            props.onRefreshKits?.();

            // Update favorites count
            const countResult =
              await window.electronAPI.getFavoriteKitsCount?.();
            if (countResult?.success && typeof countResult.data === "number") {
              setFavoritesCount(countResult.data);
            }
          } else {
            onMessage?.({
              text: `Failed to toggle favorite: ${result?.error || "Unknown error"}`,
              type: "error",
            });
          }
        } catch (error) {
          onMessage?.({
            text: `Failed to toggle favorite: ${error instanceof Error ? error.message : String(error)}`,
            type: "error",
          });
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
          onMessage({
            text: `Failed to analyze kits: ${syncError}`,
            type: "error",
          });
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
          onMessage({
            text: `All kits synced successfully!`,
            type: "success",
            duration: 3000,
          });
        }
      } else if (onMessage && syncError) {
        onMessage({ text: `Sync failed: ${syncError}`, type: "error" });
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
        ref={scrollContainerRef}
        className="h-full min-h-0 flex-1 flex flex-col bg-gray-50 dark:bg-slate-800 rounded"
      >
        <KitBrowserHeader
          onScanAllKits={handleScanAllKits}
          onShowNewKit={() => setShowNewKit(true)}
          onCreateNextKit={handleCreateNextKit}
          nextKitSlot={nextKitSlot}
          onShowLocalStoreWizard={() => setShowLocalStoreWizard(true)}
          onValidateLocalStore={() => setShowValidationDialog(true)}
          onSyncToSdCard={handleSyncToSdCard}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesFilter={handleToggleFavoritesFilter}
          favoritesCount={favoritesCount}
          showModifiedOnly={showModifiedOnly}
          onToggleModifiedFilter={handleToggleModifiedFilter}
          modifiedCount={modifiedCount}
          bankNav={
            <KitBankNav
              kits={kits}
              onBankClick={onBankClickWithScroll}
              bankNames={bankNames}
              selectedBank={selectedBank}
            />
          }
        />
        <KitDialogs
          showNewKit={showNewKit}
          newKitSlot={newKitSlot}
          newKitError={newKitError}
          onNewKitSlotChange={setNewKitSlot}
          onCreateKit={handleCreateKit}
          onCancelNewKit={() => {
            setShowNewKit(false);
            setNewKitSlot("");
            // Fix: setNewKitError and setDuplicateKitError should be called from logic, not as standalone names
            logic.setNewKitError(null);
          }}
          showDuplicateKit={!!duplicateKitSource}
          duplicateKitSource={duplicateKitSource}
          duplicateKitDest={duplicateKitDest}
          duplicateKitError={duplicateKitError}
          onDuplicateKitDestChange={setDuplicateKitDest}
          onDuplicateKit={handleDuplicateKit}
          onCancelDuplicateKit={() => {
            setDuplicateKitSource(null);
            setDuplicateKitDest("");
            logic.setDuplicateKitError(null);
          }}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <KitGrid
            ref={kitGridRef}
            kits={kits}
            onSelectKit={props.onSelectKit}
            bankNames={bankNames}
            onDuplicate={(kit) => {
              setDuplicateKitSource(kit);
              setDuplicateKitDest("");
              logic.setDuplicateKitError(null);
            }}
            kitData={kits}
            sampleCounts={props.sampleCounts}
            focusedKit={focusedKit}
            onBankFocus={handleBankFocus}
            onFocusKit={setFocusedKit} // NEW: keep parent in sync
            onVisibleBankChange={handleVisibleBankChange} // NEW: update selected bank on scroll
            onToggleFavorite={handleToggleFavorite} // Task 20.1.2: Favorites toggle
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
                  {
                    /* TODO replace with proper message handling */
                  }
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
            isOpen={showSyncDialog}
            onClose={handleCloseSyncDialog}
            onConfirm={handleConfirmSync}
            kitName={currentSyncKit}
            changeSummary={currentChangeSummary}
            isLoading={isSyncLoading}
          />
        )}
      </div>
    );
  },
);

export default React.memo(KitBrowser);
