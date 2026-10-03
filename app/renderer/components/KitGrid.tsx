import type { KitWithRelations } from "@romper/shared/db/schema";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ListChildComponentProps,
  ListOnItemsRenderedProps,
  VariableSizeList,
} from "react-window";

import type { KitWithSearchMatch } from "./shared/kitItemUtils";

import AddKitCard from "./AddKitCard";
import BankHeader from "./BankHeader";
import { useKitListLogic } from "./hooks/kit-management/useKitListLogic";
import { useKitListNavigation } from "./hooks/kit-management/useKitListNavigation";
import { useKitGridKeyboard } from "./hooks/useKitGridKeyboard";
import { KitGridCard } from "./KitGridCard";
import { buildGridRows, type GridRow, type KitsRow } from "./utils/kitGridRows";

// Expose imperative scroll/focus API for parent components
export interface KitGridHandle {
  scrollAndFocusKitByIndex: (idx: number) => void;
  scrollToKit: (kitName: string) => void;
}

interface KitGridProps {
  bankNames: Record<string, string>;
  emptyBank?: null | string; // bank with no kits to show with an add-kit card (RE-64)
  focusedKit?: null | string; // externally controlled focus
  isCreatingKit?: boolean;
  isFiltered?: boolean;
  kitData?: KitWithRelations[]; // Kit data from database
  kits: KitWithRelations[];
  newlyAnimatedKit?: null | string; // Kit name that should play entrance animation
  onBankFocus?: (bank: string) => void;
  onBankNameChange?: (bank: string, newName: string) => void;
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
const CARD_HEIGHT = 104; // Must match KitGridCard / AddKitCard
const GAP = 12; // Gap between cards
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;

// Virtualized row heights
const KIT_ROW_HEIGHT = CARD_HEIGHT + GAP; // card + bottom gap
const BANK_HEADER_HEIGHT = 60; // header content + bottom gap
const BANK_SPACING = 16; // extra top spacing before non-first banks
const HINT_ROW_HEIGHT = 40; // empty-library hint above the first bank
const MATCH_LINE_HEIGHT = 20; // per matched-sample line when a card expands
const OVERSCAN_ROW_COUNT = 2;

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

// Props threaded through react-window's itemData to the row renderer
interface GridRowData {
  bankNames: Record<string, string>;
  focusedIdx: null | number;
  gridWidth: number;
  isCreatingKit?: boolean;
  kitData?: KitWithRelations[];
  kitsToDisplay: KitWithRelations[];
  newlyAnimatedKit?: null | string;
  onBankNameChange?: (bank: string, newName: string) => void;
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
  onToggleFavorite?: (kitName: string) => void;
  rows: GridRow[];
  sampleCounts?: Record<string, [number, number, number, number]>;
  setFocus: (index: number) => void;
}

// Extra row height needed when search-matched samples expand a card
function getRowExpansionExtra(
  row: KitsRow,
  kitData: KitWithRelations[] | undefined,
): number {
  let maxLines = 0;
  for (const kit of row.kits) {
    const kitDataItem = kitData?.find((k) => k.name === kit.name) as
      | KitWithSearchMatch
      | undefined;
    const byVoice = kitDataItem?.searchMatch?.matchedSamplesByVoice;
    if (!byVoice) continue;
    for (const matches of Object.values(byVoice)) {
      maxLines = Math.max(maxLines, matches.length);
    }
  }
  return maxLines * MATCH_LINE_HEIGHT;
}

const GridRowRenderer: React.FC<ListChildComponentProps<GridRowData>> = ({
  data,
  index,
  style,
}) => {
  const row = data.rows[index];
  if (!row) return null;

  const innerStyle: React.CSSProperties = {
    margin: "0 auto",
    width: data.gridWidth,
  };

  if (row.type === "hint") {
    return (
      <div style={style}>
        <p
          className="text-sm text-text-secondary"
          data-testid="empty-library-hint"
          style={innerStyle}
        >
          No kits yet. Add one below, or pick a bank from the A–Z index.
        </p>
      </div>
    );
  }

  if (row.type === "header") {
    return (
      <div style={style}>
        <div
          style={{
            ...innerStyle,
            paddingTop: row.isFirstBank ? 0 : BANK_SPACING,
          }}
        >
          <BankHeader
            bank={row.bank}
            bankName={data.bankNames[row.bank]}
            onBankNameChange={data.onBankNameChange}
            variant="grid"
          />
        </div>
      </div>
    );
  }

  const addKitCard = data.onCreateKitInBank ? (
    <div style={{ flexShrink: 0, width: CARD_WIDTH }}>
      <AddKitCard
        bankLetter={row.bank}
        isCreating={!!data.isCreatingKit}
        onClick={data.onCreateKitInBank}
      />
    </div>
  ) : null;

  if (row.type === "add") {
    return (
      <div style={style}>
        <div style={{ ...innerStyle, display: "flex", gap: GAP }}>
          {addKitCard}
        </div>
      </div>
    );
  }

  return (
    <div style={style}>
      <div style={{ ...innerStyle, display: "flex", gap: GAP }}>
        {row.kits.map((kit) => (
          <div key={kit.name} style={{ flexShrink: 0, width: CARD_WIDTH }}>
            <KitGridCard
              focusedIdx={data.focusedIdx}
              isNew={kit.name === data.newlyAnimatedKit}
              kit={kit}
              kitData={data.kitData}
              kitsToDisplay={data.kitsToDisplay}
              onDelete={data.onDelete}
              onDeleteKit={data.onDeleteKit}
              onDuplicate={data.onDuplicate}
              onDuplicateKit={data.onDuplicateKit}
              onFocusKit={data.onFocusKit}
              onRequestDeleteSummary={data.onRequestDeleteSummary}
              onSelectKit={data.onSelectKit}
              onToggleFavorite={data.onToggleFavorite}
              sampleCounts={data.sampleCounts}
              setFocus={data.setFocus}
            />
          </div>
        ))}
        {row.showAddCard && addKitCard}
      </div>
    </div>
  );
};

const gridRowKey = (index: number, data: GridRowData): string => {
  const row = data.rows[index];
  if (!row) return `row-${index}`;
  if (row.type === "hint") return "hint";
  if (row.type === "header") return `header-${row.bank}`;
  if (row.type === "add") return `add-${row.bank}`;
  return `kits-${row.kits[0].name}`;
};

const KitGrid = forwardRef<KitGridHandle, KitGridProps>(
  (
    {
      bankNames,
      emptyBank,
      focusedKit,
      isCreatingKit,
      isFiltered,
      kitData,
      kits,
      newlyAnimatedKit,
      onBankFocus,
      onBankNameChange,
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
    const listRef = useRef<VariableSizeList>(null);

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

    // Flatten bank-grouped kits into virtualized rows
    const showAddCards = !isFiltered && !!onCreateKitInBank;
    const { rowIndexByKitIndex, rows } = useMemo(
      () =>
        buildGridRows(kitsToDisplay, { columnCount, emptyBank, showAddCards }),
      [kitsToDisplay, columnCount, emptyBank, showAddCards],
    );

    const getItemSize = useCallback(
      (index: number) => {
        const row = rows[index];
        if (!row) return KIT_ROW_HEIGHT;
        if (row.type === "hint") return HINT_ROW_HEIGHT;
        if (row.type === "header") {
          return BANK_HEADER_HEIGHT + (row.isFirstBank ? 0 : BANK_SPACING);
        }
        if (row.type === "add") return KIT_ROW_HEIGHT;
        return KIT_ROW_HEIGHT + getRowExpansionExtra(row, kitData);
      },
      [rows, kitData],
    );

    // Row heights depend on the row model and search-match expansion state
    useEffect(() => {
      listRef.current?.resetAfterIndex(0);
    }, [rows, kitData, getItemSize]);

    // Scroll a kit's row into view via the virtualized list. Used by
    // keyboard navigation and the imperative handle so focus targets are
    // reachable even when far outside the rendered window.
    const scrollKitIntoView = useCallback(
      (idx: number) => {
        const rowIdx = rowIndexByKitIndex[idx];
        if (rowIdx === undefined || !listRef.current) return;
        const row = rows[rowIdx];
        const prevRow = rows[rowIdx - 1];
        const isFirstKitInBankRow =
          row?.type === "kits" &&
          row.kits[0]?.name === kitsToDisplay[idx]?.name &&
          prevRow?.type === "header";
        if (isFirstKitInBankRow) {
          // Jumping to a bank's first kit: align its header to the top
          listRef.current.scrollToItem(rowIdx - 1, "start");
        } else {
          listRef.current.scrollToItem(rowIdx, "smart");
        }
      },
      [rowIndexByKitIndex, rows, kitsToDisplay],
    );

    // Bring a newly shown empty bank into view (RE-64)
    const scrolledEmptyBankRef = useRef<null | string>(null);
    useEffect(() => {
      if (!emptyBank || emptyBank === scrolledEmptyBankRef.current) return;
      const headerIdx = rows.findIndex(
        (row) => row.type === "header" && row.bank === emptyBank,
      );
      if (headerIdx === -1) return;
      scrolledEmptyBankRef.current = emptyBank;
      listRef.current?.scrollToItem(headerIdx, "start");
    }, [emptyBank, rows]);

    // Use keyboard navigation hook
    const { handleKeyDown, scrollAndFocusKitByIndex, scrollToKit } =
      useKitGridKeyboard({
        containerRef,
        focusedIdx,
        kitsToDisplay,
        onBankFocus,
        onFocusKit,
        onSelectKit,
        rowIndexByKitIndex,
        scrollItemIntoView: scrollKitIntoView,
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

    // Track the visible bank from the virtualized window (replaces the
    // per-header IntersectionObserver, which only sees mounted headers)
    const lastVisibleBankRef = useRef<null | string>(null);
    const handleItemsRendered = useCallback(
      ({ visibleStartIndex }: ListOnItemsRenderedProps) => {
        if (!onVisibleBankChange) return;
        const row = rows[visibleStartIndex];
        const bank = row && "bank" in row ? row.bank : undefined;
        if (bank && bank !== lastVisibleBankRef.current) {
          lastVisibleBankRef.current = bank;
          onVisibleBankChange(bank);
        }
      },
      [rows, onVisibleBankChange],
    );

    const itemData: GridRowData = {
      bankNames,
      focusedIdx,
      gridWidth: columnCount * CARD_WIDTH + (columnCount - 1) * GAP,
      isCreatingKit,
      kitData,
      kitsToDisplay,
      newlyAnimatedKit,
      onBankNameChange,
      onCreateKitInBank,
      onDelete,
      onDeleteKit,
      onDuplicate,
      onDuplicateKit,
      onFocusKit,
      onRequestDeleteSummary,
      onSelectKit,
      onToggleFavorite,
      rows,
      sampleCounts,
      setFocus,
    };

    return (
      <div
        aria-label="Kit grid"
        className="h-full w-full bg-surface-1 rounded pt-2 pb-2 pl-2 pr-2 overflow-hidden"
        data-testid="kit-grid"
        onKeyDown={handleKeyDown}
        ref={containerRef}
        role="grid"
        style={{ minHeight: 400 }} // Ensure minimum height
        tabIndex={0}
      >
        <VariableSizeList
          height={size.height}
          itemCount={rows.length}
          itemData={itemData}
          itemKey={gridRowKey}
          itemSize={getItemSize}
          onItemsRendered={handleItemsRendered}
          overscanCount={OVERSCAN_ROW_COUNT}
          ref={listRef}
          width="100%"
        >
          {GridRowRenderer}
        </VariableSizeList>
      </div>
    );
  },
);

KitGrid.displayName = "KitGrid";
export default React.memo(KitGrid);
