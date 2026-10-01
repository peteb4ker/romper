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

interface BankGroup {
  bank: string;
  kits: KitWithRelations[];
  start: number; // index of the bank's first kit in the sorted kit list
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
  const pushHeader = (bank: string) => {
    rows.push({ bank, isFirstBank, type: "header" });
    isFirstBank = false;
  };

  for (const group of groupKitsByBank(kitsToDisplay)) {
    if (pendingEmptyBank && pendingEmptyBank < group.bank) {
      pushHeader(pendingEmptyBank);
      rows.push({ bank: pendingEmptyBank, type: "add" });
      pendingEmptyBank = null;
    }

    pushHeader(group.bank);
    const bankHasRoom =
      showAddCards && getNextSlotInBank(group.bank, existingNames) !== null;
    pushKitRows(rows, rowIndexByKitIndex, group, columnCount, bankHasRoom);
  }

  if (pendingEmptyBank) {
    pushHeader(pendingEmptyBank);
    rows.push({ bank: pendingEmptyBank, type: "add" });
  }

  return { rowIndexByKitIndex, rows };
}

// Split kits sorted by name into runs that share a bank letter
function groupKitsByBank(kits: KitWithRelations[]): BankGroup[] {
  const groups: BankGroup[] = [];
  kits.forEach((kit, index) => {
    const last = groups.at(-1);
    if (last && kit.name.startsWith(last.bank)) {
      last.kits.push(kit);
    } else {
      groups.push({ bank: kit.name[0], kits: [kit], start: index });
    }
  });
  return groups;
}

// Rows of up to `columnCount` kit cards for one bank, ending with its
// add-kit card: in the last row if it has room, otherwise in a row of its own
function pushKitRows(
  rows: GridRow[],
  rowIndexByKitIndex: number[],
  { bank, kits, start }: BankGroup,
  columnCount: number,
  bankHasRoom: boolean,
): void {
  for (let c = 0; c < kits.length; c += columnCount) {
    const chunk = kits.slice(c, c + columnCount);
    const isLastChunk = c + columnCount >= kits.length;
    const rowIdx = rows.length;
    for (let j = 0; j < chunk.length; j++) {
      rowIndexByKitIndex[start + c + j] = rowIdx;
    }
    rows.push({
      bank,
      kits: chunk,
      showAddCard: bankHasRoom && isLastChunk && chunk.length < columnCount,
      type: "kits",
    });
  }

  if (bankHasRoom && kits.length % columnCount === 0) {
    rows.push({ bank, type: "add" });
  }
}
