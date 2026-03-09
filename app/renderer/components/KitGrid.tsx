import type { KitWithRelations } from "@romper/shared/db/schema";

import { getNextSlotInBank } from "@romper/shared/kitUtilsShared";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import AddKitCard from "./AddKitCard";
import { useKitListLogic } from "./hooks/kit-management/useKitListLogic";
import { useKitListNavigation } from "./hooks/kit-management/useKitListNavigation";
import { useKitGridKeyboard } from "./hooks/useKitGridKeyboard";
import { KitGridCard } from "./KitGridCard";

// Bank header component for grid layout
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
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0.5,
      },
    );

    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [bank, onBankVisible]);

  return (
    <div
      className="col-span-full mt-5 first:mt-1"
      id={`bank-${bank}`}
      ref={headerRef}
    >
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle">
        <span className="font-mono font-black text-xl text-accent-primary leading-none">
          {bank}
        </span>
        {bankName && (
          <span className="text-sm text-text-secondary tracking-wide truncate">
            {bankName}
          </span>
        )}
      </div>
    </div>
  );
};

// Expose imperative scroll/focus API for parent components
export interface KitGridHandle {
  scrollAndFocusKitByIndex: (idx: number) => void;
  scrollToKit: (kitName: string) => void;
}

interface KitGridProps {
  bankNames: Record<string, string>;
  focusedKit?: null | string; // externally controlled focus
  getKitFavoriteState?: (kitName: string) => boolean; // Still needed for computing state
  isCreatingKit?: boolean;
  isFiltered?: boolean;
  kitData?: KitWithRelations[]; // Kit data from database
  kits: KitWithRelations[];
  onBankFocus?: (bank: string) => void;
  onCreateKitInBank?: (bankLetter: string) => void;
  onDelete?: (kit: string) => void;
  onDeleteKit?: (kitName: string) => Promise<void>;
  onDuplicate: (kit: string) => void;
  onDuplicateKit?: (
    source: string,
    dest: string,
  ) => Promise<{ error?: string }>;
  onFocusKit?: (kit: string) => void;
  onRequestDeleteSummary?: (
    kitName: string,
  ) => Promise<{ locked: boolean; sampleCount: number } | null>;
  onSelectKit: (kit: string) => void;
  onToggleFavorite?: (kitName: string) => void; // Task 20.1.2: Favorites functionality
  onVisibleBankChange?: (bank: string) => void; // NEW: notify when visible bank changes during scroll
  sampleCounts?: Record<string, [number, number, number, number]>;
}

// Grid layout constants
const CARD_WIDTH = 300; // Optimal card width from UX analysis
const GAP = 12; // Gap between cards
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;

// Hook for responsive column calculation
const useResponsiveColumns = (containerWidth: number) => {
  return Math.max(
    MIN_COLUMNS,
    Math.min(MAX_COLUMNS, Math.floor(containerWidth / (CARD_WIDTH + GAP))),
  );
};

// Hook for container size
const useContainerSize = () => {
  const [size, setSize] = useState({ height: 600, width: 1200 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if ResizeObserver is available (not in test environment)
    if (typeof ResizeObserver === "undefined") {
      // Fallback for test environment
      const rect = containerRef.current.getBoundingClientRect();
      setSize({
        height: Math.floor(rect.height) || 600,
        width: Math.floor(rect.width) || 1200,
      });
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height, width } = entry.contentRect;
        setSize({ height: Math.floor(height), width: Math.floor(width) });
      }
    });

    observer.observe(containerRef.current);

    // Initial size
    const rect = containerRef.current.getBoundingClientRect();
    setSize({ height: Math.floor(rect.height), width: Math.floor(rect.width) });

    return () => observer.disconnect();
  }, []);

  return { containerRef, size };
};

