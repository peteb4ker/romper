import type { KitWithRelations } from "@romper/shared/db/schema";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { useKitListLogic } from "./hooks/kit-management/useKitListLogic";
import { useKitGridKeyboard } from "./hooks/useKitGridKeyboard";
import { useKitListNavigation } from "./hooks/kit-management/useKitListNavigation";
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
      className="col-span-full mt-4 mb-2 flex items-center gap-2 px-2"
      id={`bank-${bank}`}
      ref={headerRef}
    >
      <span className="font-bold text-sm tracking-widest text-blue-700 dark:text-blue-300">
        Bank {bank}
      </span>
      {bankName && (
        <span className="text-sm text-gray-600 dark:text-gray-300 italic">
          {bankName}
        </span>
      )}
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
  kitData?: KitWithRelations[]; // Kit data from database
  kits: KitWithRelations[];
  onBankFocus?: (bank: string) => void;
  onDuplicate: (kit: string) => void;
  onFocusKit?: (kit: string) => void; // NEW: notify parent of focus change
  onSelectKit: (kit: string) => void;
  onToggleFavorite?: (kitName: string) => void; // Task 20.1.2: Favorites functionality
  onVisibleBankChange?: (bank: string) => void; // NEW: notify when visible bank changes during scroll
  sampleCounts?: Record<string, [number, number, number, number]>;
}

// Grid layout constants
const CARD_WIDTH = 300; // Optimal card width from UX analysis
const CARD_HEIGHT = 90; // optimized vertical spacing
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
      kitData,
      kits,
      onBankFocus,
      onDuplicate,
      onFocusKit,
      onSelectKit,
      onToggleFavorite,
      onVisibleBankChange,
      sampleCounts,
    },
    ref,
  ) => {
    const { isValidKit, kitsToDisplay } = useKitListLogic(kits);
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
    const {
      getGridCoords,
      getFlatIndex,
      handleKeyDown,
      scrollAndFocusKitByIndex,
      scrollToKit,
    } = useKitGridKeyboard({
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
        className="h-full w-full bg-gray-50 dark:bg-slate-800 rounded pt-2 pb-2 pl-2 pr-2 overflow-y-auto"
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
          {Object.entries(kitsByBank).map(([bank, bankKits]) => (
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
                  key={kit.name}
                  focusedIdx={focusedIdx}
                  getKitFavoriteState={getKitFavoriteState}
                  kit={kit}
                  kitData={kitData}
                  kitsToDisplay={kitsToDisplay}
                  onDuplicate={onDuplicate}
                  onFocusKit={onFocusKit}
                  onSelectKit={onSelectKit}
                  onToggleFavorite={onToggleFavorite}
                  sampleCounts={sampleCounts}
                  setFocus={setFocus}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  },
);

KitGrid.displayName = "KitGrid";
export default React.memo(KitGrid);
