import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { ListChildComponentProps, VariableSizeList } from "react-window";

import type { Kit, KitWithRelations } from "../../../shared/db/schema";
import { useKitListLogic } from "./hooks/useKitListLogic";
import { useKitListNavigation } from "./hooks/useKitListNavigation";
import KitItem from "./KitItem";

// Bank header component with intersection observer
interface BankHeaderProps {
  bank: string;
  bankName?: string;
  onBankVisible?: (bank: string) => void;
}

const BankHeader: React.FC<BankHeaderProps> = ({
  bank,
  bankName,
  onBankVisible,
}) => {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerRef.current || !onBankVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onBankVisible(bank);
        }
      },
      {
        threshold: 0.5, // Trigger when 50% of the header is visible
        rootMargin: "-10% 0px -80% 0px", // Only consider the top 20% of the viewport
      },
    );

    observer.observe(headerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [bank, onBankVisible]);

  return (
    <div
      ref={headerRef}
      id={`bank-${bank}`}
      className="mt-2 mb-1 flex items-center gap-2"
    >
      <span className="font-bold text-xs tracking-widest text-blue-700 dark:text-blue-300">
        Bank {bank}
      </span>
      {bankName && (
        <span className="text-xs text-gray-600 dark:text-gray-300 italic">
          {bankName}
        </span>
      )}
    </div>
  );
};

interface KitListProps {
  kits: KitWithRelations[];
  onSelectKit: (kit: string) => void;
  bankNames: Record<string, string>;
  onDuplicate: (kit: string) => void;
  kitData?: KitWithRelations[]; // Kit data from database
  sampleCounts?: Record<string, [number, number, number, number]>;
  focusedKit?: string | null; // externally controlled focus
  onBankFocus?: (bank: string) => void;
  onFocusKit?: (kit: string) => void; // NEW: notify parent of focus change
  onVisibleBankChange?: (bank: string) => void; // NEW: notify when visible bank changes during scroll
}

// Expose imperative scroll/focus API for parent components
export interface KitListHandle {
  scrollAndFocusKitByIndex: (idx: number) => void;
}

const KIT_ROW_HEIGHT = 72; // px
const BANK_ROW_HEIGHT = 100; // px, adjust as needed for anchor+kit
const HEADER_HEIGHT = 5; // px, set to your fixed header height