const KitGrid = forwardRef<KitGridHandle, KitGridProps>(
  (
    {
      bankNames,
      focusedKit,
      getKitFavoriteState,
      isCreatingKit,
      isFiltered,
      kitData,
      kits,
      onBankFocus,
      onCreateKitInBank,
      onDelete,
      onDeleteKit,
      onDuplicate,
      onDuplicateKit,
      onFocusKit,
      onRequestDeleteSummary,
      onSelectKit,
      onToggleFavorite,
      onVisibleBankChange,
      sampleCounts,
    },
    ref,
  ) => {
    const { kitsToDisplay } = useKitListLogic(kits);
    const { containerRef, size } = useContainerSize();
    const columnCount = useResponsiveColumns(size.width);
    const rowCount = Math.ceil(kitsToDisplay.length / columnCount);

    // Navigation logic adapted for grid
    const navFocusedKit = typeof focusedKit === "string" ? focusedKit : null;
    const { focusedIdx, setFocus } = useKitListNavigation(
      kitsToDisplay,
      navFocusedKit,
    );

    useEffect(() => {
      if (!navFocusedKit && kitsToDisplay.length > 0) {
        setFocus(0);
      }
    }, [navFocusedKit, kitsToDisplay, setFocus]);

    // Use keyboard navigation hook
    const { handleKeyDown, scrollAndFocusKitByIndex, scrollToKit } =
      useKitGridKeyboard({
        columnCount,
        containerRef,
        focusedIdx,
        kitsToDisplay,
        onBankFocus,
        onFocusKit,
        onSelectKit,
        rowCount,
        setFocus,
      });

    useImperativeHandle(
      ref,
      () => ({
        scrollAndFocusKitByIndex,
        scrollToKit,
      }),
      [scrollAndFocusKitByIndex, scrollToKit],
    );

    // Group kits by bank for rendering with headers
    const kitsByBank = kitsToDisplay.reduce(
      (acc, kit) => {
        const bank = kit.name[0];
        if (!acc[bank]) acc[bank] = [];
        acc[bank].push(kit);
        return acc;
      },
      {} as Record<string, typeof kitsToDisplay>,
    );

    return (
      <div
        aria-label="Kit grid"
        className="h-full w-full bg-surface-1 rounded pt-2 pb-2 pl-2 pr-2 overflow-y-auto"
        data-testid="kit-grid"
        onKeyDown={handleKeyDown}
        ref={containerRef}
        role="grid"
        style={{ minHeight: 400 }} // Ensure minimum height
        tabIndex={0}
      >
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, ${CARD_WIDTH}px)`,
            justifyContent: "center",
          }}
        >
          {Object.entries(kitsByBank).map(([bank, bankKits]) => {
            const existingNames = kitsToDisplay.map((k) => k.name);
            const bankHasRoom = getNextSlotInBank(bank, existingNames) !== null;

            return (
              <React.Fragment key={bank}>
                {/* Bank header spans all columns */}
                <BankHeader
                  bank={bank}
                  bankName={bankNames[bank]}
                  onBankVisible={onVisibleBankChange}
                />
                {/* Kit cards for this bank */}
                {bankKits.map((kit) => (
                  <KitGridCard
                    focusedIdx={focusedIdx}
                    getKitFavoriteState={getKitFavoriteState}
                    key={kit.name}
                    kit={kit}
                    kitData={kitData}
                    kitsToDisplay={kitsToDisplay}
                    onDelete={onDelete}
                    onDeleteKit={onDeleteKit}
                    onDuplicate={onDuplicate}
                    onDuplicateKit={onDuplicateKit}
                    onFocusKit={onFocusKit}
                    onRequestDeleteSummary={onRequestDeleteSummary}
                    onSelectKit={onSelectKit}
                    onToggleFavorite={onToggleFavorite}
                    sampleCounts={sampleCounts}
                    setFocus={setFocus}
                  />
                ))}
                {/* Add kit card at end of bank */}
                {!isFiltered && bankHasRoom && onCreateKitInBank && (
                  <AddKitCard
                    bankLetter={bank}
                    isCreating={!!isCreatingKit}
                    onClick={onCreateKitInBank}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  },
);

KitGrid.displayName = "KitGrid";
export default React.memo(KitGrid);
