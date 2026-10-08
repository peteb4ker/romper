import type { KitWithRelations } from "@romper/shared/db/schema";

import { RefObject, useCallback } from "react";

import {
  type KitListComponent,
  useKitBankNavigation,
} from "./useKitBankNavigation";
import { useKitCreation } from "./useKitCreation";
import { useKitDuplication } from "./useKitDuplication";

// One empty list, so a browser with no kits passes the same one each render
const NO_KITS: KitWithRelations[] = [];

interface UseKitBrowserProps {
  kitListRef: RefObject<KitListComponent | null>;
  kits?: KitWithRelations[];
  localStorePath?: null | string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: (scrollToKit?: string) => void;
}

export function useKitBrowser({
  kitListRef,
  kits: externalKits = NO_KITS,
  localStorePath,
  onMessage,
  onRefreshKits,
}: UseKitBrowserProps) {
  const kits: KitWithRelations[] = externalKits;

  // Compose the smaller, focused hooks
  const kitCreation = useKitCreation({ kits, onMessage, onRefreshKits });
  const kitDuplication = useKitDuplication({ onRefreshKits });
  const bankNavigation = useKitBankNavigation({
    kitListRef,
    kits,
    localStorePath,
    onMessage,
  });

  // Main marks every kit in a renamed bank modified (RE-35); reload the
  // kits so their cards and the Modified filter show it
  const renameBank = bankNavigation.handleBankNameChange;
  const handleBankNameChange = useCallback(
    async (bank: string, newName: string) => {
      await renameBank(bank, newName);
      onRefreshKits?.();
    },
    [renameBank, onRefreshKits],
  );

  // Return the same interface as before for backward compatibility
  return {
    // From bankNavigation
    bankNames: bankNavigation.bankNames,
    // From kitDuplication
    duplicateKitDest: kitDuplication.duplicateKitDest,
    duplicateKitDirect: kitDuplication.duplicateKitDirect,
    duplicateKitError: kitDuplication.duplicateKitError,
    duplicateKitSource: kitDuplication.duplicateKitSource,
    focusBankInKitList: bankNavigation.focusBankInKitList,
    focusedKit: bankNavigation.focusedKit,
    globalBankHotkeyHandler: bankNavigation.globalBankHotkeyHandler,
    handleBankClick: bankNavigation.handleBankClick,
    handleBankClickWithScroll: bankNavigation.handleBankClickWithScroll,
    handleBankNameChange,
    // From kitCreation
    handleCreateKitInBank: kitCreation.handleCreateKitInBank,

    handleDuplicateKit: kitDuplication.handleDuplicateKit,
    handleVisibleBankChange: bankNavigation.handleVisibleBankChange,
    // From kitCreation
    isCreatingKit: kitCreation.isCreatingKit,
    // Pass through for backward compatibility
    kits,
    // Animation state: either newly created or duplicated kit name
    newlyAnimatedKit:
      kitCreation.newlyCreatedKit || kitDuplication.newlyDuplicatedKit,
    scrollContainerRef: bankNavigation.scrollContainerRef,
    selectedBank: bankNavigation.selectedBank,
    setBankNames: bankNavigation.setBankNames,
    setDuplicateKitDest: kitDuplication.setDuplicateKitDest,

    setDuplicateKitError: kitDuplication.setDuplicateKitError,
    setDuplicateKitSource: kitDuplication.setDuplicateKitSource,
    setFocusedKit: bankNavigation.setFocusedKit,
    setSelectedBank: bankNavigation.setSelectedBank,
    showEmptyBank: bankNavigation.showEmptyBank,
    shownEmptyBank: bankNavigation.shownEmptyBank,
  };
}
