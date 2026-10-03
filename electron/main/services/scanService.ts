import type { DbResult, KitScanResult } from "@romper/shared/db/schema.js";

import { groupSamplesByVoice } from "@romper/shared/kitUtilsShared.js";
import * as fs from "node:fs";
import * as path from "node:path";

import { getAudioMetadata } from "../audioUtils.js";
import {
  toWavMetadataFields,
  type WavMetadataFields,
} from "../db/operations/wavMetadataFields.js";
import {
  mergeKitScan,
  updateBank,
  withDbTransaction,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";

/**
 * Service for scanning operations (kit rescanning and bank scanning)
 * Extracted from dbIpcHandlers.ts to separate business logic from IPC routing
 */
export class ScanService {
  /**
   * Scan a kit folder and merge its WAV files into the database (RE-04).
   *
   * The kit directory must exist. Unreferenced WAV files are added, existing
   * sample rows and their user data are kept, missing files are reported,
   * and locked kits are left alone. See planKitScanMerge for the rules.
   * The database work runs in one transaction.
   */
  rescanKit(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
  ): DbResult<KitScanResult> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbDir = this.getDbPath(localStorePath);

    try {
      const kitPath = path.join(localStorePath, kitName);
      if (!fs.existsSync(kitPath)) {
        return {
          error: `Kit directory not found: ${kitPath}`,
          success: false,
        };
      }

      const wavFiles = fs
        .readdirSync(kitPath)
        .filter((file) => file.toLowerCase().endsWith(".wav"));

      const result = mergeKitScan(
        dbDir,
        kitName,
        { filesByVoice: groupSamplesByVoice(wavFiles), kitPath },
        { fileExists: fs.existsSync, readMetadata: readWavMetadata },
      );
      if (!result.success) {
        return {
          error: `Failed to scan kit ${kitName}: ${result.error}`,
          success: false,
        };
      }
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to scan kit directory: ${errorMessage}`,
        success: false,
      };
    }
  }

  /**
   * Scan local store for bank RTF files and update database
   * Looks for files matching "A - Artist Name.rtf" pattern
   */
  scanBanks(inMemorySettings: Record<string, unknown>): DbResult<{
    scannedAt: Date;
    scannedFiles: number;
    updatedBanks: number;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbDir = this.getDbPath(localStorePath);

    try {
      // Scan local store root for RTF files matching "A - Artist Name.rtf" pattern
      if (!fs.existsSync(localStorePath)) {
        return {
          error: `Local store path not found: ${localStorePath}`,
          success: false,
        };
      }

      const files = fs.readdirSync(localStorePath);
      const rtfFiles = files.filter((file) =>
        /^\p{Lu} - .+\.rtf$/iu.test(file),
      );

      const scannedAt = new Date();
      // One commit for the whole scan; each bank is its own savepoint, so
      // a bank that fails doesn't undo the others
      const scanned = withDbTransaction(dbDir, () => {
        let updated = 0;
        for (const rtfFile of rtfFiles) {
          // Extract bank letter and artist name from filename
          const match = /^(\p{Lu}) - (.+)\.rtf$/iu.exec(rtfFile);
          if (!match) continue;
          // The store's own name files already match the card, so a scan
          // doesn't mark the bank's kits modified (RE-35)
          const updateResult = updateBank(
            dbDir,
            match[1].toUpperCase(),
            {
              artist: match[2],
              rtf_filename: rtfFile,
              scanned_at: scannedAt,
            },
            { source: "scan" },
          );
          if (updateResult.success) updated++;
        }
        return updated;
      });
      if (!scanned.success) {
        return {
          error: `Failed to scan banks: ${scanned.error}`,
          success: false,
        };
      }
      const updatedBanks = scanned.data ?? 0;

      return {
        data: {
          scannedAt,
          scannedFiles: rtfFiles.length,
          updatedBanks,
        },
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to scan banks: ${errorMessage}`,
        success: false,
      };
    }
  }

  private getDbPath(localStorePath: string): string {
    return ServicePathManager.getDbPath(localStorePath);
  }

  private getLocalStorePath(
    inMemorySettings: Record<string, unknown>,
  ): null | string {
    return ServicePathManager.getLocalStorePath(inMemorySettings);
  }
}

/** Read the WAV header fields the samples table stores, or null. */
export function readWavMetadata(filePath: string): null | WavMetadataFields {
  const metadataResult = getAudioMetadata(filePath);
  if (!metadataResult.success || !metadataResult.data) return null;
  return toWavMetadataFields(metadataResult.data);
}

// Export singleton instance
export const scanService = new ScanService();
