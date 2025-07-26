// Database-backed scanning operations that replace JSON file dependency

import {
  executeFullKitScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
  type ProgressCallback,
} from "./scanners";

// Types for database operations (will be implemented via IPC)
interface VoiceUpdateResult {
  success: boolean;
  error?: string;
}

// Database operations interface (to be implemented via IPC)
interface DatabaseOperations {
  updateVoiceAlias: (
    dbDir: string,
    kitName: string,
    voiceNumber: number,
    voiceAlias: string | null,
  ) => Promise<VoiceUpdateResult>;
  // Add more database operations as needed
}

// Global database operations - will be injected
let dbOps: DatabaseOperations | null = null;

/**
 * Set the database operations implementation
 * This allows for dependency injection and testing
 */
export function setDatabaseOperations(operations: DatabaseOperations): void {
  dbOps = operations;
}

// Types for database scanning operations
export interface DatabaseScanResult {
  success: boolean;
  scannedKits: number;
  scannedVoices: number;
  scannedWavFiles: number;
  scannedRtfFiles: number;
  errors: Array<{ operation: string; error: string }>;
}

export interface KitScanData {
  kitName: string;
  kitPath: string;
  samples: { [voice: number]: string[] };
  wavFiles: string[];
}

/**
 * Scan a single kit and store all results in the database
 *
 * @param dbDir Path to the database directory
 * @param kitScanData Kit data to scan
 * @param progressCallback Optional progress tracking callback
 * @returns Database scan result
 */
