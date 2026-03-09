import type { KitWithRelations } from "@romper/shared/db/schema";

import { RefObject } from "react";

import {
  type KitListComponent,
  useKitBankNavigation,
} from "./useKitBankNavigation";
import { useKitCreation } from "./useKitCreation";
import { useKitDuplication } from "./useKitDuplication";
import { useKitErrorHandling } from "./useKitErrorHandling";

interface UseKitBrowserProps {
  kitListRef: RefObject<KitListComponent | null>;
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
    duplicateKitDirect: kitDuplication.duplicateKitDirect,
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
    handleCreateKitInBank: kitCreation.handleCreateKitInBank,

    handleDuplicateKit: kitDuplication.handleDuplicateKit,
    handleVisibleBankChange: bankNavigation.handleVisibleBankChange,
    // From kitCreation
    isCreatingKit: kitCreation.isCreatingKit,
    // Pass through for backward compatibility
    kits,
    scrollContainerRef: bankNavigation.scrollContainerRef,
    sdCardWarning: errorHandling.sdCardWarning,
    selectedBank: bankNavigation.selectedBank,

    setBankNames: bankNavigation.setBankNames,
    setDuplicateKitDest: kitDuplication.setDuplicateKitDest,
    setDuplicateKitError: kitDuplication.setDuplicateKitError,
    setDuplicateKitSource: kitDuplication.setDuplicateKitSource,
    setError: errorHandling.setError,
    setFocusedKit: bankNavigation.setFocusedKit,
    setSdCardWarning: errorHandling.setSdCardWarning,
    setSelectedBank: bankNavigation.setSelectedBank,
  };
}
