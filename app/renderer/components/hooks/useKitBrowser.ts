import React, {
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getNextKitSlot,
  toCapitalCase,
} from "../../../../shared/kitUtilsShared";

interface UseKitBrowserProps {
  kits: string[];
  sdCardPath: string;
  onRefreshKits?: () => void;
  kitListRef: RefObject<any>;
  onMessage?: (msg: { text: string; type?: string; duration?: number }) => void;
}

interface BankNames {
  [bank: string]: string;
}

export function useKitBrowser({
  kits: externalKits = [],
  sdCardPath,
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

  const getBankNames = useCallback(
    async (sdCardPath: string): Promise<BankNames> => {
      if (!sdCardPath) return {};
      try {
        const files = await window.electronAPI?.listFilesInRoot?.(sdCardPath);
        if (!files) return {};
        const rtfFiles = files.filter((f: string) =>
          /^[A-Z] - .+\.rtf$/i.test(f),
        );
        const bankNames: BankNames = {};
        for (const file of rtfFiles) {
          const match = /^([A-Z]) - (.+)\.rtf$/i.exec(file);
          if (match) {
            const bank = match[1].toUpperCase();
            const name = toCapitalCase(match[2]);
            bankNames[bank] = name;
          }
        }
        return bankNames;
      } catch (e) {}
      return {};
    },
    [],
  );

  useEffect(() => {
    (async () => {
      setBankNames(await getBankNames(sdCardPath));
    })();
  }, [sdCardPath, getBankNames]);

  const handleCreateKit = async () => {
    setNewKitError(null);
    if (!/^[A-Z][0-9]{1,2}$/.test(newKitSlot)) {
      setNewKitError("Invalid kit slot. Use format A0-Z99.");
      return;
    }
    if (!sdCardPath) return;
    try {
      await window.electronAPI?.createKit?.(sdCardPath, newKitSlot);
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
      setNewKitError(
        "Failed to create kit: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  const handleCreateNextKit = async () => {
    setNewKitError(null);
    if (!nextKitSlot || !/^[A-Z][0-9]{1,2}$/.test(nextKitSlot)) {
      setNewKitError("No next kit slot available.");
      return;
    }
    if (!sdCardPath) return;
    try {
      await window.electronAPI?.createKit?.(sdCardPath, nextKitSlot);
      if (onRefreshKits) onRefreshKits();
    } catch (err) {
      setNewKitError(
        "Failed to create kit: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  const handleDuplicateKit = async () => {
    setDuplicateKitError(null);
    if (!duplicateKitSource || !/^[A-Z][0-9]{1,2}$/.test(duplicateKitDest)) {
      setDuplicateKitError("Invalid destination slot. Use format A0-Z99.");
      return;
    }
    if (!sdCardPath) return;
    try {
      await window.electronAPI?.copyKit?.(
        sdCardPath,
        duplicateKitSource,
        duplicateKitDest,
      );
      setDuplicateKitSource(null);
      setDuplicateKitDest("");
      if (onRefreshKits) onRefreshKits();
    } catch (err) {
      let msg = String(err instanceof Error ? err.message : err);
      msg = msg
        .replace(/^Error invoking remote method 'copy-kit':\s*/, "")
        .replace(/^Error:\s*/, "");
      setDuplicateKitError(msg);
    }
  };

  // --- Bank selection state and logic (moved from KitBrowser) ---
  const [selectedBank, setSelectedBank] = useState<string>("A");
  const handleBankClick = useCallback(
    (bank: string) => {
      // Only scroll if the bank has kits
      if (!kits.some((k) => k[0] === bank)) return;
      const el = document.getElementById(`bank-${bank}`);
      if (el && scrollContainerRef.current) {
        const header = document.querySelector(".sticky.top-0");
        const headerHeight =
          header instanceof HTMLElement ? header.offsetHeight : 0;
        const containerRect =
          scrollContainerRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offset = elRect.top - containerRect.top - headerHeight - 8;
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollTop + offset,
          behavior: "auto",
        });
      }
    },
    [kits, scrollContainerRef],
  );
  const handleBankClickWithScroll = useCallback(
    (bank: string) => {
      // Only update selectedBank if the bank has kits
      if (!kits.some((k) => k[0] === bank)) return;
      setSelectedBank(bank);
      handleBankClick(bank);
    },
    [kits, handleBankClick],
  );

  const handleSelectSdCard = async () => {
    const selected = await window.electronAPI.selectSdCard();
    if (selected) {
      window.electronAPI.setSetting("sdCardPath", selected);
    }
  };

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
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key.length === 1 && /^[A-Z]$/.test(e.key.toUpperCase())) {
        const bank = e.key.toUpperCase();
        if (!kits.some((k) => k[0] === bank)) return; // Only if bank has kits
        setSelectedBank(bank);
        handleBankClick(bank);
        // Focus first kit in that bank
        const firstKit = kits.find((k) => k.startsWith(bank));
        if (firstKit) setFocusedKit(firstKit);
        e.preventDefault();
      }
    },
    [kits, setSelectedBank, handleBankClick],
  );

  // When selectedBank changes (e.g. via UI), focus first kit in that bank
  useEffect(() => {
    if (!kits.some((k) => k[0] === selectedBank)) return;
    const firstKit = kits.find((k) => k.startsWith(selectedBank));
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
    handleSelectSdCard,
    focusedKit,
    setFocusedKit,
    globalBankHotkeyHandler,
    focusBankInKitList, // expose for UI
  };
}
