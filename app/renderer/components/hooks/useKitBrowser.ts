import { RefObject, useCallback, useEffect, useRef, useState } from "react";

import type { KitWithRelations } from "../../../../shared/db/schema";

import { getNextKitSlot } from "../../../../shared/kitUtilsShared";
import {
  bankHasKits,
  type BankNames,
  getFirstKitInBank,
} from "../utils/bankOperations";
import {
  createKit,
  duplicateKit,
  formatKitError,
  validateKitSlot,
} from "../utils/kitOperations";

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
  const [error, setError] = useState<null | string>(null);
  const [sdCardWarning, setSdCardWarning] = useState<null | string>(null);
  const [showNewKit, setShowNewKit] = useState(false);
  const [newKitSlot, setNewKitSlot] = useState("");
  const [newKitError, setNewKitError] = useState<null | string>(null);
  const [nextKitSlot, setNextKitSlot] = useState<null | string>(null);
  const [duplicateKitSource, setDuplicateKitSource] = useState<null | string>(
    null,
  );
  const [duplicateKitDest, setDuplicateKitDest] = useState("");
  const [duplicateKitError, setDuplicateKitError] = useState<null | string>(
    null,
  );
  const [bankNames, setBankNames] = useState<BankNames>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const kitNames = kits.map((kit) => kit.name);
    setNextKitSlot(getNextKitSlot(kitNames));
  }, [kits]);

  useEffect(() => {
    // Generate bank names from kit data
    const bankNamesFromData: BankNames = {};

    kits.forEach((kit: KitWithRelations) => {
      if (kit.bank?.artist && kit.name?.[0]) {
        const bankLetter = kit.name[0].toUpperCase();
        bankNamesFromData[bankLetter] = kit.bank.artist;
      }
    });

    setBankNames(bankNamesFromData);
  }, [kits]);

  const handleCreateKit = async () => {
    setNewKitError(null);
    if (!validateKitSlot(newKitSlot)) {
      setNewKitError("Invalid kit slot. Use format A0-Z99.");
      return;
    }

    try {
      await createKit(newKitSlot);
      const kitNameToScrollTo = newKitSlot;
      setShowNewKit(false);
      setNewKitSlot("");
      if (onRefreshKits) onRefreshKits(kitNameToScrollTo);
      if (onMessage)
        onMessage(`Kit ${newKitSlot} created successfully!`, "info", 4000);
    } catch (err) {
      setNewKitError(formatKitError(err));
    }
  };

  const handleCreateNextKit = async () => {
    setNewKitError(null);
    if (!nextKitSlot || !validateKitSlot(nextKitSlot)) {
      setNewKitError("No next kit slot available.");
      return;
    }

    try {
      await createKit(nextKitSlot);
      const kitNameToScrollTo = nextKitSlot;
      if (onRefreshKits) onRefreshKits(kitNameToScrollTo);
    } catch (err) {
      setNewKitError(formatKitError(err));
    }
  };

  const handleDuplicateKit = async () => {
    setDuplicateKitError(null);
    if (!duplicateKitSource || !validateKitSlot(duplicateKitDest)) {
      setDuplicateKitError("Invalid destination slot. Use format A0-Z99.");
      return;
    }

    try {
      await duplicateKit(duplicateKitSource, duplicateKitDest);
      const kitNameToScrollTo = duplicateKitDest;
      setDuplicateKitSource(null);
      setDuplicateKitDest("");
      if (onRefreshKits) onRefreshKits(kitNameToScrollTo);
    } catch (err) {
      setDuplicateKitError(err instanceof Error ? err.message : String(err));
    }
  };

  // --- Bank selection state and logic (moved from KitBrowser) ---
  const [selectedBank, setSelectedBank] = useState<string>("A");

  const scrollToBankInContainer = useCallback(
    (bank: string) => {
      if (!scrollContainerRef.current) return;

      const el = document.getElementById(`bank-${bank}`);
      if (!el) return;

      const header = document.querySelector(".sticky.top-0");
      const headerHeight =
        header && "offsetHeight" in header ? (header as any).offsetHeight : 0;
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

  // --- Kit focus state and A-Z navigation logic ---
  const [focusedKit, setFocusedKit] = useState<null | string>(null);

  // On kits change, focus the first kit
  useEffect(() => {
    if (kits && kits.length > 0) {
      setFocusedKit(kits[0].name);
    }
  }, [kits]);

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

  // When selectedBank changes (e.g. via UI), focus first kit in that bank
  useEffect(() => {
    if (!bankHasKits(kits, selectedBank)) return;
    const firstKit = getFirstKitInBank(kits, selectedBank);
    if (firstKit) setFocusedKit(firstKit);
  }, [selectedBank, kits]);

  // --- Shared virtualization-based bank focus/scroll logic ---
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
      } else {
        // If no kit in that bank, do not update selectedBank or focusedKit
      }
    },
    [kits, kitListRef],
  );

  // --- Handler for visible bank change during scroll ---
  const handleVisibleBankChange = useCallback((bank: string) => {
    setSelectedBank(bank);
  }, []);

  return {
    bankNames,
    duplicateKitDest,
    duplicateKitError,
    duplicateKitSource,
    error,
    focusBankInKitList, // expose for UI
    focusedKit,
    globalBankHotkeyHandler,
    handleBankClick,
    handleBankClickWithScroll, // expose for UI
    handleCreateKit,
    handleCreateNextKit,
    handleDuplicateKit,
    handleVisibleBankChange, // expose for KitList
    kits,
    newKitError,
    newKitSlot,
    nextKitSlot,
    scrollContainerRef,
    sdCardWarning,
    selectedBank,
    setBankNames,
    setDuplicateKitDest,
    setDuplicateKitError,
    setDuplicateKitSource,
    setError,
    setFocusedKit,
    setNewKitError,
    setNewKitSlot,
    setNextKitSlot,
    setSdCardWarning,
    setSelectedBank,
    setShowNewKit,
    showNewKit,
  };
}
