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
  updateSampleSourceStatusTx,
  withDbTransaction,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";

/**
 * Service for scanning operations (kit rescanning and file checks).
 * Extracted from dbIpcHandlers.ts to separate business logic from IPC
 * routing. Bank names aren't scanned: `banks.artist` owns them, and the
 * store's bank name files are only written from it (#567).
 */
export class ScanService {
  /**
   * Check a kit's sample files when it opens (#537), in one batch:
   * - every file is checked to still exist (an async stat), so a file
   *   deleted since it was last read shows as missing straight away;
   * - a file not known to be readable (status unknown, as in older
   *   libraries, or last found missing or unreadable) has its header read
   *   too, so a file that's been put back or replaced is seen.
   * A known-readable file that still exists isn't read again. What's
   * found is recorded in one transaction: missing, unreadable, or readable
   * with its WAV details.
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
    const toCheck = loaded.data ?? [];
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

/**
 * What checking a sample's file finds, as the columns to store (#537).
 * A known-readable file only needs to still exist; others are read.
 */
async function checkSampleFile(sample: Sample): Promise<{
  fields: Partial<WavMetadataFields>;
  sample: Sample;
}> {
  const exists = await fs.promises
    .access(sample.source_path)
    .then(() => true)
    .catch(() => false);
  if (!exists) return { fields: { source_status: "missing" }, sample };
  if (sample.source_status === "readable") return { fields: {}, sample };
  const header = await getAudioMetadataAsync(sample.source_path);
  if (!header.success || !header.data) {
    return { fields: { source_status: "unreadable" }, sample };
  }
  return { fields: toWavMetadataFields(header.data), sample };
}

// Export singleton instance
export const scanService = new ScanService();
