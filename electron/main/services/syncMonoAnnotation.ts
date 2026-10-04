import type { SyncPlanData } from "../db/operations/kitSyncOperations.js";
import type { SyncFileOperation } from "./syncFileOperations.js";

type VoiceStereoModes = SyncPlanData["voices"];

/**
 * Mark files for mono conversion: a file with more than one channel on a
 * voice that isn't linked as stereo is mixed down to mono when it's written
 * (RE-29, #537 rule 1). Stereo is a voice setting (`voices.stereo_mode`,
 * with the links the write makes automatically); the file's own channel
 * count only says whether there is anything to mix. The voices come from
 * the plan's one load, not a query per kit (RE-82).
 */
export function annotateMonoConversion(
  allFiles: SyncFileOperation[],
  voices: VoiceStereoModes,
): void {
  const stereoModes = buildVoiceStereoModeCache(voices);

  for (const fileOp of allFiles) {
    const voiceStereoMode = stereoModes.get(
      voiceKey(fileOp.kitName, fileOp.voiceNumber),
    );

    if (voiceStereoMode === false && (fileOp.channels ?? 1) > 1) {
      fileOp.forceMonoConversion = true;
      if (fileOp.operation === "copy") {
        fileOp.operation = "convert";
        // DRAFT wording (#537), awaiting Pete's sign-off
        fileOp.reason = `Stereo sample on voice ${fileOp.voiceNumber}, a mono voice: mixed down to mono`;
      }
    }
  }
}

/** Each voice's stereo_mode, keyed by kit and voice number */
export function buildVoiceStereoModeCache(
  voices: VoiceStereoModes,
): Map<string, boolean> {
  return new Map(
    voices.map((voice) => [
      voiceKey(voice.kit_name, voice.voice_number),
      voice.stereo_mode,
    ]),
  );
}

function voiceKey(kitName: string, voiceNumber: number): string {
  return `${kitName}:${voiceNumber}`;
}
