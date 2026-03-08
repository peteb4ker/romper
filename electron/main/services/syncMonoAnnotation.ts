import type { SyncFileOperation } from "./syncFileOperations.js";

import { getKit } from "../db/romperDbCoreORM.js";

/**
 * Annotate file operations with per-file forceMonoConversion based on voice stereo_mode.
 * Stereo samples on mono voices get forceMonoConversion=true; stereo voices pass through.
 */
export function annotateMonoConversion(
  allFiles: SyncFileOperation[],
  dbDir: string,
): void {
  const cache = buildVoiceStereoModeCache(allFiles, dbDir);

  for (const fileOp of allFiles) {
    const voiceNumber = extractVoiceNumber(fileOp.destinationPath);
    if (voiceNumber === undefined) {
      continue;
    }

    const voiceStereoMode = cache.get(`${fileOp.kitName}:${voiceNumber}`);

    if (voiceStereoMode === false && fileOp.isStereo) {
      fileOp.forceMonoConversion = true;
      if (fileOp.operation === "copy") {
        fileOp.operation = "convert";
        fileOp.reason = "Stereo sample on mono voice requires mono conversion";
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

/**
 * Extract voice number from a sync destination path (e.g., .../kitName/1/filename.wav).
 */
export function extractVoiceNumber(
  destinationPath: string,
): number | undefined {
  const pathParts = destinationPath.split("/");
  const voiceNumberStr = pathParts.at(-2) ?? "";
  const voiceNumber = Number.parseInt(voiceNumberStr, 10);
  return Number.isNaN(voiceNumber) ? undefined : voiceNumber;
}
