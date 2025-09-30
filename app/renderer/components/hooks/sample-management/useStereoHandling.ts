import type { Sample, Voice } from "@romper/shared/db/schema";

import { useCallback } from "react";
import { toast } from "sonner";

import { ErrorPatterns } from "../../../utils/errorHandling";

// Sample assignment result
export interface SampleAssignmentResult {
  assignAsMono: boolean;
  canAssign: boolean;
  requiresWarning: boolean;
  targetVoice: number;
  warningMessage?: string;
}

// Voice linking result
export interface VoiceLinkingResult {
  canLink: boolean;
  linkedVoice?: number; // The voice that will be linked
  reason?: string;
}

// Voice validation result
export interface VoiceValidation {
  canAccept: boolean;
  reason?: string;
  requiresConversion?: "mono" | "stereo";
  voiceMode: "linked" | "mono" | "stereo";
}

/**
 * Hook for voice linking and stereo sample handling
 * Implements corrected Rample stereo behavior where stereo voices link adjacent voices
 */
export function useStereoHandling() {
  /**
   * Check if two voices can be linked for stereo operation
   * Voice linking rules: 1→2, 2→3, 3→4 (voice 4 cannot be primary stereo voice)
   */
  const canLinkVoices = useCallback(
    (
      primaryVoice: number,
      voices: Voice[],
      samples: Sample[],
    ): VoiceLinkingResult => {
      // Voice 4 cannot be primary stereo voice (no voice 5 to link to)
      if (primaryVoice === 4) {
        return {
          canLink: false,
          reason: "Voice 4 cannot be linked - no voice 5 available",
        };
      }

      const linkedVoice = primaryVoice + 1;
      const primaryVoiceData = voices.find(
        (v) => v.voice_number === primaryVoice,
      );
      const linkedVoiceData = voices.find(
        (v) => v.voice_number === linkedVoice,
      );

      if (!primaryVoiceData || !linkedVoiceData) {
        return {
          canLink: false,
          reason: "Voice data not found",
        };
      }

      // Check if primary voice already in stereo mode
      if (primaryVoiceData.stereo_mode) {
        return {
          canLink: false,
          reason: `Voice ${primaryVoice} is already in stereo mode`,
        };
      }

      // Check if linked voice is already linked to another voice
      const linkedVoiceHasStereoSamples = samples.some(
        (s) => s.voice_number === linkedVoice && s.is_stereo,
      );

      if (linkedVoiceData.stereo_mode || linkedVoiceHasStereoSamples) {
        return {
          canLink: false,
          reason: `Voice ${linkedVoice} is already linked or has stereo samples`,
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
   * Check if voice can accept a sample (mono/stereo compatibility)
   */
  const validateVoiceAssignment = useCallback(
    (
      targetVoice: number,
      sampleChannels: number,
      voices: Voice[],
      samples: Sample[],
    ): VoiceValidation => {
      const voiceData = voices.find((v) => v.voice_number === targetVoice);

      if (!voiceData) {
        return {
          canAccept: false,
          reason: "Voice not found",
          voiceMode: "mono",
        };
      }

      // Get existing samples in this voice
      const voiceSamples = samples.filter(
        (s) => s.voice_number === targetVoice,
      );
      const hasExistingSamples = voiceSamples.length > 0;

      // Determine if this voice is linked (secondary voice in a stereo pair)
      const isPreviousVoiceStereo =
        targetVoice > 1 &&
        voices.find((v) => v.voice_number === targetVoice - 1)?.stereo_mode;

      if (isPreviousVoiceStereo) {
        return {
          canAccept: false,
          reason: `Voice ${targetVoice} is linked to stereo voice ${targetVoice - 1}`,
          voiceMode: "linked",
        };
      }

      // If voice is in stereo mode
      if (voiceData.stereo_mode) {
        if (sampleChannels === 1) {
          return {
            canAccept: false,
            reason: "Voice is in stereo mode - all samples must be stereo",
            requiresConversion: "stereo",
            voiceMode: "stereo",
          };
        }
        return {
          canAccept: true,
          voiceMode: "stereo",
        };
      }

      // Voice is in mono mode
      if (sampleChannels === 2) {
        // Stereo sample to mono voice
        if (hasExistingSamples && voiceSamples.some((s) => !s.is_stereo)) {
          return {
            canAccept: false,
            reason: "Cannot mix mono and stereo samples in same voice",
            requiresConversion: "mono",
            voiceMode: "mono",
          };
        }

        // Check if we can link this voice for stereo
        const linkingResult = canLinkVoices(targetVoice, voices, samples);
        if (!linkingResult.canLink) {
          return {
            canAccept: true, // Accept but convert to mono
            reason: linkingResult.reason,
            requiresConversion: "mono",
            voiceMode: "mono",
          };
        }

        return {
          canAccept: true,
          voiceMode: "mono", // Will be converted to stereo if user confirms
        };
      }

      // Mono sample to mono voice - always OK
      return {
        canAccept: true,
        voiceMode: "mono",
      };
    },
    [canLinkVoices],
  );

  /**
   * Analyze sample assignment and determine handling strategy
   */
  const analyzeSampleAssignment = useCallback(
    (
      targetVoice: number,
      sampleChannels: number,
      voices: Voice[],
      samples: Sample[],
      userLinkedVoices: boolean = false, // User manually linked voices
    ): SampleAssignmentResult => {
      const validation = validateVoiceAssignment(
        targetVoice,
        sampleChannels,
        voices,
        samples,
      );

      if (!validation.canAccept) {
        return {
          assignAsMono: false,
          canAssign: false,
          requiresWarning: true,
          targetVoice,
          warningMessage: validation.reason,
        };
      }

      // Handle mono sample assignment
      if (sampleChannels === 1) {
        return {
          assignAsMono: true,
          canAssign: true,
          requiresWarning: false,
          targetVoice,
        };
      }

      // Handle stereo sample assignment
      const voiceData = voices.find((v) => v.voice_number === targetVoice);

      // If voice is already in stereo mode or user has linked voices
      if (voiceData?.stereo_mode || userLinkedVoices) {
        return {
          assignAsMono: false,
          canAssign: true,
          requiresWarning: false,
          targetVoice,
        };
      }

      // Stereo sample to non-linked voice - check if linking is possible
      const linkingResult = canLinkVoices(targetVoice, voices, samples);

      if (linkingResult.canLink) {
        return {
          assignAsMono: false,
          canAssign: true,
          requiresWarning: true,
          targetVoice,
          warningMessage: `Stereo sample will link voices ${targetVoice} and ${targetVoice + 1}`,
        };
      }

      // Cannot link - convert to mono
      return {
        assignAsMono: true,
        canAssign: true,
        requiresWarning: true,
        targetVoice,
        warningMessage: `Stereo sample added to mono voice - will be converted to mono on sync`,
      };
    },
    [validateVoiceAssignment, canLinkVoices],
  );

  /**
   * Link two voices for stereo operation
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
    ): Promise<boolean> => {
      const linkingResult = canLinkVoices(primaryVoice, voices, samples);

      if (!linkingResult.canLink) {
        toast.error("Voice linking failed", {
          description: linkingResult.reason,
          duration: 5000,
        });
        return false;
      }

      try {
        // Set primary voice to stereo mode
        if (onVoiceUpdate) {
          await onVoiceUpdate(primaryVoice, { stereo_mode: true });
        }

        toast.success("Voices linked", {
          description: `Voice ${primaryVoice} and ${linkingResult.linkedVoice} are now linked for stereo`,
          duration: 5000,
        });

        return true;
      } catch (error) {
        ErrorPatterns.sampleOperation(error, "link voices for stereo");
        toast.error("Voice linking failed", {
          description: "Failed to link voices. Please try again.",
          duration: 5000,
        });
        return false;
      }
    },
    [canLinkVoices],
  );

  /**
   * Unlink voices (convert stereo voice back to mono)
   */
  const unlinkVoices = useCallback(
    async (
      primaryVoice: number,
      voices: Voice[],
      samples: Sample[],
      onVoiceUpdate?: (
        voiceNumber: number,
        updates: Partial<Voice>,
      ) => Promise<void>,
    ): Promise<boolean> => {
      const voiceData = voices.find((v) => v.voice_number === primaryVoice);

      if (!voiceData?.stereo_mode) {
        toast.warning("Voice not linked", {
          description: `Voice ${primaryVoice} is not in stereo mode`,
          duration: 5000,
        });
        return false;
      }

      // Check if voice has stereo samples
      const stereoSamples = samples.filter(
        (s) => s.voice_number === primaryVoice && s.is_stereo,
      );

      if (stereoSamples.length > 0) {
        toast.warning("Cannot unlink voice with stereo samples", {
          description: `Remove stereo samples from voice ${primaryVoice} first, or convert them to mono`,
          duration: 7000,
        });
        return false;
      }

      try {
        // Set voice back to mono mode
        if (onVoiceUpdate) {
          await onVoiceUpdate(primaryVoice, { stereo_mode: false });
        }

        toast.success("Voices unlinked", {
          description: `Voice ${primaryVoice} converted back to mono mode`,
          duration: 5000,
        });

        return true;
      } catch (error) {
        ErrorPatterns.sampleOperation(error, "unlink voices");
        toast.error("Voice unlinking failed", {
          description: "Failed to unlink voices. Please try again.",
          duration: 5000,
        });
        return false;
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
    analyzeSampleAssignment,
    // Voice linking functions
    canLinkVoices,
    getVoiceLinkingStatus,
    linkVoicesForStereo,
    unlinkVoices,
    // Sample assignment functions
    validateVoiceAssignment,
  };
}
