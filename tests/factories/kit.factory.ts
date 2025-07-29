import type { Kit, KitWithRelations, NewKit } from "../../shared/db/schema";

/**
 * Factory for creating mock Kit objects
 * Reduces test data duplication and ensures consistent test data structure
 */
export const createMockKit = (overrides: Partial<Kit> = {}): Kit => ({
  id: 1,
  name: "A0",
  bank_letter: "A",
  alias: null,
  artist: null,
  editable: false,
  locked: false,
  step_pattern: null,
  modified_since_sync: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  scanned_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Factory for creating mock KitWithRelations objects
 */
export const createMockKitWithRelations = (
  overrides: Partial<KitWithRelations> = {},
): KitWithRelations => {
  const baseKit = createMockKit(overrides);
  return {
    ...baseKit,
    bank: {
      letter: overrides.bank_letter || baseKit.bank_letter || "A",
      artist: "Test Artist A",
      rtf_filename: null,
      scanned_at: new Date().toISOString(),
    },
    samples: [],
    ...overrides,
  };
};

/**
 * Factory for creating mock NewKit objects
 */
export const createMockNewKit = (overrides: Partial<NewKit> = {}): NewKit => ({
  name: "A0",
  bank_letter: "A",
  alias: null,
  artist: null,
  editable: false,
  locked: false,
  step_pattern: null,
  modified_since_sync: false,
  ...overrides,
});

/**
 * Creates a list of mock kits with sequential names
 */
export const createMockKitList = (
  count: number = 5,
  baseOverrides: Partial<Kit> = {},
): Kit[] =>
  Array.from({ length: count }, (_, i) =>
    createMockKit({
      id: i + 1,
      name: `A${i}`,
      ...baseOverrides,
    }),
  );

/**
 * Creates a list of mock kits with relations
 */
export const createMockKitWithRelationsList = (
  count: number = 5,
  baseOverrides: Partial<KitWithRelations> = {},
): KitWithRelations[] =>
  Array.from({ length: count }, (_, i) =>
    createMockKitWithRelations({
      id: i + 1,
      name: `A${i}`,
      ...baseOverrides,
    }),
  );

/**
 * Creates mock kits for specific banks
 */
export const createMockBankKits = (
  bankLetter: string,
  count: number = 16,
): Kit[] =>
  Array.from({ length: count }, (_, i) =>
    createMockKit({
      id: i + 1,
      name: `${bankLetter}${i}`,
      bank_letter: bankLetter,
    }),
  );

/**
 * Creates mock kits with specific editing states
 */
export const createMockEditableKits = (count: number = 3): Kit[] =>
  createMockKitList(count, { editable: true });

/**
 * Creates mock kits with specific locking states
 */
export const createMockLockedKits = (count: number = 3): Kit[] =>
  createMockKitList(count, { locked: true });

/**
 * Creates mock kits with step patterns
 */
export const createMockKitsWithStepPatterns = (count: number = 3): Kit[] =>
  createMockKitList(count, {
    step_pattern: JSON.stringify(
      Array.from({ length: 4 }, () => Array(16).fill(0)),
    ),
  });
