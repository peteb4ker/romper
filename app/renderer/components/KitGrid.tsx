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
import { useKitListNavigation } from "./hooks/kit-management/useKitListNavigation";
import KitGridItem from "./KitGridItem";

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
      }
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
    Math.min(MAX_COLUMNS, Math.floor(containerWidth / (CARD_WIDTH + GAP)))
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
    ref
  ) => {
    const { isValidKit, kitsToDisplay } = useKitListLogic(kits);
    const { containerRef, size } = useContainerSize();
    const columnCount = useResponsiveColumns(size.width);
    const rowCount = Math.ceil(kitsToDisplay.length / columnCount);

    // Navigation logic adapted for grid
    const navFocusedKit = typeof focusedKit === "string" ? focusedKit : null;
    const { focusedIdx, setFocus } = useKitListNavigation(
      kitsToDisplay,
      navFocusedKit
    );

    useEffect(() => {
      if (!navFocusedKit && kitsToDisplay.length > 0) {
        setFocus(0);
      }
    }, [navFocusedKit, kitsToDisplay, setFocus]);

    // Convert flat index to grid coordinates
    const getGridCoords = useCallback(
      (index: number) => {
        const rowIndex = Math.floor(index / columnCount);
        const columnIndex = index % columnCount;
        return { columnIndex, rowIndex };
      },
      [columnCount]
    );

    // Convert grid coordinates to flat index
    const getFlatIndex = useCallback(
      (rowIndex: number, columnIndex: number) => {
        return rowIndex * columnCount + columnIndex;
      },
      [columnCount]
    );

    // Scroll and focus logic for CSS grid
    const scrollAndFocusKitByIndex = useCallback(
      (idx: number) => {
        if (idx < 0 || idx >= kitsToDisplay.length) return;

        const kit = kitsToDisplay[idx];
        const kitElement = containerRef.current?.querySelector(
          `[data-kit="${kit.name}"]`
        );

        if (kitElement && containerRef.current) {
          kitElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }

        setFocus(idx);
        if (onFocusKit) onFocusKit(kitsToDisplay[idx].name);
      },
      [kitsToDisplay, setFocus, onFocusKit, containerRef]
    );

    // Helper function to scroll to a kit by name
    const scrollToKit = useCallback(
      (kitName: string) => {
        const index = kitsToDisplay.findIndex((kit) => kit.name === kitName);
        if (index !== -1) {
          scrollAndFocusKitByIndex(index);
        }
      },
      [kitsToDisplay, scrollAndFocusKitByIndex]
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollAndFocusKitByIndex,
        scrollToKit,
      }),
      [scrollAndFocusKitByIndex, scrollToKit]
    );

    // Helper function to handle bank selection via A-Z keys
    const handleBankSelection = (e: React.KeyboardEvent) => {
      const bank = e.key.toUpperCase();
      const idx = kitsToDisplay.findIndex(
        (k) => k?.name?.[0]?.toUpperCase() === bank
      );
      if (idx !== -1) {
        if (typeof onBankFocus === "function") onBankFocus(bank);
        scrollAndFocusKitByIndex(idx);
        e.preventDefault();
      }
    };

    // Helper function to handle kit selection (Enter/Space)
    const handleKitSelection = (e: React.KeyboardEvent) => {
      if (focusedIdx && focusedIdx < kitsToDisplay.length) {
        const kit = kitsToDisplay[focusedIdx];
        if (isValidKit(kit)) {
          onSelectKit(kit.name);
        }
      }
      e.preventDefault();
    };

    // Helper function to handle arrow key navigation
    const handleArrowNavigation = (e: React.KeyboardEvent) => {
      if (!focusedIdx) return;

      const { columnIndex, rowIndex } = getGridCoords(focusedIdx);
      let newRowIndex = rowIndex;
      let newColumnIndex = columnIndex;

      switch (e.key) {
        case "ArrowDown":
          newRowIndex = Math.min(rowCount - 1, rowIndex + 1);
          break;
        case "ArrowLeft":
          newColumnIndex = Math.max(0, columnIndex - 1);
          break;
        case "ArrowRight":
          newColumnIndex = Math.min(columnCount - 1, columnIndex + 1);
          break;
        case "ArrowUp":
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
      }

      const newIndex = getFlatIndex(newRowIndex, newColumnIndex);
      if (newIndex < kitsToDisplay.length) {
        scrollAndFocusKitByIndex(newIndex);
      }
      e.preventDefault();
    };

    // Grid keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      // A-Z hotkey: select first kit in bank
      if (e.key.length === 1 && /^\p{Lu}$/u.test(e.key.toUpperCase())) {
        handleBankSelection(e);
        return;
      }

      // Enter/Space: select focused kit
      if (e.key === "Enter" || e.key === " ") {
        handleKitSelection(e);
        return;
      }

      // Arrow key navigation for grid
      if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        handleArrowNavigation(e);
      }
    };

    // Group kits by bank for rendering with headers
    const kitsByBank = kitsToDisplay.reduce(
      (acc, kit) => {
        const bank = kit.name[0];
        if (!acc[bank]) acc[bank] = [];
        acc[bank].push(kit);
        return acc;
      },
      {} as Record<string, typeof kitsToDisplay>
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
              {bankKits.map((kit) => {
                const globalIndex = kitsToDisplay.findIndex(
                  (k) => k.name === kit.name
                );
                const isValid = isValidKit(kit);
                const isSelected = focusedIdx === globalIndex;
                const kitDataItem =
                  kitData?.find((k) => k.name === kit.name) ?? null;

                // Compute the favorite state for this kit
                const isFavorite = getKitFavoriteState
                  ? getKitFavoriteState(kit.name)
                  : kitDataItem?.is_favorite;

                const handleSelectKit = () => {
                  if (isValid) {
                    onSelectKit(kit.name);
                    if (onFocusKit) onFocusKit(kit.name);
                    setFocus(globalIndex);
                  }
                };

                return (
                  <div key={kit.name} style={{ height: CARD_HEIGHT }}>
                    <KitGridItem
                      data-kit={kit.name}
                      data-testid={`kit-item-${kit.name}`}
                      isFavorite={isFavorite}
                      isSelected={isSelected}
                      isValid={isValid}
                      kit={kit.name}
                      kitData={kitDataItem}
                      onDuplicate={() => isValid && onDuplicate(kit.name)}
                      onSelect={handleSelectKit}
                      onToggleFavorite={onToggleFavorite}
                      sampleCounts={
                        sampleCounts ? sampleCounts[kit.name] : undefined
                      }
                    />
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
);

KitGrid.displayName = "KitGrid";
export default React.memo(KitGrid);
