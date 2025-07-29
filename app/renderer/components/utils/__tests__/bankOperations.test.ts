// Tests for bank operations utilities

import { describe, expect, it } from "vitest";

import {
  bankHasKits,
  getAvailableBanks,
  getFirstKitInBank,
  validateBankLetter,
} from "../bankOperations";

// No mocks needed for the remaining pure utility functions

describe("getFirstKitInBank", () => {
  const kits = [
    {
      name: "A0",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "A",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "A1",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "A",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "A10",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "A",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "B0",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "B",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "B5",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "B",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "C1",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "C",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "Z99",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "Z",
      voices: [],
      samples: [],
      bank: null,
    },
  ];

  it("finds first kit in specified bank", () => {
    expect(getFirstKitInBank(kits, "A")).toBe("A0");
    expect(getFirstKitInBank(kits, "B")).toBe("B0");
    expect(getFirstKitInBank(kits, "C")).toBe("C1");
    expect(getFirstKitInBank(kits, "Z")).toBe("Z99");
  });

  it("returns null for banks with no kits", () => {
    expect(getFirstKitInBank(kits, "D")).toBeNull();
    expect(getFirstKitInBank(kits, "Y")).toBeNull();
  });

  it("handles empty kit list", () => {
    expect(getFirstKitInBank([], "A")).toBeNull();
  });
});

describe("bankHasKits", () => {
  const kits = [
    {
      name: "A0",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "A",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "A1",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "A",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "B0",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "B",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "C1",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "C",
      voices: [],
      samples: [],
      bank: null,
    },
    {
      name: "Z99",
      alias: null,
      artist: null,
      locked: false,
      editable: false,
      modified_since_sync: false,
      step_pattern: null,
      bank_letter: "Z",
      voices: [],
      samples: [],
      bank: null,
    },
  ];

  it("correctly identifies banks with kits", () => {
    expect(bankHasKits(kits, "A")).toBe(true);
    expect(bankHasKits(kits, "B")).toBe(true);
    expect(bankHasKits(kits, "C")).toBe(true);
    expect(bankHasKits(kits, "Z")).toBe(true);
  });

  it("correctly identifies banks without kits", () => {
    expect(bankHasKits(kits, "D")).toBe(false);
    expect(bankHasKits(kits, "Y")).toBe(false);
  });

  it("handles empty kit list", () => {
    expect(bankHasKits([], "A")).toBe(false);
  });
});

describe("getAvailableBanks", () => {
  it("extracts unique banks from kit list", () => {
    const kits = [
      {
        name: "A0",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "A",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "A1",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "A",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "A10",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "A",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "B0",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "B",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "B5",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "B",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "C1",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "C",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "Z99",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "Z",
        voices: [],
        samples: [],
        bank: null,
      },
    ];
    const result = getAvailableBanks(kits);

    expect(result).toEqual(["A", "B", "C", "Z"]);
  });

  it("handles empty kit list", () => {
    const result = getAvailableBanks([]);
    expect(result).toEqual([]);
  });

  it("sorts banks alphabetically", () => {
    const kits = [
      {
        name: "Z0",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "Z",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "A0",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "A",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "M5",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "M",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "B2",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "B",
        voices: [],
        samples: [],
        bank: null,
      },
    ];
    const result = getAvailableBanks(kits);

    expect(result).toEqual(["A", "B", "M", "Z"]);
  });

  it("handles lowercase bank letters", () => {
    const kits = [
      {
        name: "a0",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "a",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "b1",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "b",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "C2",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "C",
        voices: [],
        samples: [],
        bank: null,
      },
    ];
    const result = getAvailableBanks(kits);

    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles invalid kit names gracefully", () => {
    const kits = [
      {
        name: "A0",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "A",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "",
        voices: [],
        samples: [],
        bank: null,
      },
      {
        name: "B1",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "B",
        voices: [],
        samples: [],
        bank: null,
      },
      null as any,
      {
        name: "C2",
        alias: null,
        artist: null,
        locked: false,
        editable: false,
        modified_since_sync: false,
        step_pattern: null,
        bank_letter: "C",
        voices: [],
        samples: [],
        bank: null,
      },
    ];
    const result = getAvailableBanks(kits);

    expect(result).toEqual(["A", "B", "C"]);
  });
});

describe("validateBankLetter", () => {
  it("validates correct bank letters", () => {
    expect(validateBankLetter("A")).toBe(true);
    expect(validateBankLetter("Z")).toBe(true);
    expect(validateBankLetter("M")).toBe(true);
    expect(validateBankLetter("a")).toBe(true); // case insensitive
    expect(validateBankLetter("z")).toBe(true);
  });

  it("rejects invalid bank letters", () => {
    expect(validateBankLetter("")).toBe(false);
    expect(validateBankLetter("1")).toBe(false);
    expect(validateBankLetter("AA")).toBe(false);
    expect(validateBankLetter("@")).toBe(false);
    expect(validateBankLetter("a1")).toBe(false);
  });
});
