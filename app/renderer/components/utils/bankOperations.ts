/**
 * Extracts the bank and name from a single RTF filename (e.g. "A - MyBank.rtf")
 * Returns { bank, name } or null if not a valid bank RTF filename
 */
export function getBankNameFromRtfFilename(
  filename: string,
): { bank: string; name: string } | null {
  const match = /^(\p{Lu}) - (.+)\.rtf$/iu.exec(filename);
  if (match) {
    return {
      bank: match[1].toUpperCase(),
      name: toCapitalCase(match[2]),
    };
  }
  return null;
}
// Bank operations utilities

import type { KitWithRelations } from "../../../../shared/db/schema";
import { toCapitalCase } from "../../../../shared/kitUtilsShared";

export interface BankNames {
  [bank: string]: string;
}

/**
 * Gets the first kit in a specific bank
 */
export function getFirstKitInBank(
  kits: KitWithRelations[],
  bank: string,
): string | null {
  const kit = kits.find((k) => k?.name?.startsWith(bank));
  return kit ? kit.name : null;
}

/**
 * Checks if a bank has any kits
 */
export function bankHasKits(kits: KitWithRelations[], bank: string): boolean {
  return kits.some((k) => k?.name?.startsWith(bank));
}

/**
 * Gets all banks that have kits (A-Z)
 */
export function getAvailableBanks(kits: KitWithRelations[]): string[] {
  const banks = new Set<string>();
  for (const kit of kits) {
    if (kit && kit.name && kit.name.length > 0) {
      banks.add(kit.name[0].toUpperCase());
    }
  }
  return Array.from(banks).sort();
}

/**
 * Validates bank letter (A-Z)
 */
export function validateBankLetter(bank: string): boolean {
  return /^\p{Lu}$/u.test(bank.toUpperCase());
}
