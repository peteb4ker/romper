import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import KitGrid from "../KitGrid";

// Every kit card's render calls useKitItem once, so its calls count the
// card renders (#462)
const cardRenders = vi.hoisted(() => vi.fn());
vi.mock("../hooks/kit-management/useKitItem", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../hooks/kit-management/useKitItem")>();
  return {
    useKitItem: (...args: Parameters<typeof actual.useKitItem>) => {
      cardRenders();
      return actual.useKitItem(...args);
    },
  };
});

// Two banks of 30 kits: 20 rows of three cards, more than the grid shows
const kits = ["A", "B"].flatMap((bank) =>
  Array.from({ length: 30 }, (_, i) =>
    createMockKitWithRelations({ bank_letter: bank, name: `${bank}${i}` }),
  ),
);
const bankNames = { A: "Bank A", B: "Bank B" };
const sampleCounts = Object.fromEntries(
  kits.map((kit) => [
    kit.name,
    [1, 1, 1, 1] as [number, number, number, number],
  ]),
);
const onDuplicate = vi.fn();
const onSelectKit = vi.fn();

/** The grid's scrolling list (react-window's outer element) */
function scrollingList(): HTMLElement {
  const list = screen.getByTestId("kit-grid").firstElementChild;
  if (!(list instanceof HTMLElement)) throw new Error("No kit list");
  return list;
}

/** The names of the kits whose cards are mounted */
function shownKits(): string[] {
  return screen
    .getAllByTestId(/^kit-item-/)
    .map((card) => card.getAttribute("data-kit") ?? "");
}

describe("[Q-01] [UC-07] Kit grid renders only what changed (#462)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
  });

  it("doesn't redraw shown cards when the grid scrolls", () => {
    render(
      <KitGrid
        bankNames={bankNames}
        kitData={kits}
        kits={kits}
        onDuplicate={onDuplicate}
        onSelectKit={onSelectKit}
        sampleCounts={sampleCounts}
      />,
    );
    const shownBefore = shownKits();
    expect(shownBefore.length).toBeGreaterThan(0);
    cardRenders.mockClear();

    // Scroll down one row of cards
    const list = scrollingList();
    Object.defineProperty(list, "scrollHeight", { value: 5000 });
    Object.defineProperty(list, "clientHeight", { value: 600 });
    act(() => {
      list.scrollTop = 116;
      fireEvent.scroll(list);
    });

    // Only the cards the scroll brought into the window render
    const scrolledIn = shownKits().filter((kit) => !shownBefore.includes(kit));
    expect(scrolledIn.length).toBeGreaterThan(0);
    expect(cardRenders).toHaveBeenCalledTimes(scrolledIn.length);
  });

  it("redraws only the cards whose focus changed", () => {
    const { rerender } = render(
      <KitGrid
        bankNames={bankNames}
        focusedKit="A0"
        kitData={kits}
        kits={kits}
        onDuplicate={onDuplicate}
        onSelectKit={onSelectKit}
        sampleCounts={sampleCounts}
      />,
    );
    cardRenders.mockClear();

    rerender(
      <KitGrid
        bankNames={bankNames}
        focusedKit="A1"
        kitData={kits}
        kits={kits}
        onDuplicate={onDuplicate}
        onSelectKit={onSelectKit}
        sampleCounts={sampleCounts}
      />,
    );

    // A0 loses the selection and A1 gains it
    expect(cardRenders).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("kit-item-A1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
