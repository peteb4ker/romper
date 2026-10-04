import type { Sample, Voice } from "@romper/shared/db/schema";

import { checkStereoLink } from "@romper/shared/stereoLinkRules";
import { useCallback } from "react";

// Voice linking result
export interface VoiceLinkingResult {
  canLink: boolean;
  linkedVoice?: number; // The voice that will be linked
  reason?: string;
}

// Voice operation result (returned by link/unlink operations)
export interface VoiceOperationResult {
  error?: string;
  success: boolean;
}

/**
 * Hook for voice linking and stereo sample handling
 * Implements corrected Rample stereo behavior where stereo voices link adjacent voices
 */
export function useStereoHandling() {
  /**
   * Check if a voice can be linked with the next one for stereo. The rules
   * are checkStereoLink's, which main also applies when it links (#541) and
   * import and scan apply to voices holding stereo files (#537).
   */
  const canLinkVoices = useCallback(
    (
      primaryVoice: number,
      voices: Voice[],
      samples: Sample[],
    ): VoiceLinkingResult => {
      const check = checkStereoLink(primaryVoice, voices, samples);
      if (!check.canLink) {
        return { canLink: false, reason: check.message };
      }

      const linkedVoice = primaryVoice + 1;
      const hasVoice = (n: number) => voices.some((v) => v.voice_number === n);
      if (!hasVoice(primaryVoice) || !hasVoice(linkedVoice)) {
        return {
          canLink: false,
          reason: "Voice data not found",
        };
      }

      return {
        canLink: true,
        linkedVoice,
      };
    },
    [],
  );

  /**
   * Link two voices for stereo operation
   * Returns { success, error? } instead of showing toasts
   */
  const linkVoicesForStereo = useCallback(
    async (
      primaryVoice: number,
      voices: Voice[],
      samples: Sample[],
      onVoiceUpdate?: (
        voiceNumber: number,
        updates: Partial<Voice>,
      ) => Promise<void>,
    ): Promise<VoiceOperationResult> => {
      const linkingResult = canLinkVoices(primaryVoice, voices, samples);

      if (!linkingResult.canLink) {
        return { error: linkingResult.reason, success: false };
      }

      try {
        // Set primary voice to stereo mode
        if (onVoiceUpdate) {
          await onVoiceUpdate(primaryVoice, { stereo_mode: true });
        }

        return { success: true };
      } catch (error) {
        console.error("Failed to link voices for stereo:", error);
        return {
          error: "Failed to link voices. Please try again.",
          success: false,
        };
      }
    },
    [canLinkVoices],
  );

  /**
   * Unlink voices (convert stereo voice back to mono)
   * Only clears the voice's stereo_mode: the voice's stereo files stay, and
   * the next write to the card mixes them down to mono (RE-29, RE-69).
   * Returns { success, error? } instead of showing toasts
   */
  const unlinkVoices = useCallback(
    async (
      primaryVoice: number,
      voices: Voice[],
      onVoiceUpdate?: (
        voiceNumber: number,
        updates: Partial<Voice>,
      ) => Promise<void>,
    ): Promise<VoiceOperationResult> => {
      const voiceData = voices.find((v) => v.voice_number === primaryVoice);

      if (!voiceData?.stereo_mode) {
        return {
          error: `Voice ${primaryVoice} is not in stereo mode`,
          success: false,
        };
      }

      try {
        // Set voice back to mono mode
        if (onVoiceUpdate) {
          await onVoiceUpdate(primaryVoice, { stereo_mode: false });
        }

        return { success: true };
      } catch (error) {
        console.error("Failed to unlink voices:", error);
        return {
          error: "Failed to unlink voices. Please try again.",
          success: false,
        };
      }
    },
    [],
  );

  /**
   * Get voice linking status for UI display
   */
  const getVoiceLinkingStatus = useCallback(
    (
      voiceNumber: number,
      voices: Voice[],
    ): { isLinked: boolean; isPrimary: boolean; linkedWith?: number } => {
      const voiceData = voices.find((v) => v.voice_number === voiceNumber);

      if (voiceData?.stereo_mode) {
        return {
          isLinked: true,
          isPrimary: true,
          linkedWith: voiceNumber + 1,
        };
      }

      // Check if this voice is linked to the previous voice
      if (voiceNumber > 1) {
        const previousVoice = voices.find(
          (v) => v.voice_number === voiceNumber - 1,
        );
        if (previousVoice?.stereo_mode) {
          return {
            isLinked: true,
            isPrimary: false,
            linkedWith: voiceNumber - 1,
          };
        }
      }

      return { isLinked: false, isPrimary: false };
    },
    [],
  );

  return {
    canLinkVoices,
    getVoiceLinkingStatus,
    linkVoicesForStereo,
    unlinkVoices,
  };
}
