import type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { validateDatabaseSchema } from "./db/romperDbCoreORM.js";

/**
 * Validates that a local store path exists and contains a valid Romper database.
 * Performs thorough schema validation including database queries.
 * @param localStorePath - The path to the local store directory
 * @returns Validation result with isValid flag, optional error message, and derived DB path
 */
export function validateLocalStoreAndDb(
  localStorePath: string,
): LocalStoreValidationDetailedResult {
  // First check basic structure
  const basicValidation = validateLocalStoreBasic(localStorePath);
  if (!basicValidation.isValid) {
    return basicValidation;
  }

  const romperDbDir = path.join(localStorePath, ".romperdb");
  const romperDbPath = basicValidation.romperDbPath!;

  try {
    // Validate database schema
    const schemaValidation = validateDatabaseSchema(romperDbDir);
    if (!schemaValidation.success) {
      return {
        error: `Database schema validation failed: ${schemaValidation.error}`,
        isValid: false,
      };
    }

    return { isValid: true, romperDbPath };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unknown validation error",
      isValid: false,
    };
  }
}

/**
 * Basic validation that checks if a directory contains a Romper database structure.
 * Does not perform deep schema validation - use validateLocalStoreAndDb for thorough validation.
 * @param localStorePath - The path to the local store directory
 * @returns Validation result with isValid flag, optional error message, and derived DB path
 */
export function validateLocalStoreBasic(
  localStorePath: string,
): LocalStoreValidationDetailedResult {
  try {
    // Check if local store directory exists
    if (!fs.existsSync(localStorePath)) {
      // C1: Path doesn't exist at all (never existed)
      // C2: Path existed before but was deleted/moved
      // C3: Path is temp directory that was cleaned up
      const tempDir = path.resolve(os.tmpdir());
      const absLocalStorePath = path.resolve(localStorePath);
      const isTempDir =
        absLocalStorePath === tempDir ||
        absLocalStorePath.startsWith(tempDir + path.sep);
      const errorMsg = isTempDir
        ? `Local store path does not exist (temporary directory "${localStorePath}" was cleaned up)`
        : "Local store path does not exist";
      return { error: errorMsg, isValid: false };
    }

    // Check if it's a directory
    if (!fs.statSync(localStorePath).isDirectory()) {
      return { error: "Local store path is not a directory", isValid: false };
    }

    // C5: Check if directory is readable
    try {
      fs.accessSync(localStorePath, fs.constants.R_OK);
    } catch {
      return { error: "Local store directory is not readable", isValid: false };
    }

    // C6: Check if directory is writable
    try {
      fs.accessSync(localStorePath, fs.constants.W_OK);
    } catch {
      return { error: "Local store directory is not writable", isValid: false };
    }

    // Check for .romperdb folder
    const romperDbDir = path.join(localStorePath, ".romperdb");
    if (!fs.existsSync(romperDbDir)) {
      return {
        error:
          "This directory does not contain a valid Romper database (.romperdb folder).",
        isValid: false,
      };
    }

    // Check for romper.sqlite file
    const romperDbPath = path.join(romperDbDir, "romper.sqlite");
    if (!fs.existsSync(romperDbPath)) {
      return { error: "Romper DB file not found", isValid: false };
    }

    return { isValid: true, romperDbPath };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unknown validation error",
      isValid: false,
    };
  }
}
