import type { KitWithRelations } from "@romper/shared/db/schema";

import { getNextSlotInBank } from "@romper/shared/kitUtilsShared";

// Virtualized row model for KitGrid: each list row is a bank header, a row
// of up to `columnCount` kit cards (optionally ending with the add-kit
// card), a standalone add-kit row when the bank's kit count fills its final
// row, or the empty-library hint.
export interface AddRow {
  bank: string;
  type: "add";
}

export type GridRow = AddRow | HeaderRow | HintRow | KitsRow;

export interface GridRowOptions {
  columnCount: number;
  // A bank with no kits to show as a header and an add-kit card, so a kit
  // can be created in it (RE-64). Ignored if the bank has kits.
  emptyBank?: null | string;
  showAddCards: boolean;
}

export interface HeaderRow {
  bank: string;
  isFirstBank: boolean;
  type: "header";
}

export interface HintRow {
  type: "hint";
}

export interface KitsRow {
  bank: string;
  kits: KitWithRelations[];
  showAddCard: boolean;
  type: "kits";
}

/**
 * Flatten bank-grouped kits (sorted by name) into virtualized grid rows.
 * `rowIndexByKitIndex` maps each kit's index in `kitsToDisplay` to the row
 * that holds its card.
 */
export function buildGridRows(
  kitsToDisplay: KitWithRelations[],
  { columnCount, emptyBank, showAddCards }: GridRowOptions,
): { rowIndexByKitIndex: number[]; rows: GridRow[] } {
  const rows: GridRow[] = [];
  const rowIndexByKitIndex: number[] = new Array(kitsToDisplay.length);
  const existingNames = kitsToDisplay.map((k) => k.name);

  let pendingEmptyBank =
    showAddCards &&
    emptyBank &&
    !existingNames.some((name) => name.startsWith(emptyBank))
      ? emptyBank
      : null;

  if (pendingEmptyBank && kitsToDisplay.length === 0) {
    rows.push({ type: "hint" });
  }

  let isFirstBank = true;
  const pushEmptyBank = (bank: string) => {
    rows.push({ bank, isFirstBank, type: "header" }, { bank, type: "add" });
    isFirstBank = false;
  };

  let i = 0;
  while (i < kitsToDisplay.length) {
    const bank = kitsToDisplay[i].name[0];
    if (pendingEmptyBank && pendingEmptyBank < bank) {
      pushEmptyBank(pendingEmptyBank);
      pendingEmptyBank = null;
    }

    const bankStart = i;
    const bankKits: KitWithRelations[] = [];
    while (i < kitsToDisplay.length && kitsToDisplay[i].name[0] === bank) {
      bankKits.push(kitsToDisplay[i]);
      i++;
    }

    rows.push({ bank, isFirstBank, type: "header" });
    isFirstBank = false;

    const bankHasRoom =
      showAddCards && getNextSlotInBank(bank, existingNames) !== null;

    for (let c = 0; c < bankKits.length; c += columnCount) {
      const chunk = bankKits.slice(c, c + columnCount);
      const isLastChunk = c + columnCount >= bankKits.length;
      const rowIdx = rows.length;
      for (let j = 0; j < chunk.length; j++) {
        rowIndexByKitIndex[bankStart + c + j] = rowIdx;
      }
      rows.push({
        bank,
        kits: chunk,
        showAddCard: bankHasRoom && isLastChunk && chunk.length < columnCount,
        type: "kits",
      });
    }

    // Add-kit card gets its own row when the bank's final row is full
    if (bankHasRoom && bankKits.length % columnCount === 0) {
      rows.push({ bank, type: "add" });
    }
  }

  if (pendingEmptyBank) pushEmptyBank(pendingEmptyBank);

  return { rowIndexByKitIndex, rows };
}
