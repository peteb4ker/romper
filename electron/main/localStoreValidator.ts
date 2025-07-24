import fs from "fs";
import path from "path";

import type {
  DbResult,
  KitValidationError,
  LocalStoreValidationDetailedResult,
  Sample,
} from "../../shared/db/schema.js";
import {
  getAllSamples,
  getKits,
  getKitSamples,
  validateDatabaseSchema,
} from "./db/romperDbCoreORM.js";

/**
 * Validates that a local store path exists and contains a valid Romper database.
 * @param localStorePath - The path to the local store directory
 * @returns Validation result with isValid flag, optional error message, and derived DB path
 */
export function validateLocalStoreAndDb(
  localStorePath: string,
): LocalStoreValidationDetailedResult {
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

    // Validate database schema
    const schemaValidation = validateDatabaseSchema(romperDbDir);
    if (!schemaValidation.success) {
      return {
        isValid: false,
        error: `Database schema validation failed: ${schemaValidation.error}`,
      };
    }

    return { isValid: true, romperDbPath };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
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

/**
 * Validates that the files in the local store match the records in the Romper database.
 * @param localStorePath - The path to the local store directory
 * @returns Detailed validation result with specific errors if any found
 */
export function validateLocalStoreAgainstDb(
  localStorePath: string,
): LocalStoreValidationDetailedResult {
  // First check basic validity
  const basicValidation = validateLocalStoreAndDb(localStorePath);
  if (!basicValidation.isValid) {
    return {
      isValid: false,
      errorSummary: basicValidation.error,
    };
  }

  const romperDbPath = basicValidation.romperDbPath!;
  const dbDir = path.dirname(romperDbPath);

  // Get all kits from the database
  const kitsResult = getKits(dbDir);
  if (!kitsResult.success || !kitsResult.data) {
    return {
      isValid: false,
      errorSummary: `Failed to retrieve kits from database: ${kitsResult.error}`,
    };
  }

  const kitErrors: KitValidationError[] = [];
  let isValid = true;

  // For each kit, check if the folder exists and validate samples
  for (const kit of kitsResult.data) {
    const missingFiles: string[] = [];
    const extraFiles: string[] = [];

    // Check if kit folder exists (kit.name is the direct property from Drizzle)
    const kitFolderPath = path.join(localStorePath, kit.name);
    if (
      !fs.existsSync(kitFolderPath) ||
      !fs.statSync(kitFolderPath).isDirectory()
    ) {
      // Kit folder doesn't exist but is in DB
      isValid = false;
      kitErrors.push({
        kitName: kit.name,
        missingFiles: [`Kit folder ${kit.name} does not exist`],
        extraFiles: [],
      });
      continue;
    }

    // Get samples for this kit
    const samplesResult = getKitSamples(dbDir, kit.name);
    if (!samplesResult.success || !samplesResult.data) {
      isValid = false;
      kitErrors.push({
        kitName: kit.name,
        missingFiles: [`Failed to retrieve samples: ${samplesResult.error}`],
        extraFiles: [],
      });
      continue;
    }

    // Check that all samples in DB exist in filesystem
    for (const sample of samplesResult.data) {
      const samplePath = path.join(kitFolderPath, sample.filename);
      if (!fs.existsSync(samplePath)) {
        missingFiles.push(sample.filename);
        isValid = false;
      }
    }

    // Check for extra files in filesystem not in DB
    try {
      const filesInDir = fs
        .readdirSync(kitFolderPath)
        .filter((file) => file.toLowerCase().endsWith(".wav"));

      const dbFiles = new Set(
        samplesResult.data.map((s) => s.filename.toLowerCase()),
      );

      for (const file of filesInDir) {
        if (!dbFiles.has(file.toLowerCase())) {
          extraFiles.push(file);
          isValid = false;
        }
      }
    } catch (error) {
      // Error reading directory
      isValid = false;
      missingFiles.push(
        `Error reading kit directory: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Add to errors if any issues found
    if (missingFiles.length > 0 || extraFiles.length > 0) {
      kitErrors.push({
        kitName: kit.name,
        missingFiles,
        extraFiles,
      });
    }
  }

  return {
    isValid,
    errors: kitErrors.length > 0 ? kitErrors : undefined,
    errorSummary: isValid
      ? undefined
      : `Found ${kitErrors.length} kit(s) with validation errors`,
  };
}
