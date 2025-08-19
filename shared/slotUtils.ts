/**
 * Utility functions for working with 0-11 slot indexing
 * Database stores 0-11, UI displays as 1-12
 */

export const MAX_SLOTS = 12;

/**
 * Convert 1-based display number to 0-based slot index
 * Only used when parsing user input
 */
export function displayNumberToSlotNumber(displayNumber: number): number {
  if (displayNumber < 1 || displayNumber > MAX_SLOTS) {
    throw new Error(
      `Display number must be 1-${MAX_SLOTS}, got ${displayNumber}`
    );
  }
  return displayNumber - 1;
}

/**
 * Get filled sample count from array
 */
export function getFilledSampleCount(samples: (string | undefined)[]): number {
  return samples.filter((sample) => sample && sample !== "").length;
}

/**
 * Get insertion slot for position-based insertion in 0-11 system
 * Returns the slot index where a new sample should be inserted
 */
export function getInsertionDbSlot(
  samples: { slot_number: number }[],
  displayPosition: number
): number {
  const slotNumber = displayNumberToSlotNumber(displayPosition);

  // For 0-11 system, insertion position is just the slot index
  // This will shift existing samples at this position and after
  return slotNumber;
}

/**
 * Validate slot index is within valid range (0-11)
 */
export function isValidSlotNumber(slotNumber: number): boolean {
  return slotNumber >= 0 && slotNumber < MAX_SLOTS;
}

/**
 * Convert 0-based slot index to 1-based display number
 * Only used for UI display and error messages
 */
export function slotNumberToDisplayNumber(slotNumber: number): number {
  if (!isValidSlotNumber(slotNumber)) {
    throw new Error(
      `Slot number must be 0-${MAX_SLOTS - 1}, got ${slotNumber}`
    );
  }
  return slotNumber + 1;
}

// Legacy function mappings for backward compatibility during transition
export const uiSlotToDbSlot = displayNumberToSlotNumber;
export const dbSlotToUiSlot = slotNumberToDisplayNumber;
