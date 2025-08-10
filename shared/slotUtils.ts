/**
 * Utility functions for converting between display slot numbers (1-12)
 * and database slot numbers (100-1200) for spaced ordering
 */

export const SLOT_SPACING = 100;
export const MAX_SLOTS = 12;

/**
 * Convert database slot number (100-1200) to display slot number (1-12)
 */
export function dbSlotToDisplaySlot(dbSlot: number): number {
  const displaySlot = Math.round(dbSlot / SLOT_SPACING);
  if (displaySlot < 1 || displaySlot > MAX_SLOTS) {
    throw new Error(
      `Database slot ${dbSlot} converts to invalid display slot ${displaySlot}`,
    );
  }
  return displaySlot;
}

/**
 * Convert display slot number (1-12) to database slot number (100-1200)
 */
export function displaySlotToDbSlot(displaySlot: number): number {
  if (displaySlot < 1 || displaySlot > MAX_SLOTS) {
    throw new Error(
      `Display slot must be between 1 and ${MAX_SLOTS}, got ${displaySlot}`,
    );
  }
  return displaySlot * SLOT_SPACING;
}

/**
 * Generate a database slot number for insertion between two existing slots
 */
export function generateInsertionSlot(
  beforeSlot: number,
  afterSlot: number,
): number {
  const midpoint = Math.floor((beforeSlot + afterSlot) / 2);

  // If there's room for insertion, use midpoint
  if (midpoint > beforeSlot && midpoint < afterSlot) {
    return midpoint;
  }

  // If no room, we need to reindex (shouldn't happen with 100-spacing, but safety check)
  throw new Error(
    `No room to insert between slots ${beforeSlot} and ${afterSlot}. Reindexing needed.`,
  );
}

/**
 * Get the database slot number for inserting at a specific display position
 */
export function getInsertionDbSlot(
  existingSamples: Array<{ slot_number: number }>,
  insertAtDisplaySlot: number,
): number {
  // Sort existing samples by slot number
  const sortedSlots = existingSamples
    .map((s) => s.slot_number)
    .sort((a, b) => a - b);

  const targetDbSlot = displaySlotToDbSlot(insertAtDisplaySlot);

  // If inserting at the end or in an empty slot, use standard spacing
  const existingAtTarget = sortedSlots.find((slot) => slot >= targetDbSlot);
  if (!existingAtTarget) {
    return targetDbSlot;
  }

  // Find the slot before the target position
  const beforeSlot =
    sortedSlots.filter((slot) => slot < targetDbSlot).pop() || 0;

  // Insert between the before slot and the first existing slot at/after target
  return generateInsertionSlot(beforeSlot, existingAtTarget);
}

/**
 * Enhanced insertion that automatically reindexes when needed
 */
export function getInsertionDbSlotWithReindexing(
  existingSamples: Array<{ slot_number: number }>,
  insertAtDisplaySlot: number,
): {
  insertionSlot: number;
  reindexedSamples?: Array<{ slot_number: number }>;
  wasReindexed: boolean;
} {
  // First, try normal insertion
  try {
    const insertionSlot = getInsertionDbSlot(
      existingSamples,
      insertAtDisplaySlot,
    );
    return {
      insertionSlot,
      wasReindexed: false,
    };
  } catch (error) {
    // If insertion fails and we should reindex, do it
    if (shouldReindexBeforeInsertion(existingSamples, insertAtDisplaySlot)) {
      const reindexedSamples = reindexSamples(existingSamples);
      const insertionSlot = getInsertionDbSlot(
        reindexedSamples,
        insertAtDisplaySlot,
      );

      return {
        insertionSlot,
        reindexedSamples,
        wasReindexed: true,
      };
    }

    // Re-throw if we can't help with reindexing
    throw error;
  }
}

/**
 * Reindex samples to restore proper spacing
 * Redistributes samples evenly across the available slot space
 */
export function reindexSamples<T extends { slot_number: number }>(
  samples: T[],
): T[] {
  if (samples.length === 0) return samples;
  if (samples.length > MAX_SLOTS) {
    throw new Error(
      `Cannot reindex ${samples.length} samples into ${MAX_SLOTS} slots`,
    );
  }

  // Sort samples by current slot number to maintain order
  const sortedSamples = [...samples].sort(
    (a, b) => a.slot_number - b.slot_number,
  );

  // Reassign to evenly spaced slots
  return sortedSamples.map((sample, index) => ({
    ...sample,
    slot_number: (index + 1) * SLOT_SPACING, // 100, 200, 300, etc.
  }));
}

/**
 * Check if reindexing is recommended before attempting insertion
 */
export function shouldReindexBeforeInsertion(
  existingSamples: Array<{ slot_number: number }>,
  insertAtDisplaySlot: number,
): boolean {
  try {
    getInsertionDbSlot(existingSamples, insertAtDisplaySlot);
    return false; // Insertion succeeded, no reindex needed
  } catch (error) {
    // If insertion would fail, check if reindexing would help
    if (error instanceof Error && error.message.includes("No room to insert")) {
      return existingSamples.length < MAX_SLOTS; // Only reindex if we have room
    }
    return false;
  }
}

/**
 * Validate that database slots are properly spaced for the given voice
 */
export function validateSlotSpacing(samples: Array<{ slot_number: number }>): {
  issues: string[];
  isValid: boolean;
  needsReindexing: boolean;
} {
  const issues: string[] = [];
  const slots = samples.map((s) => s.slot_number).sort((a, b) => a - b);
  let needsReindexing = false;

  for (const slot of slots) {
    if (slot % SLOT_SPACING !== 0) {
      issues.push(
        `Slot ${slot} is not properly spaced (should be multiple of ${SLOT_SPACING})`,
      );
      needsReindexing = true;
    }

    const displaySlot = slot / SLOT_SPACING;
    if (displaySlot < 1 || displaySlot > MAX_SLOTS) {
      issues.push(
        `Slot ${slot} converts to invalid display position ${displaySlot}`,
      );
    }
  }

  // Check for overcrowding - if consecutive slots are too close, suggest reindexing
  for (let i = 1; i < slots.length; i++) {
    const gap = slots[i] - slots[i - 1];
    if (gap < 10) {
      // Less than 10 units apart suggests overcrowding
      issues.push(
        `Slots ${slots[i - 1]} and ${slots[i]} are too close (gap: ${gap})`,
      );
      needsReindexing = true;
    }
  }

  return {
    issues,
    isValid: issues.length === 0,
    needsReindexing,
  };
}
