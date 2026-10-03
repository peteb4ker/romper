import type { Kit } from "@romper/shared/db/schema.js";

import { isValidKit } from "@romper/shared/kitUtilsShared";
import { RefObject, useCallback, useMemo } from "react";

interface UseKitGridKeyboardProps {
  containerRef: RefObject<HTMLDivElement | null>;
  focusedIdx: null | number;
  kitsToDisplay: Kit[];
  onBankFocus?: (bank: string) => void;
  onFocusKit?: (kitName: string) => void;
  onSelectKit: (kitName: string) => void;
  /**
   * The grid row that holds each kit's card, by index in `kitsToDisplay`
   * (`buildGridRows`). Rows are grouped by bank, so a row can hold fewer
   * kits than the grid has columns.
   */
  rowIndexByKitIndex: number[];
  // When provided (virtualized grids), used instead of DOM scrollIntoView
  // so off-window (unmounted) kits can still be scrolled to.
  scrollItemIntoView?: (idx: number) => void;
  setFocus: (index: number) => void;
}

/**
 * The kit an arrow key moves to from `idx`, or null to stay put. Left and
 * Right step through the kits in order; Up and Down move to the kit in the
 * same column of the row above or below, or that row's last kit if it's
 * shorter, crossing bank headers.
 */
export function getArrowTarget(
  key: string,
  idx: number,
  kitRows: number[][],
  kitCount: number,
): null | number {
  if (key === "ArrowLeft") return idx > 0 ? idx - 1 : null;
  if (key === "ArrowRight") return idx < kitCount - 1 ? idx + 1 : null;

  const row = kitRows.findIndex((kits) => kits.includes(idx));
  if (row === -1) return null;
  const targetRow = kitRows[key === "ArrowUp" ? row - 1 : row + 1];
  if (!targetRow) return null;
  const column = kitRows[row].indexOf(idx);
  return targetRow[Math.min(column, targetRow.length - 1)];
}

/**
 * Group kit indices into the grid's rows of cards, in order. Kits are
 * sorted, so the kits of one row are consecutive.
 */
export function groupKitsByRow(rowIndexByKitIndex: number[]): number[][] {
  const kitRows: number[][] = [];
  let lastRow: number | undefined;
  rowIndexByKitIndex.forEach((rowIdx, kitIdx) => {
    if (rowIdx !== lastRow || kitRows.length === 0) {
      kitRows.push([kitIdx]);
      lastRow = rowIdx;
    } else {
      kitRows.at(-1)?.push(kitIdx);
    }
  });
  return kitRows;
}

const ARROW_KEYS = new Set(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"]);

export function useKitGridKeyboard({
  containerRef,
  focusedIdx,
  kitsToDisplay,
  onBankFocus,
  onFocusKit,
  onSelectKit,
  rowIndexByKitIndex,
  scrollItemIntoView,
  setFocus,
}: UseKitGridKeyboardProps) {
  const kitRows = useMemo(
    () => groupKitsByRow(rowIndexByKitIndex),
    [rowIndexByKitIndex],
  );

  // Give the kit's card keyboard focus, so its focus ring shows and the
  // next Enter reaches it. Focus it now if it's mounted, so a quick Enter
  // can't land on the card focus is leaving; otherwise the virtualized list
  // mounts it on the next frame.
  const focusKitCard = useCallback(
    (kitName: string) => {
      const tryFocus = () => {
        if (isEditing(document.activeElement)) return true;
        const card = containerRef.current?.querySelector<HTMLElement>(
          `[data-kit="${kitName}"]`,
        );
        card?.focus({ preventScroll: true });
        return !!card;
      };
      if (!tryFocus()) requestAnimationFrame(tryFocus);
    },
    [containerRef],
  );

  // Scroll and focus logic for CSS grid
  const scrollAndFocusKitByIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= kitsToDisplay.length) return;
      const kit = kitsToDisplay[idx];

      if (scrollItemIntoView) {
        // Virtualized grid: scroll via the list so unmounted kits work
        scrollItemIntoView(idx);
      } else {
        const kitElement = containerRef.current?.querySelector(
          `[data-kit="${kit.name}"]`,
        );

        if (kitElement && containerRef.current) {
          kitElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }

      setFocus(idx);
      if (onFocusKit) onFocusKit(kit.name);
      focusKitCard(kit.name);
    },
    [
      kitsToDisplay,
      setFocus,
      onFocusKit,
      containerRef,
      scrollItemIntoView,
      focusKitCard,
    ],
  );

  // Helper function to scroll to a kit by name
  const scrollToKit = useCallback(
    (kitName: string) => {
      const index = kitsToDisplay.findIndex((kit) => kit.name === kitName);
      if (index !== -1) {
        scrollAndFocusKitByIndex(index);
      }
    },
    [kitsToDisplay, scrollAndFocusKitByIndex],
  );

  // Helper function to handle bank selection via A-Z keys
  const handleBankSelection = useCallback(
    (e: React.KeyboardEvent) => {
      const bank = e.key.toUpperCase();
      const idx = kitsToDisplay.findIndex(
        (k) => k?.name?.[0]?.toUpperCase() === bank,
      );
      if (idx !== -1) {
        if (typeof onBankFocus === "function") onBankFocus(bank);
        scrollAndFocusKitByIndex(idx);
        e.preventDefault();
      }
    },
    [kitsToDisplay, onBankFocus, scrollAndFocusKitByIndex],
  );

  // Enter/Space opens the focused kit. Index 0, the first kit, is a kit
  // like any other: only null means nothing is focused (RE-39).
  const handleKitSelection = useCallback(
    (e: React.KeyboardEvent) => {
      if (focusedIdx !== null && focusedIdx < kitsToDisplay.length) {
        const kit = kitsToDisplay[focusedIdx];
        if (isValidKit(kit.name)) {
          onSelectKit(kit.name);
        }
      }
      e.preventDefault();
    },
    [focusedIdx, kitsToDisplay, onSelectKit],
  );

  // Arrow keys move along the grid's rows as drawn, grouped by bank
  const handleArrowNavigation = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      if (kitsToDisplay.length === 0) return;
      if (focusedIdx === null) {
        scrollAndFocusKitByIndex(0);
        return;
      }

      const target = getArrowTarget(
        e.key,
        focusedIdx,
        kitRows,
        kitsToDisplay.length,
      );
      if (target !== null) {
        scrollAndFocusKitByIndex(target);
      }
    },
    [focusedIdx, kitRows, kitsToDisplay.length, scrollAndFocusKitByIndex],
  );

  // Grid keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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

      // Enter/Space: select focused kit, unless a button in a card (the
      // bookmark, duplicate or delete button) has focus and takes the key
      if (e.key === "Enter" || e.key === " ") {
        if (e.target instanceof HTMLButtonElement) return;
        handleKitSelection(e);
        return;
      }

      if (ARROW_KEYS.has(e.key)) {
        handleArrowNavigation(e);
      }
    },
    [handleBankSelection, handleKitSelection, handleArrowNavigation],
  );

  return {
    handleKeyDown,
    scrollAndFocusKitByIndex,
    scrollToKit,
  };
}

// Typing somewhere else (search, a bank name) keeps its focus
function isEditing(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}
