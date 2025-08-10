// Kit operations utilities

/**
 * Checks if a voice can accept external drops (not at 12-sample limit)
 * @param samples Array of sample names for the voice
 * @returns true if voice can accept external drops
 */
export function canAcceptExternalDrops(samples: string[]): boolean {
  return !isVoiceAtSampleLimit(samples);
}

/**
 * Creates a kit at the specified slot
 */
export async function createKit(kitSlot: string): Promise<void> {
  if (!validateKitSlot(kitSlot)) {
    throw new Error("Invalid kit slot. Use format A0-Z99.");
  }

  if (!window.electronAPI?.createKit) {
    throw new Error("Electron API not available");
  }

  await window.electronAPI.createKit(kitSlot);
}

/**
 * Duplicates/copies a kit from source to destination slot
 */
export async function duplicateKit(
  sourceSlot: string,
  destSlot: string,
): Promise<void> {
  if (!validateKitSlot(destSlot)) {
    throw new Error("Invalid destination slot. Use format A0-Z99.");
  }

  if (!window.electronAPI?.copyKit) {
    throw new Error("Electron API not available");
  }

  try {
    await window.electronAPI.copyKit(sourceSlot, destSlot);
  } catch (err) {
    // Clean up error message
    let msg = String(err instanceof Error ? err.message : err);
    msg = msg
      .replace(/^Error invoking remote method 'copy-kit':\s*/, "")
      .replace(/^Error:\s*/, "");
    throw new Error(msg);
  }
}

/**
 * Format general kit error messages
 */
export function formatKitError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to create kit: ${message}`;
}

/**
 * Format error messages for kit operations
 */
export function formatKitOperationError(
  error: unknown,
  operation: string,
): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to ${operation} kit: ${message}`;
}

/**
 * Gets the count of filled samples in a voice
 * @param samples Array of sample names for the voice
 * @returns Number of non-empty samples
 */
export function getFilledSampleCount(samples: string[]): number {
  return samples.filter((s) => s && s.trim()).length;
}

/**
 * Checks if a voice has reached the 12-sample limit
 * @param samples Array of sample names for the voice
 * @returns true if voice has 12 or more samples
 */
export function isVoiceAtSampleLimit(samples: string[]): boolean {
  if (!samples || !Array.isArray(samples)) {
    return false;
  }
  const filledSampleCount = samples.filter((s) => s && s.trim()).length;
  return filledSampleCount >= 12;
}

/**
 * Validates kit slot format (A0-Z99)
 */
export function validateKitSlot(slot: string): boolean {
  return /^\p{Lu}\d{1,2}$/u.test(slot);
}