const KitList = forwardRef<KitListHandle, KitListProps>(
  (
    {
      kits,
      onSelectKit,
      bankNames,
      onDuplicate,
      kitData,
      sampleCounts,
      focusedKit,
      onBankFocus,
      onFocusKit,
      onVisibleBankChange,
    },
    ref,
  ) => {
    const { kitsToDisplay, isValidKit, getColorClass, showBankAnchor } =
      useKitListLogic(kits);
    // Only use focusedKit if defined, otherwise undefined
    const navFocusedKit = typeof focusedKit === "string" ? focusedKit : null;
    const { focusedIdx, setFocus, moveFocus } = useKitListNavigation(
      kitsToDisplay,
      navFocusedKit,
    );
    const kitRefs = useRef<(HTMLDivElement | null)[]>([]);
    const listRef = useRef<VariableSizeList>(null);

    useEffect(() => {
      if (focusedIdx != null && kitRefs.current[focusedIdx]) {
        kitRefs.current[focusedIdx]?.focus();
      }
    }, [focusedIdx, kitsToDisplay]);

    useEffect(() => {
      if (!navFocusedKit && kitsToDisplay.length > 0) {
        setFocus(0);
      }
    }, [navFocusedKit, kitsToDisplay, setFocus]);

    // selectedIdx is always derived from focusedIdx (not just focusedKit)
    const selectedIdx = focusedIdx;

    // Precompute which rows have anchors for height calculation
    const rowHasAnchor = kitsToDisplay.map((kit, idx, arr) =>
      showBankAnchor(kit, idx, arr),
    );

    // Height function for VariableSizeList
    const getItemSize = useCallback(
      (index: number) =>
        rowHasAnchor[index] ? BANK_ROW_HEIGHT : KIT_ROW_HEIGHT,
      [rowHasAnchor],
    );

    // Helper to sum row heights up to a given index
    const getOffsetForIndex = useCallback(
      (index: number) => {
        let offset = 0;
        for (let i = 0; i < index; i++) {
          offset += getItemSize(i);
        }
        return offset;
      },
      [getItemSize],
    );

    // Shared scroll and focus logic
    const scrollAndFocusKitByIndex = useCallback(
      (idx: number) => {
        if (idx < 0 || idx >= kitsToDisplay.length) return;
        if (listRef.current) {
          const offset = getOffsetForIndex(idx) - HEADER_HEIGHT;
          listRef.current.scrollTo(Math.max(0, offset));
          console.log(
            "[KitList] scrollAndFocusKitByIndex",
            idx,
            "offset",
            offset,
          );
        } else {
          console.warn("[KitList] listRef.current is null");
        }
        setFocus(idx);
        if (onFocusKit) onFocusKit(kitsToDisplay[idx].name);
      },
      [kitsToDisplay, setFocus, onFocusKit, getOffsetForIndex],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollAndFocusKitByIndex,
      }),
      [scrollAndFocusKitByIndex],
    );

    // Keyboard navigation handler: Support A-Z hotkeys only (remove up/down/left/right/Enter/Space)
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      // A-Z hotkey: select first kit in bank
      if (e.key.length === 1 && /^[A-Z]$/.test(e.key.toUpperCase())) {
        const bank = e.key.toUpperCase();
        const idx = kitsToDisplay.findIndex(
          (k) => k && k.name && k.name[0] && k.name[0].toUpperCase() === bank,
        );
        if (idx !== -1) {
          if (typeof onBankFocus === "function") onBankFocus(bank);
          if (onFocusKit) onFocusKit(kitsToDisplay[idx].name);
          setFocus(idx);
          e.preventDefault();
        } else {
          e.preventDefault();
        }
        return;
      }
      // All other keys: do nothing
    };

    // Click handler: always notify parent
    const handleSelectKit = (kitName: string, idx: number) => {
      const kit = kitsToDisplay[idx];
      if (isValidKit(kit)) {
        onSelectKit(kitName);
        if (onFocusKit) onFocusKit(kitName);
        setFocus(idx);
      }
    };

    // Virtualized row renderer
    const Row = ({ index, style }: ListChildComponentProps) => {
      const kit = kitsToDisplay[index];
      const kitName = kit.name;
      const isValid = isValidKit(kit);
      const colorClass = getColorClass(kit);
      const showAnchor = rowHasAnchor[index];
      const isSelected = selectedIdx === index;
      // Get kit data from kitData array
      const kitDataItem = kitData?.find((k) => k.name === kitName) || null;
      return (
        <div style={style}>
          {showAnchor && (
            <BankHeader
              bank={kitName[0]}
              bankName={bankNames[kitName[0]]}
              onBankVisible={onVisibleBankChange}
            />
          )}
          <KitItem
            kit={kitName}
            colorClass={colorClass}
            isValid={isValid}
            onSelect={() => handleSelectKit(kitName, index)}
            onDuplicate={() => isValid && onDuplicate(kitName)}
            sampleCounts={sampleCounts ? sampleCounts[kitName] : undefined}
            kitData={kitDataItem}
            data-kit={kitName}
            data-testid={`kit-item-${kitName}`}
            isSelected={isSelected}
          />
        </div>
      );
    };

    return (
      <div
        className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded pt-0 pb-2 pl-2 pr-2"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Kit list"
        data-testid="kit-list"
      >
        <VariableSizeList
          ref={listRef}
          height={600} // or use a prop or container height
          itemCount={kitsToDisplay.length}
          itemSize={getItemSize}
          width="100%"
        >
          {Row}
        </VariableSizeList>
      </div>
    );
  },
);

export default React.memo(KitList);
