import React, { useImperativeHandle, useRef, useState } from "react";
import { FiChevronDown, FiPlusCircle } from "react-icons/fi";
import { toast } from "sonner";

import { useKitBrowser } from "./hooks/useKitBrowser";
import { useKitScan } from "./hooks/useKitScan";
import { useLocalStoreWizard } from "./hooks/useLocalStoreWizard";
import KitBankNav from "./KitBankNav";
import KitBrowserHeader from "./KitBrowserHeader";
import KitDialogs from "./KitDialogs";
import KitList, { KitListHandle } from "./KitList";
import type { RampleKitLabel } from "./kitTypes";
import LocalStoreWizardUI from "./LocalStoreWizardUI";
import ValidationResultsDialog from "./ValidationResultsDialog";

interface KitBrowserProps {
  onSelectKit: (kitName: string) => void;
  localStorePath: string | null;
  kits?: string[];
  kitLabels?: { [kit: string]: RampleKitLabel };
  onRescanAllVoiceNames: () => void;
  sampleCounts?: Record<string, [number, number, number, number]>;
  voiceLabelSets?: Record<string, string[]>;
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
    const kitListRef = useRef<KitListHandle>(null);
    const [showValidationDialog, setShowValidationDialog] = useState(false);

    // Ensure localStorePath is always a string (never null)
    const logic = useKitBrowser({
      ...props,
      kits: props.kits ?? [],
      kitListRef: kitListRef,
      localStorePath: props.localStorePath ?? "",
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
    } = logic;

    const [showLocalStoreWizard, setShowLocalStoreWizard] =
      React.useState(false);
    const [showScanOptions, setShowScanOptions] = useState(false);

    const scanOperations = [
      {
        id: "full",
        name: "Full Scan All Kits",
        description: "Voice names, WAV analysis, artist metadata",
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
      {
        id: "rtfArtist",
        name: "Artist Metadata Only",
        description: "Parse RTF files for artist info",
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
        (k) =>
          k && typeof k === "string" && k[0] && k[0].toUpperCase() === bank,
      );
      if (idx !== -1 && kitListRef.current) {
        kitListRef.current.scrollAndFocusKitByIndex(idx);
      }
    };

    // Handler for KitBankNav and KitList keyboard navigation
    const focusBankInKitList = (bank: string) => {
      if (logic.focusBankInKitList) logic.focusBankInKitList(bank);
    };

    // Handler for KitBankNav (renamed to avoid conflict)
    const onBankClickWithScroll = (bank: string) => {
      focusBankInKitList(bank);
    };

    // Handler for KitList keyboard navigation to update selectedBank
    const handleBankFocus = (bank: string) => {
      focusBankInKitList(bank);
    };

    // Use the new useKitScan hook for scanning logic
    const { handleScanAllKits } = useKitScan({
      kits,
      localStorePath: props.localStorePath ?? "",
      onRefreshKits: props.onRefreshKits,
    });

    // Expose handleScanAllKits through ref for parent components
    useImperativeHandle(ref, () => ({
      handleScanAllKits,
    }));

    return (
      <div
        ref={scrollContainerRef}
        className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded m-2"
      >
        <KitBrowserHeader
          onRescanAllVoiceNames={props.onRescanAllVoiceNames}
          onScanAllKits={handleScanAllKits}
          onShowNewKit={() => setShowNewKit(true)}
          onCreateNextKit={handleCreateNextKit}
          nextKitSlot={nextKitSlot}
          onShowLocalStoreWizard={() => setShowLocalStoreWizard(true)}
          onValidateLocalStore={() => setShowValidationDialog(true)}
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
        <div className="flex-1 min-h-0">
          <KitList
            ref={kitListRef}
            kits={kits}
            onSelectKit={props.onSelectKit}
            bankNames={bankNames}
            onDuplicate={(kit) => {
              setDuplicateKitSource(kit);
              setDuplicateKitDest("");
              logic.setDuplicateKitError(null);
            }}
            localStorePath={props.localStorePath || ""}
            kitLabels={props.kitLabels}
            sampleCounts={props.sampleCounts}
            voiceLabelSets={props.voiceLabelSets}
            focusedKit={focusedKit}
            onBankFocus={handleBankFocus}
            onFocusKit={setFocusedKit} // NEW: keep parent in sync
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
            localStorePath={props.localStorePath || ""}
            onClose={() => setShowValidationDialog(false)}
            onMessage={props.onMessage}
          />
        )}
      </div>
    );
  },
);

export default React.memo(KitBrowser);
