import React, { useImperativeHandle, useRef, useState } from "react";
import { FiChevronDown, FiPlusCircle } from "react-icons/fi";
import { toast } from "sonner";

import type { KitWithRelations } from "../../../shared/db/schema";
import KitDialogs from "./dialogs/KitDialogs";
import SyncUpdateDialog from "./dialogs/SyncUpdateDialog";
import ValidationResultsDialog from "./dialogs/ValidationResultsDialog";
import { useKitBrowser } from "./hooks/useKitBrowser";
import { useKitScan } from "./hooks/useKitScan";
import { useLocalStoreWizard } from "./hooks/useLocalStoreWizard";
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

    const logic = useKitBrowser({
      kits: props.kits ?? [],
      kitListRef: kitGridRef,
      onRefreshKits: props.onRefreshKits,
      onMessage: props.onMessage,
    });
    const {
      kits,
      error,
      sdCardWarning,
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
      handleBankClick,
      selectedBank,
      focusedKit,
      setFocusedKit,
      globalBankHotkeyHandler,
      handleVisibleBankChange,
    } = logic;

    const [showLocalStoreWizard, setShowLocalStoreWizard] =
      React.useState(false);
    const [showScanOptions, setShowScanOptions] = useState(false);
    const [showSyncDialog, setShowSyncDialog] = useState(false);
    const [currentSyncKit, setCurrentSyncKit] = useState<string | null>(null);
    const [currentChangeSummary, setCurrentChangeSummary] = useState<any>(null);

    // Sync functionality
    const {
      generateChangeSummary,
      startSync,
      syncProgress,
      isLoading: isSyncLoading,
      error: syncError,
      clearError: clearSyncError,
    } = useSyncUpdate();

    const scanOperations = [
      {
        id: "full",
        name: "Full Scan All Kits",
        description: "Voice names and WAV analysis",
      },
      {
        id: "voiceInference",
        name: "Voice Names Only",
        description: "Infer voice names from samples",
      },
      {
        id: "wavAnalysis",
        name: "WAV Analysis Only",
        description: "Analyze sample files",
      },
    ];

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

    // Register global A-Z navigation for bank selection and kit focus
    React.useEffect(() => {
      window.addEventListener("keydown", globalBankHotkeyHandler);
      return () =>
        window.removeEventListener("keydown", globalBankHotkeyHandler);
    }, [globalBankHotkeyHandler]);

    // Find the first kit index for a given bank letter
    const scrollToBank = (bank: string) => {
      const kitsArr = kits || [];
      const idx = kitsArr.findIndex(
        (k) => k && k.name && k.name[0] && k.name[0].toUpperCase() === bank,
      );
      if (idx !== -1 && kitGridRef.current) {
        kitGridRef.current.scrollAndFocusKitByIndex(idx);
      }
    };

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
