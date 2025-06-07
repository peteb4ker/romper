import React, { useRef } from "react";

import { useKitBrowser } from "./hooks/useKitBrowser";
import KitBankNav from "./KitBankNav";
import KitBrowserHeader from "./KitBrowserHeader";
import KitDialogs from "./KitDialogs";
import KitList, { KitListHandle } from "./KitList";

interface KitBrowserProps {
  onSelectKit: (kitName: string) => void;
  sdCardPath: string | null;
  kits?: string[];
  kitLabels: { [kit: string]: RampleKitLabel };
  onRescanAllVoiceNames: () => void;
  sampleCounts?: Record<string, [number, number, number, number]>;
  voiceLabelSets?: Record<string, string[]>;
  onRefreshKits?: () => void;
  onMessage?: (msg: { text: string; type?: string; duration?: number }) => void;
}

const KitBrowser: React.FC<KitBrowserProps> = (props) => {
  const kitListRef = useRef<KitListHandle>(null);
  const logic = useKitBrowser({
    ...props,
    kitListRef,
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
    handleSelectSdCard,
    selectedBank,
    focusedKit,
    setFocusedKit,
    globalBankHotkeyHandler,
  } = logic;

  React.useEffect(() => {
    if (logic.sdCardWarning && props.onMessage) {
      props.onMessage({
        text: logic.sdCardWarning,
        type: "warning",
        duration: 5000,
      });
    }
  }, [logic.sdCardWarning, props.onMessage]);
  React.useEffect(() => {
    if (logic.error && props.onMessage) {
      props.onMessage({ text: logic.error, type: "error", duration: 7000 });
    }
  }, [logic.error, props.onMessage]);

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
        onSelectSdCard={handleSelectSdCard}
        onRescanAllVoiceNames={props.onRescanAllVoiceNames}
        onShowNewKit={() => setShowNewKit(true)}
        onCreateNextKit={handleCreateNextKit}
        nextKitSlot={nextKitSlot}
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
          setNewKitError(null);
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
          setDuplicateKitError(null);
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
            setDuplicateKitError(null);
          }}
          sdCardPath={props.sdCardPath || ""}
          kitLabels={props.kitLabels}
          sampleCounts={props.sampleCounts}
          voiceLabelSets={props.voiceLabelSets}
          focusedKit={focusedKit}
          onBankFocus={handleBankFocus}
          onFocusKit={setFocusedKit} // NEW: keep parent in sync
        />
      </div>
    </div>
  );
};

export default React.memo(KitBrowser);
