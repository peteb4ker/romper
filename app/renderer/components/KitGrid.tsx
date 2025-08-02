import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import type { KitWithRelations } from "../../../shared/db/schema";
import { useKitListLogic } from "./hooks/useKitListLogic";
import { useKitListNavigation } from "./hooks/useKitListNavigation";
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
        threshold: 0.5,
        rootMargin: "-10% 0px -80% 0px",
      },
    );

    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [bank, onBankVisible]);

  return (
    <div
      ref={headerRef}
      id={`bank-${bank}`}
      className="col-span-full mt-4 mb-2 flex items-center gap-2 px-2"
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

interface KitGridProps {
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
  // onToggleFavorite?: (kitName: string) => void; // Task 20.1.2: Favorites functionality - temporarily disabled
}

// Expose imperative scroll/focus API for parent components
export interface KitGridHandle {
  scrollAndFocusKitByIndex: (idx: number) => void;
}

// Grid layout constants
const CARD_WIDTH = 300; // Optimal card width from UX analysis
const CARD_HEIGHT = 90; // Compact height with optimized vertical spacing
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
  const [size, setSize] = useState({ width: 1200, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if ResizeObserver is available (not in test environment)
    if (typeof ResizeObserver === "undefined") {
      // Fallback for test environment
      const rect = containerRef.current.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width) || 1200,
        height: Math.floor(rect.height) || 600,
      });
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });

    observer.observe(containerRef.current);

    // Initial size
    const rect = containerRef.current.getBoundingClientRect();
    setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });

    return () => observer.disconnect();
  }, []);

  return { size, containerRef };
};

const KitGrid = forwardRef<KitGridHandle, KitGridProps>(
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
      // onToggleFavorite,
    },
    ref,
  ) => {
    const { kitsToDisplay, isValidKit } = useKitListLogic(kits);
    const { size, containerRef } = useContainerSize();
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

    // Convert flat index to grid coordinates
    const getGridCoords = useCallback(
      (index: number) => {
        const rowIndex = Math.floor(index / columnCount);
        const columnIndex = index % columnCount;
        return { rowIndex, columnIndex };
      },
      [columnCount],
    );

    // Convert grid coordinates to flat index
    const getFlatIndex = useCallback(
      (rowIndex: number, columnIndex: number) => {
        return rowIndex * columnCount + columnIndex;
      },
      [columnCount],
    );

    // Scroll and focus logic for CSS grid
    const scrollAndFocusKitByIndex = useCallback(
      (idx: number) => {
        if (idx < 0 || idx >= kitsToDisplay.length) return;

        const kit = kitsToDisplay[idx];
        const kitElement = containerRef.current?.querySelector(
          `[data-kit="${kit.name}"]`,
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
      [kitsToDisplay, setFocus, onFocusKit, containerRef],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollAndFocusKitByIndex,
      }),
      [scrollAndFocusKitByIndex],
    );

    // Helper function to handle bank selection via A-Z keys
    const handleBankSelection = (e: React.KeyboardEvent) => {
      const bank = e.key.toUpperCase();
      const idx = kitsToDisplay.findIndex(
        (k) => k?.name?.[0]?.toUpperCase() === bank,
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

      const { rowIndex, columnIndex } = getGridCoords(focusedIdx);
      let newRowIndex = rowIndex;
      let newColumnIndex = columnIndex;

      switch (e.key) {
        case "ArrowUp":
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case "ArrowDown":
          newRowIndex = Math.min(rowCount - 1, rowIndex + 1);
          break;
        case "ArrowLeft":
          newColumnIndex = Math.max(0, columnIndex - 1);
          break;
        case "ArrowRight":
          newColumnIndex = Math.min(columnCount - 1, columnIndex + 1);
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
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
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
      {} as Record<string, typeof kitsToDisplay>,
    );

    return (
      <div
        ref={containerRef}
        className="h-full w-full bg-gray-50 dark:bg-slate-800 rounded pt-2 pb-2 pl-2 pr-2 overflow-y-auto"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="grid"
        aria-label="Kit grid"
        data-testid="kit-grid"
        style={{ minHeight: 400 }} // Ensure minimum height
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
                  (k) => k.name === kit.name,
                );
                const isValid = isValidKit(kit);
                const isSelected = focusedIdx === globalIndex;
                const kitDataItem =
                  kitData?.find((k) => k.name === kit.name) ?? null;

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
                      kit={kit.name}
                      isValid={isValid}
                      onSelect={handleSelectKit}
                      onDuplicate={() => isValid && onDuplicate(kit.name)}
                      sampleCounts={
                        sampleCounts ? sampleCounts[kit.name] : undefined
                      }
                      kitData={kitDataItem}
                      isSelected={isSelected}
                      // onToggleFavorite={onToggleFavorite}
                      data-kit={kit.name}
                      data-testid={`kit-item-${kit.name}`}
                    />
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  },
);

KitGrid.displayName = "KitGrid";
export default React.memo(KitGrid);
