import fs from "fs";
import path from "path";

export interface LocalStoreValidationResult {
  isValid: boolean;
  error?: string;
  romperDbPath?: string;
}

/**
 * Validates that a local store path exists and contains a valid Romper database.
 * @param localStorePath - The path to the local store directory
 * @returns Validation result with isValid flag, optional error message, and derived DB path
 */
export function validateLocalStoreAndDb(localStorePath: string): LocalStoreValidationResult {
  try {
    // Check if local store directory exists
    if (!fs.existsSync(localStorePath)) {
      return { isValid: false, error: "Local store path does not exist" };
    }

    // Check if it's a directory
    if (!fs.statSync(localStorePath).isDirectory()) {
      return { isValid: false, error: "Local store path is not a directory" };
    }

    // Check for .romperdb folder
    const romperDbDir = path.join(localStorePath, ".romperdb");
    if (!fs.existsSync(romperDbDir)) {
      return { isValid: false, error: "Romper DB directory not found" };
    }

    // Check for romper.sqlite file
    const romperDbPath = path.join(romperDbDir, "romper.sqlite");
    if (!fs.existsSync(romperDbPath)) {
      return { isValid: false, error: "Romper DB file not found" };
    }

    return { isValid: true, romperDbPath };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * Derives the Romper database path from a local store path.
 * @param localStorePath - The path to the local store directory
 * @returns The path to the Romper database file
 */
export function getRomperDbPath(localStorePath: string): string {
  return path.join(localStorePath, ".romperdb", "romper.sqlite");
}
