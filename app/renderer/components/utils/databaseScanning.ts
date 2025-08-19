// Database-backed scanning operations that replace JSON file dependency

import {
  executeFullKitScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
  type ProgressCallback,
} from "./scanners";

// Database operations interface (to be implemented via IPC)
interface DatabaseOperations {
  updateVoiceAlias: (
    dbDir: string,
    kitName: string,
    voiceNumber: number,
    voiceAlias: null | string,
  ) => Promise<VoiceUpdateResult>;
  // Add more database operations as needed
}

// Types for database operations (will be implemented via IPC)
interface VoiceUpdateResult {
  error?: string;
  success: boolean;
}

// Global database operations - will be injected
let dbOps: DatabaseOperations | null = null;

// Types for database scanning operations
export interface DatabaseScanResult {
  errors: Array<{ error: string; operation: string }>;
  scannedKits: number;
  scannedRtfFiles: number;
  scannedVoices: number;
  scannedWavFiles: number;
  success: boolean;
}

export interface KitScanData {
  kitName: string;
  kitPath: string;
  samples: { [voice: number]: string[] };
  wavFiles: string[];
}

export async function scanKitToDatabase(
  dbDir: string,
  kitScanData: KitScanData,
  progressCallback?: ProgressCallback,
): Promise<DatabaseScanResult> {
  const result: DatabaseScanResult = {
    errors: [],
    scannedKits: 0,
    scannedRtfFiles: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    success: true,
  };

  try {
    const scanResult = await executeFullKitScan(
      {
        samples: kitScanData.samples,
        wavFiles: kitScanData.wavFiles,
      },
      progressCallback,
      "continue",
    );

    if (scanResult.results.voiceInference) {
      await processVoiceInferenceResults(
        dbDir,
        kitScanData.kitName,
        scanResult.results.voiceInference.voiceNames,
        result,
      );
    }

    if (scanResult.results.wavAnalysis) {
      processWAVAnalysisResults(
        scanResult.results.wavAnalysis,
        kitScanData.wavFiles,
        result,
      );
    }

    result.errors.push(...scanResult.errors);

    if (scanResult.errors.length > 0) {
      result.success = false;
    }

    if (scanResult.errors.length === 0) {
      result.scannedKits = 1;
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      error: error instanceof Error ? error.message : String(error),
      operation: "kit-scan",
    });
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
    errors: [],
    scannedKits: 0,
    scannedRtfFiles: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    success: true,
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
    errors: [],
    scannedKits: 0,
    scannedRtfFiles: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    success: true,
  };

  try {
    const scanResult = await executeVoiceInferenceScan(samples);

    if (scanResult.success && scanResult.results.voiceInference) {
      await processVoiceInferenceResults(
        dbDir,
        kitName,
        scanResult.results.voiceInference.voiceNames,
        result,
      );
      result.scannedKits = 1;
    } else {
      result.success = false;
      result.errors.push(...scanResult.errors);
      result.scannedKits = 1;
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      error: error instanceof Error ? error.message : String(error),
      operation: "voice-scan",
    });
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
    errors: [],
    scannedKits: 0,
    scannedRtfFiles: 0,
    scannedVoices: 0,
    scannedWavFiles: 0,
    success: true,
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
      error: error instanceof Error ? error.message : String(error),
      operation: "wav-scan",
    });
  }

  return result;
}

/**
 * Set the database operations implementation
 * This allows for dependency injection and testing
 */
export function setDatabaseOperations(operations: DatabaseOperations): void {
  dbOps = operations;
}

/**
 * Scan a single kit and store all results in the database
 *
 * @param dbDir Path to the database directory
 * @param kitScanData Kit data to scan
 * @param progressCallback Optional progress tracking callback
 * @returns Database scan result
 */
// Helper function to process voice inference results
async function processVoiceInferenceResults(
  dbDir: string,
  kitName: string,
  voiceNames: Record<number, string>,
  result: DatabaseScanResult,
): Promise<void> {
  for (const voiceNumStr in voiceNames) {
    const voiceNumber = parseInt(voiceNumStr, 10);
    const voiceAlias = voiceNames[voiceNumber];

    if (voiceAlias) {
      if (!dbOps) {
        result.errors.push({
          error: "Database operations not initialized",
          operation: `voice-${voiceNumber}`,
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
          error: updateResult.error || "Failed to update voice alias",
          operation: `voice-${voiceNumber}`,
        });
        result.success = false;
      }
    }
  }
}

// Helper function to process WAV analysis results
function processWAVAnalysisResults(
  wavAnalyses: any[],
  wavFiles: string[],
  result: DatabaseScanResult,
): void {
  for (let i = 0; i < wavAnalyses.length; i++) {
    const analysis = wavAnalyses[i];
    const filePath = wavFiles[i];

    if (analysis.isValid) {
      result.scannedWavFiles++;
    } else {
      result.errors.push({
        error: "Invalid WAV format",
        operation: `wav-${filePath}`,
      });
    }
  }
}

// RTF scanning is now handled by the bank scanning system
