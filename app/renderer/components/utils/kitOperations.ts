// Kit operations utilities

/**
 * Validates kit slot format (A0-Z99)
 */
export function validateKitSlot(slot: string): boolean {
  return /^[A-Z][0-9]{1,2}$/.test(slot);
}

/**
 * Creates a kit at the specified slot
 */
export async function createKit(
  localStorePath: string,
  kitSlot: string,
): Promise<void> {
  if (!validateKitSlot(kitSlot)) {
    throw new Error("Invalid kit slot. Use format A0-Z99.");
  }

  if (!window.electronAPI?.createKit) {
    throw new Error("Electron API not available");
  }

  await window.electronAPI.createKit(localStorePath, kitSlot);
}

/**
 * Duplicates/copies a kit from source to destination slot
 */
export async function duplicateKit(
  localStorePath: string,
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
    await window.electronAPI.copyKit(localStorePath, sourceSlot, destSlot);
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
 * Format general kit error messages
 */
export function formatKitError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to create kit: ${message}`;
}
