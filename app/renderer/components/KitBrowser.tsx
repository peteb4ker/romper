import React, { useRef } from "react";
import { toast } from "sonner";

import { useKitBrowser } from "./hooks/useKitBrowser";
import { useLocalStoreWizard } from "./hooks/useLocalStoreWizard";
import KitBankNav from "./KitBankNav";
import KitBrowserHeader from "./KitBrowserHeader";
import KitDialogs from "./KitDialogs";
import KitList, { KitListHandle } from "./KitList";
import type { RampleKitLabel } from "./kitTypes";
import LocalStoreWizardUI from "./LocalStoreWizardUI";

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

const KitBrowser: React.FC<KitBrowserProps> = (props) => {
  const { onMessage, setLocalStorePath } = props;
  const kitListRef = useRef<KitListHandle>(null);
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

  const [showLocalStoreWizard, setShowLocalStoreWizard] = React.useState(false);

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
    return () => window.removeEventListener("keydown", globalBankHotkeyHandler);
  }, [globalBankHotkeyHandler]);

  // Find the first kit index for a given bank letter
  const scrollToBank = (bank: string) => {
    const kitsArr = kits || [];
    const idx = kitsArr.findIndex(
      (k) => k && typeof k === "string" && k[0] && k[0].toUpperCase() === bank,
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

  return (
    <div
      ref={scrollContainerRef}
      className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded m-2"
    >
      <KitBrowserHeader
        onRescanAllVoiceNames={props.onRescanAllVoiceNames}
        onShowNewKit={() => setShowNewKit(true)}
        onCreateNextKit={handleCreateNextKit}
        nextKitSlot={nextKitSlot}
        onShowLocalStoreWizard={() => setShowLocalStoreWizard(true)}
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
            <h2 className="text-xl font-bold mb-4">Romper Local Store Setup</h2>
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
    </div>
  );
};

export default React.memo(KitBrowser);
