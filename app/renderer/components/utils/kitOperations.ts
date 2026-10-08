import type { KitWithRelations } from "@romper/shared/db/schema";

import { isKitName } from "@romper/shared/rampleCardLayout";
// Kit operations utilities

/**
 * Creates a kit at the specified slot
 */
/** Resolves to the new kit, when main returns it (#452) */
export async function createKit(
  kitSlot: string,
): Promise<KitWithRelations | undefined> {
  if (!validateKitSlot(kitSlot)) {
    throw new Error("Invalid kit slot. Use format A0-Z99.");
  }

  if (!globalThis.electronAPI?.createKit) {
    throw new Error("Electron API not available");
  }

  const result = await globalThis.electronAPI.createKit(kitSlot);
  if (!result.success) {
    throw new Error(result.error || "Failed to create kit");
  }
  return result.data;
}

/**
 * Deletes a kit and all its child records (samples, voices) from the database
 */
export async function deleteKit(kitName: string): Promise<void> {
  if (!globalThis.electronAPI?.deleteKit) {
    throw new Error("Electron API not available");
  }

  const result = await globalThis.electronAPI.deleteKit(kitName);
  if (!result.success) {
    throw new Error(result.error || "Failed to delete kit");
  }
}

/**
 * Duplicates/copies a kit from source to destination slot
 */
/** Resolves to the copy, when main returns it (#452) */
export async function duplicateKit(
  sourceSlot: string,
  destSlot: string,
): Promise<KitWithRelations | undefined> {
  if (!validateKitSlot(destSlot)) {
    throw new Error("Invalid destination slot. Use format A0-Z99.");
  }

  if (!globalThis.electronAPI?.copyKit) {
    throw new Error("Electron API not available");
  }

  const result = await globalThis.electronAPI.copyKit(sourceSlot, destSlot);
  if (!result.success) {
    throw new Error(result.error || "Failed to copy kit");
  }
  return result.data;
}

/**
 * Format general kit error messages
 */
export function formatKitError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Simplify duplicate kit error message
  if (message === "Kit already exists.") {
    return "Kit already exists";
  }

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
 * Gets the delete summary for a kit (counts of voices and samples)
 */
export async function getKitDeleteSummary(kitName: string): Promise<{
  kitName: string;
  locked: boolean;
  sampleCount: number;
  voiceCount: number;
}> {
  if (!globalThis.electronAPI?.getKitDeleteSummary) {
    throw new Error("Electron API not available");
  }

  const result = await globalThis.electronAPI.getKitDeleteSummary(kitName);
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get kit delete summary");
  }
  return result.data;
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
  const filledSampleCount = samples.filter((s) => s?.trim()).length;
  return filledSampleCount >= 12;
}

/**
 * Validates kit slot format (A0-Z99)
 */
export function validateKitSlot(slot: string): boolean {
  return isKitName(slot);
}
