import React, {
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { getNextKitSlot } from "../../../../shared/kitUtilsShared";
import {
  bankHasKits,
  type BankNames,
  getBankNames,
  getFirstKitInBank,
} from "../utils/bankOperations";
import {
  createKit,
  duplicateKit,
  formatKitError,
  validateKitSlot,
} from "../utils/kitOperations";

interface UseKitBrowserProps {
  kits: string[];
  localStorePath: string;
  onRefreshKits?: () => void;
  kitListRef: RefObject<any>;
  onMessage?: (msg: { text: string; type?: string; duration?: number }) => void;
}

export function useKitBrowser({
  kits: externalKits = [],
  localStorePath,
  onRefreshKits,
  kitListRef,
  onMessage,
}: UseKitBrowserProps) {
  const kits: string[] = externalKits;
  const [error, setError] = useState<string | null>(null);
  const [sdCardWarning, setSdCardWarning] = useState<string | null>(null);
  const [showNewKit, setShowNewKit] = useState(false);
  const [newKitSlot, setNewKitSlot] = useState("");
  const [newKitError, setNewKitError] = useState<string | null>(null);
  const [nextKitSlot, setNextKitSlot] = useState<string | null>(null);
  const [duplicateKitSource, setDuplicateKitSource] = useState<string | null>(
    null,
  );
  const [duplicateKitDest, setDuplicateKitDest] = useState("");
  const [duplicateKitError, setDuplicateKitError] = useState<string | null>(
    null,
  );
  const [bankNames, setBankNames] = useState<BankNames>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNextKitSlot(getNextKitSlot(kits));
  }, [kits]);

  useEffect(() => {
    (async () => {
      setBankNames(await getBankNames(localStorePath));
    })();
  }, [localStorePath]);

  const handleCreateKit = async () => {
    setNewKitError(null);
    if (!validateKitSlot(newKitSlot)) {
      setNewKitError("Invalid kit slot. Use format A0-Z99.");
      return;
    }
    if (!localStorePath) return;

    try {
      await createKit(localStorePath, newKitSlot);
      setShowNewKit(false);
      setNewKitSlot("");
      if (onRefreshKits) onRefreshKits();
      if (onMessage)
        onMessage({
          text: `Kit ${newKitSlot} created successfully!`,
          type: "info",
          duration: 4000,
        });
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
    if (!localStorePath) return;

    try {
      await createKit(localStorePath, nextKitSlot);
      if (onRefreshKits) onRefreshKits();
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
    if (!localStorePath) return;

    try {
      await duplicateKit(localStorePath, duplicateKitSource, duplicateKitDest);
      setDuplicateKitSource(null);
      setDuplicateKitDest("");
      if (onRefreshKits) onRefreshKits();
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
        top: scrollContainerRef.current.scrollTop + offset,
        behavior: "auto",
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
  const [focusedKit, setFocusedKit] = useState<string | null>(null);

  // On kits change, focus the first kit
  useEffect(() => {
    if (kits && kits.length > 0) {
      setFocusedKit(kits[0]);
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

      if (e.key.length === 1 && /^[A-Z]$/.test(e.key.toUpperCase())) {
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
      const idx = kits.findIndex(
        (k) =>
          k && typeof k === "string" && k[0] && k[0].toUpperCase() === bank,
      );
      if (
        idx !== -1 &&
        kitListRef &&
        kitListRef.current &&
        typeof kitListRef.current.scrollAndFocusKitByIndex === "function"
      ) {
        setSelectedBank(bank);
        kitListRef.current.scrollAndFocusKitByIndex(idx);
        setFocusedKit(kits[idx]);
      } else {
        // If no kit in that bank, do not update selectedBank or focusedKit
      }
    },
    [kits, kitListRef],
  );

  return {
    kits,
    error,
    setError,
    sdCardWarning,
    setSdCardWarning,
    showNewKit,
    setShowNewKit,
    newKitSlot,
    setNewKitSlot,
    newKitError,
    setNewKitError,
    nextKitSlot,
    setNextKitSlot,
    duplicateKitSource,
    setDuplicateKitSource,
    duplicateKitDest,
    setDuplicateKitDest,
    duplicateKitError,
    setDuplicateKitError,
    bankNames,
    setBankNames,
    scrollContainerRef,
    handleCreateKit,
    handleCreateNextKit,
    handleDuplicateKit,
    handleBankClick,
    handleBankClickWithScroll, // expose for UI
    selectedBank,
    setSelectedBank,
    focusedKit,
    setFocusedKit,
    globalBankHotkeyHandler,
    focusBankInKitList, // expose for UI
  };
}
