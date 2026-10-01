import { describe, expect, it } from "vitest";

import { createMockKitWithRelations } from "../../../../../tests/factories/kit.factory";
import { buildGridRows, type GridRow } from "../kitGridRows";

const kit = (name: string) =>
  createMockKitWithRelations({ bank_letter: name[0], name });

// Compact row summary: "hint", "header:A", "add:A", "kits:A0,A1+add"
const summarize = (rows: GridRow[]) =>
  rows.map((row) => {
    if (row.type === "hint") return "hint";
    if (row.type === "kits") {
      const names = row.kits.map((k) => k.name).join(",");
      return `kits:${names}${row.showAddCard ? "+add" : ""}`;
    }
    return `${row.type}:${row.bank}`;
  });

describe("[UC-07] buildGridRows", () => {
  it("groups kits by bank with an add-kit card after each bank's kits", () => {
    const { rowIndexByKitIndex, rows } = buildGridRows(
      [kit("A0"), kit("A1"), kit("B0")],
      { columnCount: 2, showAddCards: true },
    );

    expect(summarize(rows)).toEqual([
      "header:A",
      "kits:A0,A1",
      "add:A",
      "header:B",
      "kits:B0+add",
    ]);
    expect(rowIndexByKitIndex).toEqual([1, 1, 4]);
  });

  it("leaves out add-kit cards when they're turned off", () => {
    const { rows } = buildGridRows([kit("A0")], {
      columnCount: 2,
      emptyBank: "C",
      showAddCards: false,
    });

    expect(summarize(rows)).toEqual(["header:A", "kits:A0"]);
  });

  describe("[UC-14] creating a kit where there are none (RE-64)", () => {
    it("shows the hint and an empty bank with an add-kit card in an empty library", () => {
      const { rows } = buildGridRows([], {
        columnCount: 3,
        emptyBank: "A",
        showAddCards: true,
      });

      expect(summarize(rows)).toEqual(["hint", "header:A", "add:A"]);
      expect(rows[1]).toMatchObject({ isFirstBank: true });
    });

    it("shows nothing for an empty library without an empty bank", () => {
      const { rows } = buildGridRows([], {
        columnCount: 3,
        showAddCards: true,
      });

      expect(rows).toEqual([]);
    });

    it("inserts an empty bank between banks in letter order", () => {
      const { rowIndexByKitIndex, rows } = buildGridRows(
        [kit("A0"), kit("D0")],
        { columnCount: 3, emptyBank: "C", showAddCards: true },
      );

      expect(summarize(rows)).toEqual([
        "header:A",
        "kits:A0+add",
        "header:C",
        "add:C",
        "header:D",
        "kits:D0+add",
      ]);
      expect(rowIndexByKitIndex).toEqual([1, 5]);
    });

    it("puts an empty bank first when it sorts before every kit", () => {
      const { rows } = buildGridRows([kit("B0")], {
        columnCount: 3,
        emptyBank: "A",
        showAddCards: true,
      });

      expect(summarize(rows)).toEqual([
        "header:A",
        "add:A",
        "header:B",
        "kits:B0+add",
      ]);
      expect(rows[0]).toMatchObject({ isFirstBank: true });
      expect(rows[2]).toMatchObject({ isFirstBank: false });
    });

    it("appends an empty bank after the last bank", () => {
      const { rows } = buildGridRows([kit("A0")], {
        columnCount: 3,
        emptyBank: "Z",
        showAddCards: true,
      });

      expect(summarize(rows)).toEqual([
        "header:A",
        "kits:A0+add",
        "header:Z",
        "add:Z",
      ]);
    });

    it("ignores the empty bank once it has a kit", () => {
      const { rows } = buildGridRows([kit("A0"), kit("C0")], {
        columnCount: 3,
        emptyBank: "C",
        showAddCards: true,
      });

      expect(summarize(rows)).toEqual([
        "header:A",
        "kits:A0+add",
        "header:C",
        "kits:C0+add",
      ]);
    });
  });
});
