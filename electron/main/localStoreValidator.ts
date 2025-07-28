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
      return { isValid: false, error: "Local store path does not exist" };
    }

    // Check if it's a directory
    if (!fs.statSync(localStorePath).isDirectory()) {
      return { isValid: false, error: "Local store path is not a directory" };
    }

    // Check for .romperdb folder
    const romperDbDir = path.join(localStorePath, ".romperdb");
    if (!fs.existsSync(romperDbDir)) {
      return {
        isValid: false,
        error:
          "This directory does not contain a valid Romper database (.romperdb folder).",
      };
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
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

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
  console.log(
    "[Validation] Starting validateLocalStoreAgainstDb for:",
    localStorePath,
  );

  // First check basic validity
  const basicValidation = validateLocalStoreAndDb(localStorePath);
  console.log("[Validation] Basic validation result:", {
    isValid: basicValidation.isValid,
    error: basicValidation.error,
  });

  if (!basicValidation.isValid) {
    console.log("[Validation] Basic validation failed, returning error");
    return {
      isValid: false,
      errorSummary: basicValidation.error,
    };
  }

  const romperDbPath = basicValidation.romperDbPath!;
  const dbDir = path.dirname(romperDbPath);

  console.log("[Validation] Basic validation passed, checking kits...");
  console.log("[Validation] DB directory:", dbDir);

  // Get all kits from the database
  const kitsResult = getKits(dbDir);
  console.log("[Validation] Kits query result:", {
    success: kitsResult.success,
    error: kitsResult.error,
    dataLength: kitsResult.data?.length,
  });

  if (!kitsResult.success || !kitsResult.data) {
    console.log("[Validation] Failed to get kits, returning error");
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

    // Note: In reference-first architecture, kit folders don't need to exist
    // since samples live at their source_path locations, but we still check for extra files
    const kitFolderPath = path.join(localStorePath, kit.name);

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

    // Check that all samples in DB exist in filesystem using source_path
    for (const sample of samplesResult.data) {
      if (!fs.existsSync(sample.source_path)) {
        missingFiles.push(path.basename(sample.source_path));
        isValid = false;
      }
    }

    // Check for extra files in filesystem not in DB
    try {
      const filesInDir = fs
        .readdirSync(kitFolderPath)
        .filter((file) => file.toLowerCase().endsWith(".wav"));

      const dbFiles = new Set(
        samplesResult.data.map((s) =>
          path.basename(s.source_path).toLowerCase(),
        ),
      );

      for (const file of filesInDir) {
        if (!dbFiles.has(file.toLowerCase())) {
          extraFiles.push(file);
          isValid = false;
        }
      }
    } catch (error) {
      // Error reading directory - kit folder may not exist, which is valid
      // in reference-first architecture, so we don't treat this as an error
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

  console.log("[Validation] File validation completed:", {
    isValid,
    kitErrorsCount: kitErrors.length,
    totalKits: kitsResult.data.length,
  });

  if (kitErrors.length > 0) {
    console.log("[Validation] Kit errors found:", kitErrors);
  }

  const result = {
    isValid,
    errors: kitErrors.length > 0 ? kitErrors : undefined,
    errorSummary: isValid
      ? undefined
      : `Found ${kitErrors.length} kit(s) with validation errors`,
  };

  console.log("[Validation] Final validation result:", result);
  return result;
}
