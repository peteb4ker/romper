import type { KitWithRelations } from "@romper/shared/db/schema";

import { RefObject } from "react";

import { useKitBankNavigation } from "./useKitBankNavigation";
import { useKitCreation } from "./useKitCreation";
import { useKitDuplication } from "./useKitDuplication";
import { useKitErrorHandling } from "./useKitErrorHandling";

interface UseKitBrowserProps {
  kitListRef: RefObject<any>;
  kits: KitWithRelations[];
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: (scrollToKit?: string) => void;
}

export function useKitBrowser({
  kitListRef,
  kits: externalKits = [],
  onMessage,
  onRefreshKits,
}: UseKitBrowserProps) {
  const kits: KitWithRelations[] = externalKits;

  // Compose the smaller, focused hooks
  const errorHandling = useKitErrorHandling();
  const kitCreation = useKitCreation({ kits, onMessage, onRefreshKits });
  const kitDuplication = useKitDuplication({ onRefreshKits });
  const bankNavigation = useKitBankNavigation({ kitListRef, kits });

  // Return the same interface as before for backward compatibility
  return {
    // From bankNavigation
    bankNames: bankNavigation.bankNames,
    // From kitDuplication
    duplicateKitDest: kitDuplication.duplicateKitDest,
    duplicateKitError: kitDuplication.duplicateKitError,
    duplicateKitSource: kitDuplication.duplicateKitSource,
    // From errorHandling
    error: errorHandling.error,
    focusBankInKitList: bankNavigation.focusBankInKitList,
    focusedKit: bankNavigation.focusedKit,
    globalBankHotkeyHandler: bankNavigation.globalBankHotkeyHandler,
    handleBankClick: bankNavigation.handleBankClick,
    handleBankClickWithScroll: bankNavigation.handleBankClickWithScroll,
    // From kitCreation
    handleCreateKit: kitCreation.handleCreateKit,
    handleCreateNextKit: kitCreation.handleCreateNextKit,

    handleDuplicateKit: kitDuplication.handleDuplicateKit,
    handleVisibleBankChange: bankNavigation.handleVisibleBankChange,
    // Pass through for backward compatibility
    kits,
    newKitError: kitCreation.newKitError,
    newKitSlot: kitCreation.newKitSlot,
    nextKitSlot: kitCreation.nextKitSlot,
    scrollContainerRef: bankNavigation.scrollContainerRef,
    sdCardWarning: errorHandling.sdCardWarning,
    selectedBank: bankNavigation.selectedBank,

    setBankNames: bankNavigation.setBankNames,
    setDuplicateKitDest: kitDuplication.setDuplicateKitDest,
    setDuplicateKitError: kitDuplication.setDuplicateKitError,
    setDuplicateKitSource: kitDuplication.setDuplicateKitSource,
    setError: errorHandling.setError,
    setFocusedKit: bankNavigation.setFocusedKit,
    setNewKitError: kitCreation.setNewKitError,

    setNewKitSlot: kitCreation.setNewKitSlot,
    setSdCardWarning: errorHandling.setSdCardWarning,
    setSelectedBank: bankNavigation.setSelectedBank,
    setShowNewKit: kitCreation.setShowNewKit,

    showNewKit: kitCreation.showNewKit,
  };
}
