// Voice inference scanner - analyzes sample filenames to determine voice types

import { inferVoiceTypeFromFilename } from "@romper/shared/kitUtilsShared";

import type {
  ScanResult,
  VoiceInferenceInput,
  VoiceInferenceOutput,
} from "./types";

/**
 * Scans sample files and infers voice types from filenames
 * @param input Object containing samples grouped by voice number
 * @returns Voice names mapped by voice number
 */
export function scanVoiceInference(
  input: VoiceInferenceInput
): ScanResult<VoiceInferenceOutput> {
  try {
    const { samples } = input;
    const voiceNames: Record<number, string> = {};

    // Process each voice
    for (const [voiceNumber, files] of Object.entries(samples)) {
      const voiceNum = parseInt(voiceNumber, 10);

      if (!files || files.length === 0) {
        continue;
      }

      // Try to infer voice type from the first file in the voice
      const firstFile = files[0];
      const inferredType = inferVoiceTypeFromFilename(firstFile);

      if (inferredType) {
        voiceNames[voiceNum] = inferredType;
      }
    }

    // Check if we found any voice names
    if (Object.keys(voiceNames).length === 0) {
      return {
        error: "No voice types could be inferred from filenames",
        success: false,
      };
    }

    return {
      data: { voiceNames },
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during voice inference",
      success: false,
    };
  }
}
