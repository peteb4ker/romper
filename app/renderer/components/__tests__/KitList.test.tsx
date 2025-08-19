// Ensures @testing-library/react cleanup runs after each test for test isolation
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => {
  cleanup();
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import KitList from "../KitList";

// Helper: expect only one kit to be selected/focused
function expectOnlySelected(kits, selectedKit) {
  kits.forEach((k) => {
    const kitName = typeof k === "string" ? k : k.name;
    const el = getKitItem(kitName);
    if (kitName === selectedKit) {
      expect(el.getAttribute("aria-selected")).toBe("true");
      expect(el.getAttribute("tabindex")).toBe("0");
    } else {
      expect(el.getAttribute("aria-selected")).toBe("false");
      expect(el.getAttribute("tabindex")).toBe("-1");
    }
  });
}

// Helper: get kit item by data-kit attribute
function getKitItem(kit) {
  return screen.getByTestId(`kit-item-${kit}`);
}

describe("KitList", () => {
  const kits = [
    {
      alias: "Kick",
      artist: null,
      bank: null,
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      samples: [],
      step_pattern: null,
      voices: [],
    },
    {
      alias: "Snare",
      artist: null,
      bank: null,
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A2",
      samples: [],
      step_pattern: null,
      voices: [],
    },
    {
      alias: "Hat",
      artist: null,
      bank: null,
      bank_letter: "B",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "B1",
      samples: [],
      step_pattern: null,
      voices: [],
    },
  ];
  const kitData = [
    { alias: "Kick", name: "A1", voices: [] },
    { alias: "Snare", name: "A2", voices: [] },
    { alias: "Hat", name: "B1", voices: [] },
  ];
  const bankNames = { A: "Drums", B: "Perc" };
  const sampleCounts = { A1: [1, 2, 3, 4], A2: [2, 2, 2, 2], B1: [0, 1, 0, 1] };

  it("renders all kits and bank anchors", () => {
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={kits}
        onDuplicate={vi.fn()}
        onSelectKit={vi.fn()}
        sampleCounts={sampleCounts}
      />
    );
    kits.forEach((kit) => {
      expect(getKitItem(kit.name)).toBeDefined();
    });
    expect(screen.getByText("Bank A")).toBeDefined();
    expect(screen.getByText("Bank B")).toBeDefined();
    expect(screen.getByText("Drums")).toBeDefined();
    expect(screen.getByText("Perc")).toBeDefined();
  });

  it("calls onSelectKit when a valid kit is clicked", () => {
    const onSelectKit = vi.fn();
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={kits}
        onDuplicate={vi.fn()}
        onSelectKit={onSelectKit}
        sampleCounts={sampleCounts}
      />
    );
    fireEvent.click(getKitItem("A1"));
    expect(onSelectKit).toHaveBeenCalledWith("A1");
  });

  it("calls onDuplicate when duplicate button is clicked", () => {
    const onDuplicate = vi.fn();
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={kits}
        onDuplicate={onDuplicate}
        onSelectKit={vi.fn()}
        sampleCounts={sampleCounts}
      />
    );
    // Find the duplicate button inside the kit item
    const kitItem = getKitItem("A1");
    const duplicateBtn = within(kitItem).getByTitle("Duplicate kit");
    fireEvent.click(duplicateBtn);
    expect(onDuplicate).toHaveBeenCalled();
  });

  it("renders sample counts for each kit", () => {
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={kits}
        onDuplicate={vi.fn()}
        onSelectKit={vi.fn()}
        sampleCounts={sampleCounts}
      />
    );
    kits.forEach((kit) => {
      const kitItem = getKitItem(kit.name);
      // For each count, check that the correct number of sample count elements are rendered
      sampleCounts[kit.name].forEach((count, idx) => {
        // Use title to disambiguate
        const title = `Voice ${idx + 1} samples`;
        const countEls = within(kitItem).getAllByTitle(title);
        expect(countEls).toHaveLength(1);
        expect(countEls[0].textContent).toBe(count.toString());
      });
    });
  });

  it("focuses only the first kit on load", () => {
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={kits}
        onDuplicate={vi.fn()}
        onSelectKit={vi.fn()}
        sampleCounts={sampleCounts}
      />
    );
    expectOnlySelected(kits, "A1");
  });

  it("A-Z hotkey focuses only the first kit in the selected bank", () => {
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={kits}
        onDuplicate={vi.fn()}
        onSelectKit={vi.fn()}
        sampleCounts={sampleCounts}
      />
    );
    const list = screen.getByLabelText("Kit list");
    list.focus();
    fireEvent.keyDown(list, { key: "B" });
    expectOnlySelected(kits, "B1");
    fireEvent.keyDown(list, { key: "A" });
    expectOnlySelected(kits, "A1");
  });

  it("arrow keys and Enter/Space do not change selection", () => {
    // This test ensures that only A-Z hotkey navigation is active and all other keyboard navigation is disabled.
    const onSelectKit = vi.fn();
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={kits}
        onDuplicate={vi.fn()}
        onSelectKit={onSelectKit}
        sampleCounts={sampleCounts}
      />
    );
    const list = screen.getByLabelText("Kit list");
    list.focus();
    // Initial focus is on A1
    expectOnlySelected(kits, "A1");
    // Try all non-A-Z navigation keys
    fireEvent.keyDown(list, { key: "ArrowRight" });
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowUp" });
    fireEvent.keyDown(list, { key: " " });
    fireEvent.keyDown(list, { key: "Enter" });
    // Selection should not change
    expectOnlySelected(kits, "A1");
    // onSelectKit should never be called for these keys
    expect(onSelectKit).not.toHaveBeenCalled();
  });

  it("renders deduped voice label sets for each kit", () => {
    const testKits = [
      {
        alias: null,
        artist: null,
        bank: null,
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        samples: [],
        step_pattern: null,
        voices: [
          { kit_name: "A1", voice_alias: "kick", voice_number: 1 },
          { kit_name: "A1", voice_alias: "snare", voice_number: 2 },
          { kit_name: "A1", voice_alias: "kick", voice_number: 3 },
          { kit_name: "A1", voice_alias: null, voice_number: 4 },
        ],
      },
      {
        alias: null,
        artist: null,
        bank: null,
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A2",
        samples: [],
        step_pattern: null,
        voices: [
          { kit_name: "A2", voice_alias: "snare", voice_number: 1 },
          { kit_name: "A2", voice_alias: "snare", voice_number: 2 },
          { kit_name: "A2", voice_alias: null, voice_number: 3 },
          { kit_name: "A2", voice_alias: "hat", voice_number: 4 },
        ],
      },
      {
        alias: null,
        artist: null,
        bank: null,
        bank_letter: "B",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "B1",
        samples: [],
        step_pattern: null,
        voices: [
          { kit_name: "B1", voice_alias: null, voice_number: 1 },
          { kit_name: "B1", voice_alias: null, voice_number: 2 },
          { kit_name: "B1", voice_alias: null, voice_number: 3 },
          { kit_name: "B1", voice_alias: null, voice_number: 4 },
        ],
      },
    ];
    const kitData = [
      {
        name: "A1",
        voices: [
          { voice_alias: "kick", voice_number: 1 },
          { voice_alias: "snare", voice_number: 2 },
          { voice_alias: "kick", voice_number: 3 },
          { voice_alias: null, voice_number: 4 },
        ],
      },
      {
        name: "A2",
        voices: [
          { voice_alias: "snare", voice_number: 1 },
          { voice_alias: "snare", voice_number: 2 },
          { voice_alias: null, voice_number: 3 },
          { voice_alias: "hat", voice_number: 4 },
        ],
      },
      {
        name: "B1",
        voices: [
          { voice_alias: null, voice_number: 1 },
          { voice_alias: null, voice_number: 2 },
          { voice_alias: null, voice_number: 3 },
          { voice_alias: null, voice_number: 4 },
        ],
      },
    ];
    const bankNames = { A: "Drums", B: "Perc" };
    const sampleCounts = {
      A1: [1, 2, 3, 4],
      A2: [2, 2, 2, 2],
      B1: [0, 1, 0, 1],
    };
    render(
      <KitList
        bankNames={bankNames}
        kitData={kitData}
        kits={testKits}
        onDuplicate={vi.fn()}
        onSelectKit={vi.fn()}
        sampleCounts={sampleCounts}
      />
    );
    // A1 should show 'Kick' and 'Snare' (deduped, capitalized)
    const kitA1 = getKitItem("A1");
    expect(within(kitA1).getByText("Kick")).toBeDefined();
    expect(within(kitA1).getByText("Snare")).toBeDefined();
    // A2 should show 'Snare' and 'Hat' (deduped, capitalized)
    const kitA2 = getKitItem("A2");
    expect(within(kitA2).getByText("Snare")).toBeDefined();
    expect(within(kitA2).getByText("Hat")).toBeDefined();
    // B1 should not show any voice tags
    const kitB1 = getKitItem("B1");
    expect(within(kitB1).queryByText("Kick")).toBeNull();
    expect(within(kitB1).queryByText("Snare")).toBeNull();
    expect(within(kitB1).queryByText("Hat")).toBeNull();
  });
});

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
