import type { Bank, KitWithRelations } from "@romper/shared/db/schema";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";

import { hasCommandModifier } from "../../../utils/keyboardShortcuts";
import { isModalDialogOpen } from "../../../utils/modalDialog";
import {
  bankHasKits,
  type BankNames,
  getFirstKitInBank,
} from "../../utils/bankOperations";
import { useTimeouts } from "../shared/useTimeouts";

export interface KitListComponent {
  scrollAndFocusKitByIndex: (index: number) => void;
}

interface UseKitBankNavigationProps {
  kitListRef: RefObject<KitListComponent | null>;
  kits: KitWithRelations[];
  /** The open store; its bank names are loaded when it changes */
  localStorePath?: null | string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

export function useKitBankNavigation({
  kitListRef,
  kits,
  localStorePath,
  onMessage,
}: UseKitBankNavigationProps) {
  const [selectedBank, setSelectedBank] = useState<string>("A");
  const [focusedKit, setFocusedKit] = useState<null | string>(null);
  const [bankNames, setBankNames] = useState<BankNames>({});
  // A bank with no kits the user picked in the bank index, shown in the
  // grid so a kit can be added to it (RE-64)
  const [shownEmptyBank, setShownEmptyBank] = useState<null | string>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTargetBankRef = useRef<null | string>(null);
  const timeouts = useTimeouts();
  // Counts bank-name loads, so only the latest one's answer is shown
  const bankNamesLoadRef = useRef({ latest: 0 });

  // Bank names come only from the banks (`get-all-banks`), never from the
  // kits: a bank with no kits, or whose kits a filter hides, has no kit to
  // carry its name (RE-90), and one source can't disagree with itself
  // (#567). Loaded when the store opens, which is also when setup has just
  // imported its names, and again after a rename.
  const loadBankNames = useCallback(async () => {
    const loads = bankNamesLoadRef.current;
    const load = ++loads.latest;
    const result = await globalThis.electronAPI.getAllBanks?.();
    if (load === loads.latest && result?.success && result.data) {
      setBankNames(namesFromBanks(result.data));
    }
  }, []);

  useEffect(() => {
    if (!localStorePath) return;
    const loads = bankNamesLoadRef.current;
    void loadBankNames();
    return () => {
      // A store closed or switched: drop its answer if it's still coming
      loads.latest++;
    };
  }, [localStorePath, loadBankNames]);

  // When the kits or the selected bank change, focus the first kit in that
  // bank, or the first kit when the kits changed and that bank has none
  const [focusFor, setFocusFor] = useState<{
    kits: KitWithRelations[];
    selectedBank: string;
  } | null>(null);
  if (focusFor?.kits !== kits || focusFor.selectedBank !== selectedBank) {
    setFocusFor({ kits, selectedBank });
    const firstInBank = bankHasKits(kits, selectedBank)
      ? getFirstKitInBank(kits, selectedBank)
      : null;
    if (firstInBank) {
      setFocusedKit(firstInBank);
    } else if (focusFor?.kits !== kits && kits && kits.length > 0) {
      setFocusedKit(kits[0].name);
    }
  }

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

      isProgrammaticScrollRef.current = true;
      scrollContainerRef.current.scrollTo({
        behavior: "auto",
        top: scrollContainerRef.current.scrollTop + offset,
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
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

  // Select a bank and keep it selected while the grid scrolls to it, so
  // visible-bank updates fired mid-scroll don't override the choice
  const holdSelectedBankWhileScrolling = useCallback(
    (bank: string) => {
      isProgrammaticScrollRef.current = true;
      scrollTargetBankRef.current = bank;
      setSelectedBank(bank);
      timeouts.set(() => {
        isProgrammaticScrollRef.current = false;
        // Restore correct bank in case IO fired during scroll
        if (scrollTargetBankRef.current) {
          setSelectedBank(scrollTargetBankRef.current);
          scrollTargetBankRef.current = null;
        }
      }, 1000);
    },
    [timeouts],
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
        holdSelectedBankWhileScrolling(bank);
        // Call for focus side-effects (setFocus + onFocusKit)
        kitListRef.current.scrollAndFocusKitByIndex(idx);
        setFocusedKit(kits[idx].name);
        // Override scroll: bank header to top so IO detects the correct bank
        const bankHeader = document.getElementById(`bank-${bank}`);
        if (bankHeader) {
          bankHeader.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      // If no kit in that bank, do not update selectedBank or focusedKit
    },
    [kits, kitListRef, holdSelectedBankWhileScrolling],
  );

  // Show a bank with no kits in the grid so a kit can be added to it
  const showEmptyBank = useCallback(
    (bank: string) => {
      holdSelectedBankWhileScrolling(bank);
      setShownEmptyBank(bank);
    },
    [holdSelectedBankWhileScrolling],
  );

  // Global A-Z hotkey handler: select bank and scroll/focus first kit
  const globalBankHotkeyHandler = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle hotkeys when typing in inputs
      const target = e.target as Element;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        return;
      }

      // Cmd/Ctrl/Alt combinations belong to the menu and the system
      if (hasCommandModifier(e)) return;
      // Keys pressed in a dialog are the dialog's (#500)
      if (isModalDialogOpen()) return;

      if (e.key.length === 1 && /^\p{Lu}$/u.test(e.key.toUpperCase())) {
        const bank = e.key.toUpperCase();

        // Only handle if bank has kits
        if (!bankHasKits(kits, bank)) return;

        // Use the same scroll path as sidebar clicks
        focusBankInKitList(bank);

        e.preventDefault();
      }
    },
    [kits, focusBankInKitList],
  );

  // Handler for visible bank change during scroll
  const handleVisibleBankChange = useCallback((bank: string) => {
    if (isProgrammaticScrollRef.current) return;
    setSelectedBank(bank);
  }, []);

  // Handler for bank name editing. An empty name clears the bank's name
  // (RE-23); main reports a name it can't save. No answer at all (the
  // preload method is missing) isn't a save either (#543). A saved name is
  // read back from the banks, as main stored it (#567).
  const handleBankNameChange = useCallback(
    async (bank: string, newName: string) => {
      const result = await globalThis.electronAPI?.updateBank?.(bank, {
        artist: newName || null,
      });

      if (result?.success) {
        await loadBankNames();
      } else {
        onMessage?.(
          result?.error ?? `Couldn't save the name of bank ${bank}`,
          "error",
        );
      }
    },
    [loadBankNames, onMessage],
  );

  return {
    bankNames,
    focusBankInKitList,
    focusedKit,
    globalBankHotkeyHandler,

    // Actions
    handleBankClick,
    handleBankClickWithScroll,
    handleBankNameChange,
    handleVisibleBankChange,
    scrollContainerRef,
    // State
    selectedBank,
    setBankNames,

    setFocusedKit,
    // Setters
    setSelectedBank,
    showEmptyBank,
    shownEmptyBank,
  };
}

/** The named banks in the database, by letter */
function namesFromBanks(banks: Bank[]): BankNames {
  const names: BankNames = {};
  for (const bank of banks) {
    if (bank.artist) names[bank.letter] = bank.artist;
  }
  return names;
}
