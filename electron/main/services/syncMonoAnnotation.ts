import type { SyncFileOperation } from "./syncFileOperations.js";

import { getKit } from "../db/romperDbCoreORM.js";

/**
 * Mark files for mono conversion: a file with more than one channel on a
 * voice that isn't linked as stereo is mixed down to mono when it's written
 * (RE-29). Stereo is a voice setting (`voices.stereo_mode`); the file's own
 * channel count only says whether there is anything to mix.
 */
export function annotateMonoConversion(
  allFiles: SyncFileOperation[],
  dbDir: string,
): void {
  const cache = buildVoiceStereoModeCache(allFiles, dbDir);

  for (const fileOp of allFiles) {
    const voiceStereoMode = cache.get(
      `${fileOp.kitName}:${fileOp.voiceNumber}`,
    );

    if (voiceStereoMode === false && (fileOp.channels ?? 1) > 1) {
      fileOp.forceMonoConversion = true;
      if (fileOp.operation === "copy") {
        fileOp.operation = "convert";
        fileOp.reason = `Stereo file on voice ${fileOp.voiceNumber}, which isn't linked as stereo: mixed to mono`;
      }
    }
  }
}

/**
 * Build a cache of voice stereo_mode from the database for all kits referenced in file operations.
 */
export function buildVoiceStereoModeCache(
  allFiles: SyncFileOperation[],
  dbDir: string,
): Map<string, boolean> {
  const cache = new Map<string, boolean>();

  for (const fileOp of allFiles) {
    if (cache.has(fileOp.kitName + ":loaded")) {
      continue;
    }
    try {
      const kitResult = getKit(dbDir, fileOp.kitName);
      if (kitResult.success && kitResult.data?.voices) {
        for (const voice of kitResult.data.voices) {
          cache.set(
            `${fileOp.kitName}:${voice.voice_number}`,
            voice.stereo_mode,
          );
        }
      }
    } catch {
      // If kit lookup fails, skip annotation for this kit
    }
    cache.set(fileOp.kitName + ":loaded", true);
  }

  return cache;
}
