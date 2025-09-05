import type { Kit } from "@romper/shared/db/schema.js";

import { isValidKit } from "@romper/shared/kitUtilsShared";
import { RefObject, useCallback } from "react";

interface UseKitGridKeyboardProps {
  columnCount: number;
  containerRef: RefObject<HTMLDivElement | null>;
  focusedIdx: null | number;
  kitsToDisplay: Kit[];
  onBankFocus?: (bank: string) => void;
  onFocusKit?: (kitName: string) => void;
  onSelectKit: (kitName: string) => void;
  rowCount: number;
  setFocus: (index: number) => void;
}

export function useKitGridKeyboard({
  columnCount,
  containerRef,
  focusedIdx,
  kitsToDisplay,
  onBankFocus,
  onFocusKit,
  onSelectKit,
  rowCount,
  setFocus,
}: UseKitGridKeyboardProps) {
  // Convert flat index to grid coordinates
  const getGridCoords = useCallback(
    (index: number) => {
      const rowIndex = Math.floor(index / columnCount);
      const columnIndex = index % columnCount;
      return { columnIndex, rowIndex };
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

  // Helper function to handle kit selection (Enter/Space)
  const handleKitSelection = useCallback(
    (e: React.KeyboardEvent) => {
      if (focusedIdx && focusedIdx < kitsToDisplay.length) {
        const kit = kitsToDisplay[focusedIdx];
        if (isValidKit(kit.name)) {
          onSelectKit(kit.name);
        }
      }
      e.preventDefault();
    },
    [focusedIdx, kitsToDisplay, onSelectKit],
  );

  // Helper function to handle arrow key navigation
  const handleArrowNavigation = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [
      focusedIdx,
      getGridCoords,
      rowCount,
      columnCount,
      getFlatIndex,
      kitsToDisplay,
      scrollAndFocusKitByIndex,
    ],
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

      // Enter/Space: select focused kit
      if (e.key === "Enter" || e.key === " ") {
        handleKitSelection(e);
        return;
      }

      // Arrow key navigation for grid
      if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        handleArrowNavigation(e);
      }
    },
    [handleBankSelection, handleKitSelection, handleArrowNavigation],
  );

  return {
    getFlatIndex,
    getGridCoords,
    handleKeyDown,
    scrollAndFocusKitByIndex,
    scrollToKit,
  };
}
