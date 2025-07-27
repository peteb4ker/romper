/**
 * Extracts the bank and name from a single RTF filename (e.g. "A - MyBank.rtf")
 * Returns { bank, name } or null if not a valid bank RTF filename
 */
export function getBankNameFromRtfFilename(
  filename: string,
): { bank: string; name: string } | null {
  const match = /^([A-Z]) - (.+)\.rtf$/i.exec(filename);
  if (match) {
    return {
      bank: match[1].toUpperCase(),
      name: toCapitalCase(match[2]),
    };
  }
  return null;
}
// Bank operations utilities

import { toCapitalCase } from "../../../../shared/kitUtilsShared";

export interface BankNames {
  [bank: string]: string;
}

/**
 * Gets the first kit in a specific bank
 */
export function getFirstKitInBank(kits: string[], bank: string): string | null {
  return (
    kits.find((k) => k && typeof k === "string" && k.startsWith(bank)) || null
  );
}

/**
 * Checks if a bank has any kits
 */
export function bankHasKits(kits: string[], bank: string): boolean {
  return kits.some((k) => k && typeof k === "string" && k[0] === bank);
}

/**
 * Gets all banks that have kits (A-Z)
 */
export function getAvailableBanks(kits: string[]): string[] {
  const banks = new Set<string>();
  for (const kit of kits) {
    if (kit && kit.length > 0) {
      banks.add(kit[0].toUpperCase());
    }
  }
  return Array.from(banks).sort();
}

/**
 * Validates bank letter (A-Z)
 */
export function validateBankLetter(bank: string): boolean {
  return /^[A-Z]$/.test(bank.toUpperCase());
}
