import type { KitWithRelations } from "@romper/shared/db/schema";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";

import {
  bankHasKits,
  type BankNames,
  getFirstKitInBank,
} from "../../utils/bankOperations";

interface KitListComponent {
  scrollAndFocusKitByIndex: (index: number) => void;
}

interface UseKitBankNavigationProps {
  kitListRef: RefObject<KitListComponent>;
  kits: KitWithRelations[];
}

export function useKitBankNavigation({
  kitListRef,
  kits,
}: UseKitBankNavigationProps) {
  const [selectedBank, setSelectedBank] = useState<string>("A");
  const [focusedKit, setFocusedKit] = useState<null | string>(null);
  const [bankNames, setBankNames] = useState<BankNames>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Generate bank names from kit data
  useEffect(() => {
    const bankNamesFromData: BankNames = {};

    kits.forEach((kit: KitWithRelations) => {
      if (kit.bank?.artist && kit.name?.[0]) {
        const bankLetter = kit.name[0].toUpperCase();
        bankNamesFromData[bankLetter] = kit.bank.artist;
      }
    });

    setBankNames(bankNamesFromData);
  }, [kits]);

  // Focus the first kit when kits change
  useEffect(() => {
    if (kits && kits.length > 0) {
      setFocusedKit(kits[0].name);
    }
  }, [kits]);

  // When selectedBank changes, focus first kit in that bank
  useEffect(() => {
    if (!bankHasKits(kits, selectedBank)) return;
    const firstKit = getFirstKitInBank(kits, selectedBank);
    if (firstKit) setFocusedKit(firstKit);
  }, [selectedBank, kits]);

  const scrollToBankInContainer = useCallback(
    (bank: string) => {
      if (!scrollContainerRef.current) return;

      const el = document.getElementById(`bank-${bank}`);
      if (!el) return;

      const header = document.querySelector(".sticky.top-0");
      const headerHeight =
        header && "offsetHeight" in header
          ? (header as HTMLElement).offsetHeight
          : 0;
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top - headerHeight - 8;

      scrollContainerRef.current.scrollTo({
        behavior: "auto",
        top: scrollContainerRef.current.scrollTop + offset,
      });
    },
    [scrollContainerRef],
  );

  const handleBankClick = useCallback(
    (bank: string) => {
      // Only scroll if the bank has kits
      if (!bankHasKits(kits, bank)) return;
      scrollToBankInContainer(bank);
    },
    [kits, scrollToBankInContainer],
  );

  const handleBankClickWithScroll = useCallback(
    (bank: string) => {
      // Only update selectedBank if the bank has kits
      if (!bankHasKits(kits, bank)) return;
      setSelectedBank(bank);
      handleBankClick(bank);
    },
    [kits, handleBankClick],
  );

  // Global A-Z hotkey handler: select bank and focus first kit in that bank
  const globalBankHotkeyHandler = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle hotkeys when typing in inputs
      const target = e.target as Element;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key.length === 1 && /^\p{Lu}$/u.test(e.key.toUpperCase())) {
        const bank = e.key.toUpperCase();

        // Only handle if bank has kits
        if (!bankHasKits(kits, bank)) return;

        setSelectedBank(bank);
        handleBankClick(bank);

        // Focus first kit in that bank
        const firstKit = getFirstKitInBank(kits, bank);
        if (firstKit) {
          setFocusedKit(firstKit);
        }

        e.preventDefault();
      }
    },
    [kits, setSelectedBank, handleBankClick],
  );

  // Virtualization-based bank focus/scroll logic
  const focusBankInKitList = useCallback(
    (bank: string) => {
      const idx = kits.findIndex((k) => k?.name?.[0]?.toUpperCase() === bank);
      if (
        idx !== -1 &&
        kitListRef?.current &&
        typeof kitListRef.current.scrollAndFocusKitByIndex === "function"
      ) {
        setSelectedBank(bank);
        kitListRef.current.scrollAndFocusKitByIndex(idx);
        setFocusedKit(kits[idx].name);
      }
      // If no kit in that bank, do not update selectedBank or focusedKit
    },
    [kits, kitListRef],
  );

  // Handler for visible bank change during scroll
  const handleVisibleBankChange = useCallback((bank: string) => {
    setSelectedBank(bank);
  }, []);

  return {
    bankNames,
    focusBankInKitList,
    focusedKit,
    globalBankHotkeyHandler,

    // Actions
    handleBankClick,
    handleBankClickWithScroll,
    handleVisibleBankChange,
    scrollContainerRef,
    // State
    selectedBank,

    setBankNames,
    setFocusedKit,
    // Setters
    setSelectedBank,
  };
}
