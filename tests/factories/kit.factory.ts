import type { Kit, KitWithRelations, NewKit } from "../../shared/db/schema";

/**
 * Factory for creating mock Kit objects
 * Reduces test data duplication and ensures consistent test data structure
 */
export const createMockKit = (overrides: Partial<Kit> = {}): Kit => ({
  alias: null,
  artist: null,
  bank_letter: "A",
  created_at: new Date().toISOString(),
  editable: false,
  id: 1,
  locked: false,
  modified_since_sync: false,
  name: "A0",
  scanned_at: new Date().toISOString(),
  step_pattern: null,
  updated_at: new Date().toISOString(),
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
      artist: "Test Artist A",
      letter: overrides.bank_letter || baseKit.bank_letter || "A",
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
  alias: null,
  artist: null,
  bank_letter: "A",
  editable: false,
  locked: false,
  modified_since_sync: false,
  name: "A0",
  step_pattern: null,
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
      bank_letter: bankLetter,
      id: i + 1,
      name: `${bankLetter}${i}`,
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
