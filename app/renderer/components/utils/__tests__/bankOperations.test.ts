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
  const kits = ["A0", "A1", "A10", "B0", "B5", "C1", "Z99"];

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
  const kits = ["A0", "A1", "B0", "C1", "Z99"];

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
    const kits = ["A0", "A1", "A10", "B0", "B5", "C1", "Z99"];
    const result = getAvailableBanks(kits);

    expect(result).toEqual(["A", "B", "C", "Z"]);
  });

  it("handles empty kit list", () => {
    const result = getAvailableBanks([]);
    expect(result).toEqual([]);
  });

  it("sorts banks alphabetically", () => {
    const kits = ["Z0", "A0", "M5", "B2"];
    const result = getAvailableBanks(kits);

    expect(result).toEqual(["A", "B", "M", "Z"]);
  });

  it("handles lowercase bank letters", () => {
    const kits = ["a0", "b1", "C2"];
    const result = getAvailableBanks(kits);

    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles invalid kit names gracefully", () => {
    const kits = ["A0", "", "B1", null as any, "C2"];
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