export async function scanKitToDatabase(
  dbDir: string,
  kitScanData: KitScanData,
  progressCallback?: ProgressCallback,
): Promise<DatabaseScanResult> {
  const result: DatabaseScanResult = {
    success: true,
    scannedKits: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    scannedRtfFiles: 0,
    errors: [],
  };

  try {
    // Execute the full scanning chain
    const scanResult = await executeFullKitScan(
      {
        samples: kitScanData.samples,
        wavFiles: kitScanData.wavFiles,
      },
      progressCallback,
      "continue", // Continue on errors to get partial results
    );

    // Store voice inference results in database
    if (scanResult.results.voiceInference) {
      const voiceNames = scanResult.results.voiceInference.voiceNames;

      for (const voiceNumStr in voiceNames) {
        const voiceNumber = parseInt(voiceNumStr, 10);
        const voiceAlias = voiceNames[voiceNumber];

        if (voiceAlias) {
          if (!dbOps) {
            result.errors.push({
              operation: `voice-${voiceNumber}`,
              error: "Database operations not initialized",
            });
            result.success = false;
            continue;
          }

          const updateResult = await dbOps.updateVoiceAlias(
            dbDir,
            kitScanData.kitName,
            voiceNumber,
            voiceAlias,
          );

          if (updateResult.success) {
            result.scannedVoices++;
          } else {
            result.errors.push({
              operation: `voice-${voiceNumber}`,
              error: updateResult.error || "Failed to update voice alias",
            });
            result.success = false;
          }
        }
      }
    }

    // Store WAV analysis results in database
    if (scanResult.results.wavAnalysis) {
      const wavAnalyses = scanResult.results.wavAnalysis;

      for (let i = 0; i < wavAnalyses.length; i++) {
        const analysis = wavAnalyses[i];
        const filePath = kitScanData.wavFiles[i];

        if (analysis.isValid) {
          // WAV metadata is stored when samples are inserted
          // For now, we just count successful analyses
          result.scannedWavFiles++;
        } else {
          result.errors.push({
            operation: `wav-${filePath}`,
            error: "Invalid WAV format",
          });
        }
      }
    }

    // RTF artist results are now handled by bank scanning system

    // Include any orchestration errors with their original operation names
    result.errors.push(...scanResult.errors);

    if (scanResult.errors.length > 0) {
      result.success = false;
    }

    // Count as scanned only if we successfully processed it without errors
    if (scanResult.errors.length === 0) {
      result.scannedKits = 1;
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      operation: "kit-scan",
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't count as scanned if we hit an exception
  }

  return result;
}

/**
 * Scan multiple kits and store all results in the database
 *
 * @param dbDir Path to the database directory
 * @param kitsToScan Array of kit data to scan
 * @param progressCallback Optional progress tracking callback
 * @returns Combined database scan result
 */
export async function scanMultipleKitsToDatabase(
  dbDir: string,
  kitsToScan: KitScanData[],
  progressCallback?: ProgressCallback,
): Promise<DatabaseScanResult> {
  const combinedResult: DatabaseScanResult = {
    success: true,
    scannedKits: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    scannedRtfFiles: 0,
    errors: [],
  };

  for (let i = 0; i < kitsToScan.length; i++) {
    const kitData = kitsToScan[i];

    // Report overall progress
    if (progressCallback) {
      progressCallback(i, kitsToScan.length, `Scanning kit ${kitData.kitName}`);
    }

    const kitResult = await scanKitToDatabase(dbDir, kitData, progressCallback);

    // Combine results
    combinedResult.scannedKits += kitResult.scannedKits;
    combinedResult.scannedVoices += kitResult.scannedVoices;
    combinedResult.scannedWavFiles += kitResult.scannedWavFiles;
    combinedResult.scannedRtfFiles += kitResult.scannedRtfFiles;
    combinedResult.errors.push(...kitResult.errors);

    if (!kitResult.success) {
      combinedResult.success = false;
    }
  }

  // Report completion
  if (progressCallback) {
    progressCallback(kitsToScan.length, kitsToScan.length, "Scanning complete");
  }

  return combinedResult;
}

/**
 * Scan only voice names for a single kit and store in database
 *
 * @param dbDir Path to the database directory
 * @param kitName Kit name in the database
 * @param samples Sample data organized by voice
 * @returns Database scan result
 */
export async function scanVoiceNamesToDatabase(
  dbDir: string,
  kitName: string,
  samples: { [voice: number]: string[] },
): Promise<DatabaseScanResult> {
  const result: DatabaseScanResult = {
    success: true,
    scannedKits: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    scannedRtfFiles: 0,
    errors: [],
  };

  try {
    const scanResult = await executeVoiceInferenceScan(samples);

    if (scanResult.success && scanResult.results.voiceInference) {
      const voiceNames = scanResult.results.voiceInference.voiceNames;

      for (const voiceNumStr in voiceNames) {
        const voiceNumber = parseInt(voiceNumStr, 10);
        const voiceAlias = voiceNames[voiceNumber];

        if (voiceAlias) {
          if (!dbOps) {
            result.errors.push({
              operation: `voice-${voiceNumber}`,
              error: "Database operations not initialized",
            });
            result.success = false;
            continue;
          }

          const updateResult = await dbOps.updateVoiceAlias(
            dbDir,
            kitName,
            voiceNumber,
            voiceAlias,
          );

          if (updateResult.success) {
            result.scannedVoices++;
          } else {
            result.errors.push({
              operation: `voice-${voiceNumber}`,
              error: updateResult.error || "Failed to update voice alias",
            });
            result.success = false;
          }
        }
      }

      // Count as scanned kit since we attempted voice scanning
      result.scannedKits = 1;
    } else {
      result.success = false;
      result.errors.push(...scanResult.errors);
      // Still count as attempted scan
      result.scannedKits = 1;
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      operation: "voice-scan",
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't count as scanned if we hit an exception
  }

  return result;
}

/**
 * Scan WAV files and store metadata in database
 *
 * @param dbDir Path to the database directory
 * @param wavFiles Array of WAV file paths to analyze
 * @param fileReader Optional file reader function for testing
 * @returns Database scan result
 */
export async function scanWavFilesToDatabase(
  dbDir: string,
  wavFiles: string[],
  fileReader?: (filePath: string) => Promise<ArrayBuffer>,
): Promise<DatabaseScanResult> {
  const result: DatabaseScanResult = {
    success: true,
    scannedKits: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    scannedRtfFiles: 0,
    errors: [],
  };

  try {
    const scanResult = await executeWAVAnalysisScan(wavFiles, fileReader);

    if (scanResult.success && scanResult.results.wavAnalysis) {
      result.scannedWavFiles = scanResult.results.wavAnalysis.length;

      // Note: The WAV metadata would be stored when updating sample records
      // This would require additional database operations to update existing samples
      // For now, we just track successful analyses
    } else {
      result.success = false;
      result.errors.push(...scanResult.errors);
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      operation: "wav-scan",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

// RTF scanning is now handled by the bank scanning system
