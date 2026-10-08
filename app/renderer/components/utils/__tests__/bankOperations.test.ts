// Tests for bank operations utilities

import type { KitWithRelations } from "@romper/shared/db/schema";

import { describe, expect, it } from "vitest";

import { createMockKitWithRelations } from "../../../../../tests/factories/kit.factory";
import { bankHasKits, getFirstKitInBank } from "../bankOperations";

// No mocks needed for the remaining pure utility functions

/** A kit with no bank row, samples or voices */
const kit = (bankLetter: string, name: string): KitWithRelations =>
  createMockKitWithRelations({
    bank: null,
    bank_letter: bankLetter,
    name,
    samples: [],
    voices: [],
  });

describe("getFirstKitInBank", () => {
  const kits = [
    kit("A", "A0"),
    kit("A", "A1"),
    kit("A", "A10"),
    kit("B", "B0"),
    kit("B", "B5"),
    kit("C", "C1"),
    kit("Z", "Z99"),
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
    kit("A", "A0"),
    kit("A", "A1"),
    kit("B", "B0"),
    kit("C", "C1"),
    kit("Z", "Z99"),
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
