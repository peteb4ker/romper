import type { SampleAudio } from "@romper/shared/audioTypes.js";
import type { DbResult } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as fs from "node:fs";

import { getSlotSourcePath } from "../../db/operations/sampleSourceQueries.js";
import { ServicePathManager } from "../../utils/fileSystemUtils.js";

/**
 * Service for sample metadata and audio operations
 * Handles audio buffer retrieval and metadata extraction
 */
export class SampleMetadataService {
  /**
   * The audio file in a kit/voice/slot, or null for an empty slot (#478).
   *
   * Looks up the one slot's row and reads the file without blocking the
   * main process. When the file is still `knownVersion`, which the renderer
   * already holds, it isn't read and `bytes` is null.
   */
  async getSampleAudioBuffer(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    knownVersion?: string,
  ): Promise<DbResult<null | SampleAudio>> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    // Slot numbers are 0-based (0-11), as in the database
    const found = getSlotSourcePath(
      this.getDbPath(localStorePath),
      kitName,
      voiceNumber,
      slotNumber,
    );
    if (!found.success) {
      return {
        error: `Failed to get samples for kit ${kitName}`,
        success: false,
      };
    }
    const sourcePath = found.data;
    // An empty slot
    if (sourcePath == null) return { data: null, success: true };

    try {
      return {
        data: await readSampleAudio(sourcePath, knownVersion),
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

/**
 * Names a file as it is now: its path, size, modification time (ns) and
 * inode. Rewriting the file, or putting another file at its path, changes it.
 */
export function sampleAudioVersion(
  sourcePath: string,
  stats: fs.BigIntStats,
): string {
  return `${stats.size}:${stats.mtimeNs}:${stats.ino}:${sourcePath}`;
}

/**
 * Read a file unless it's still `knownVersion`. The version comes from the
 * open handle, so it describes the bytes read through it.
 */
async function readSampleAudio(
  sourcePath: string,
  knownVersion: string | undefined,
): Promise<SampleAudio> {
  const handle = await fs.promises.open(sourcePath, "r");
  try {
    const version = sampleAudioVersion(
      sourcePath,
      await handle.stat({ bigint: true }),
    );
    if (version === knownVersion) return { bytes: null, version };
    const data = await handle.readFile();
    return {
      bytes: data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ),
      version,
    };
  } finally {
    await handle.close();
  }
}

// Export singleton instance
export const sampleMetadataService = new SampleMetadataService();
