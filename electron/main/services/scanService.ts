import type {
  DbResult,
  KitScanResult,
  Sample,
} from "@romper/shared/db/schema.js";

import { groupSamplesByVoice } from "@romper/shared/kitUtilsShared.js";
import * as fs from "node:fs";
import * as path from "node:path";

import { getAudioMetadata, getAudioMetadataAsync } from "../audioUtils.js";
import {
  toWavMetadataFields,
  type WavMetadataFields,
} from "../db/operations/wavMetadataFields.js";
import {
  getKitSamples,
  mergeKitScan,
  updateBank,
  updateSampleSourceStatusTx,
  withDbTransaction,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";

/**
 * Service for scanning operations (kit rescanning and bank scanning)
 * Extracted from dbIpcHandlers.ts to separate business logic from IPC routing
 */
export class ScanService {
  /**
   * Check the files of a kit's samples that aren't known to be readable
   * (#537): status unknown (older libraries), or last found missing or
   * unreadable, so a file that's been put back or replaced is seen too.
   * Files are read asynchronously, in one batch, and what's found is
   * recorded in one transaction: missing, unreadable, or readable with its
   * WAV details. Readable samples aren't read again.
   */
  async checkKitSampleFiles(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
  ): Promise<DbResult<{ changed: number; checked: number }>> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }
    const dbDir = this.getDbPath(localStorePath);
    const loaded = getKitSamples(dbDir, kitName);
    if (!loaded.success) return { error: loaded.error, success: false };
    const toCheck = (loaded.data ?? []).filter(
      (sample) => sample.source_status !== "readable",
    );
    if (toCheck.length === 0) {
      return { data: { changed: 0, checked: 0 }, success: true };
    }

    const found = await Promise.all(toCheck.map(checkSampleFile));
    const changes = found.filter(({ fields, sample }) =>
      Object.entries(fields).some(
        ([key, value]) => sample[key as keyof Sample] !== value,
      ),
    );
    if (changes.length > 0) {
      const saved = withDbTransaction(dbDir, (db) => {
        for (const { fields, sample } of changes) {
          updateSampleSourceStatusTx(db, sample.id, fields);
        }
      });
      if (!saved.success) return { error: saved.error, success: false };
    }
    return {
      data: { changed: changes.length, checked: toCheck.length },
      success: true,
    };
  }

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

/** What reading a sample's file finds, as the columns to store (#537) */
async function checkSampleFile(sample: Sample): Promise<{
  fields: Partial<WavMetadataFields>;
  sample: Sample;
}> {
  const exists = await fs.promises
    .access(sample.source_path)
    .then(() => true)
    .catch(() => false);
  if (!exists) return { fields: { source_status: "missing" }, sample };
  const header = await getAudioMetadataAsync(sample.source_path);
  if (!header.success || !header.data) {
    return { fields: { source_status: "unreadable" }, sample };
  }
  return { fields: toWavMetadataFields(header.data), sample };
}

// Export singleton instance
export const scanService = new ScanService();
