import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKitListLogic } from "../useKitListLogic";

describe("useKitListLogic", () => {
  it("sorts kits and provides helpers", () => {
    const kits = [
      {
        alias: null,
        artist: null,
        bank: null,
        bank_letter: "B",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "B2",
        samples: [],
        step_pattern: null,
        voices: [],
      },
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
        voices: [],
      },
      {
        alias: null,
        artist: null,
        bank: null,
        bank_letter: "C",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "C3",
        samples: [],
        step_pattern: null,
        voices: [],
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
        voices: [],
      },
    ];
    const { result } = renderHook(() => useKitListLogic(kits));

    // Check that kits are sorted by name
    const sortedNames = result.current.kitsToDisplay.map((k) => k.name);
    expect(sortedNames).toEqual(["A1", "A2", "B2", "C3"]);

    // Test helper functions
    expect(result.current.isValidKit(kits[1])).toBe(true); // A1
    expect(result.current.isValidKit({ ...kits[0], name: "bad" })).toBe(false);
    expect(result.current.getColorClass(kits[1])).toMatch(/text/); // A1

    const sortedKits = result.current.kitsToDisplay;
    expect(result.current.showBankAnchor(sortedKits[0], 0, sortedKits)).toBe(
      true
    ); // A1 - first kit
    expect(result.current.showBankAnchor(sortedKits[1], 1, sortedKits)).toBe(
      false
    ); // A2 - same bank as A1
    expect(result.current.showBankAnchor(sortedKits[2], 2, sortedKits)).toBe(
      true
    ); // B2 - different bank
  });
});
