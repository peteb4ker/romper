export interface BankNames {
  [bank: string]: string;
}
// Bank operations utilities

import type { KitWithRelations } from "@romper/shared/db/schema";

/**
 * Checks if a bank has any kits
 */
export function bankHasKits(kits: KitWithRelations[], bank: string): boolean {
  return kits.some((k) => k?.name?.startsWith(bank));
}

/**
 * Gets the first kit in a specific bank
 */
export function getFirstKitInBank(
  kits: KitWithRelations[],
  bank: string,
): null | string {
  const kit = kits.find((k) => k?.name?.startsWith(bank));
  return kit ? kit.name : null;
}
