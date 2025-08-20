import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as fs from "fs";

import { getKitSamples } from "../../db/romperDbCoreORM.js";
import { ServicePathManager } from "../../utils/fileSystemUtils.js";

/**
 * Service for sample metadata and audio operations
 * Handles audio buffer retrieval and metadata extraction
 */
export class SampleMetadataService {
  /**
   * Get audio buffer for a specific sample by kit/voice/slot identifier
   */
  getSampleAudioBuffer(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): DbResult<ArrayBuffer | null> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    try {
      // Get sample from database
      const samplesResult = getKitSamples(dbPath, kitName);

      if (!samplesResult.success || !samplesResult.data) {
        return {
          error: `Failed to get samples for kit ${kitName}`,
          success: false,
        };
      }

      // Find the specific sample - slotNumber is 0-based index
      // Database uses 0-11 slot indexing
      const sample = samplesResult.data.find(
        (s: Sample) =>
          s.voice_number === voiceNumber && s.slot_number === slotNumber,
      );

      if (!sample) {
        // Return null for missing samples (empty slots)
        return { data: null, success: true };
      }

      // Read the file using the database-stored source_path
      const data = fs.readFileSync(sample.source_path);
      return {
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ),
        success: true,
      };
    } catch (error) {
      return {
        error: `Failed to read sample audio: ${getErrorMessage(error)}`,
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

// Export singleton instance
export const sampleMetadataService = new SampleMetadataService();
