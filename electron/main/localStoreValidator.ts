import fs from "fs";
import path from "path";

import type {
  KitValidationError,
  LocalStoreValidationDetailedResult,
} from "../../shared/db/schema.js";
import {
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
/**
 * Helper function to perform basic validation checks
 */
function performBasicValidation(localStorePath: string) {
  console.log(
    "[Validation] Starting validateLocalStoreAgainstDb for:",
    localStorePath,
  );

  const basicValidation = validateLocalStoreAndDb(localStorePath);
  console.log("[Validation] Basic validation result:", {
    isValid: basicValidation.isValid,
    error: basicValidation.error,
  });

  if (!basicValidation.isValid) {
    console.log("[Validation] Basic validation failed, returning error");
    return {
      success: false,
      error: basicValidation.error,
    };
  }

  const romperDbPath = basicValidation.romperDbPath!;
  const dbDir = path.dirname(romperDbPath);

  console.log("[Validation] Basic validation passed, checking kits...");
  console.log("[Validation] DB directory:", dbDir);

  return { success: true, dbDir };
}

/**
 * Helper function to validate kit samples
 */
function validateKitSamples(
  dbDir: string,
  kit: any,
  localStorePath: string,
): { missingFiles: string[]; extraFiles: string[]; isValid: boolean } {
  const missingFiles: string[] = [];
  const extraFiles: string[] = [];
  let isValid = true;

  const kitFolderPath = path.join(localStorePath, kit.name);

  // Get samples for this kit
  const samplesResult = getKitSamples(dbDir, kit.name);
  if (!samplesResult.success || !samplesResult.data) {
    return {
      missingFiles: [`Failed to retrieve samples: ${samplesResult.error}`],
      extraFiles: [],
      isValid: false,
    };
  }

  // Check that all samples in DB exist in filesystem using source_path
  for (const sample of samplesResult.data) {
    if (!fs.existsSync(sample.source_path)) {
      missingFiles.push(path.basename(sample.source_path));
      isValid = false;
    }
  }

  // Check for extra files in filesystem not in DB
  const extraFilesResult = findExtraFiles(kitFolderPath, samplesResult.data);
  if (extraFilesResult.extraFiles.length > 0) {
    extraFiles.push(...extraFilesResult.extraFiles);
    isValid = false;
  }

  return { missingFiles, extraFiles, isValid };
}

/**
 * Helper function to find extra files in kit folder
 */
function findExtraFiles(
  kitFolderPath: string,
  samplesData: any[],
): { extraFiles: string[] } {
  const extraFiles: string[] = [];

  try {
    const filesInDir = fs
      .readdirSync(kitFolderPath)
      .filter((file) => file.toLowerCase().endsWith(".wav"));

    const dbFiles = new Set(
      samplesData.map((s) => path.basename(s.source_path).toLowerCase()),
    );

    for (const file of filesInDir) {
      if (!dbFiles.has(file.toLowerCase())) {
        extraFiles.push(file);
      }
    }
  } catch {
    // Error reading directory - kit folder may not exist, which is valid
    // in reference-first architecture, so we don't treat this as an error
  }

  return { extraFiles };
}

export function validateLocalStoreAgainstDb(
  localStorePath: string,
): LocalStoreValidationDetailedResult {
  // Perform basic validation
  const basicResult = performBasicValidation(localStorePath);
  if (!basicResult.success) {
    return {
      isValid: false,
      errorSummary: basicResult.error,
    };
  }

  // Get all kits from the database
  const kitsResult = getKits(basicResult.dbDir!);
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

  // Validate each kit
  const kitErrors: KitValidationError[] = [];
  let isValid = true;

  for (const kit of kitsResult.data) {
    const kitValidation = validateKitSamples(
      basicResult.dbDir!,
      kit,
      localStorePath,
    );

    if (!kitValidation.isValid) {
      isValid = false;
      kitErrors.push({
        kitName: kit.name,
        missingFiles: kitValidation.missingFiles,
        extraFiles: kitValidation.extraFiles,
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
