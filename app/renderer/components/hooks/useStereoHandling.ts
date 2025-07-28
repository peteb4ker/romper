import { useCallback } from "react";
import { toast } from "sonner";

import { useSettings } from "../../utils/SettingsContext";

export interface StereoAssignmentOptions {
  forceMono: boolean;
  replaceExisting: boolean;
  cancel: boolean;
}

export interface StereoConflictInfo {
  targetVoice: number;
  nextVoice: number;
  existingSamples: {
    voice: number;
    samples: string[];
  }[];
}

export interface StereoHandlingResult {
  canAssign: boolean;
  targetVoice: number;
  assignAsMono: boolean;
  conflictInfo?: StereoConflictInfo;
  requiresConfirmation: boolean;
}

/**
 * Hook for stereo sample assignment logic, conflict detection, and settings integration
 * Implements Task 7.0 Stereo Sample Handling requirements
 */
export function useStereoHandling() {
  const { defaultToMonoSamples } = useSettings();

  /**
   * Task 7.2.1: Auto-assign as mono when global setting ON
   * Task 7.2.2: Dual-slot assignment: left→voice N, right→voice N+1 when OFF
   */
  const analyzeStereoAssignment = useCallback(
    (
      targetVoice: number,
      channels: number,
      allSamples: Array<{ voice_number: number; filename: string }>,
    ): StereoHandlingResult => {
      // If mono sample or setting is ON, always assign as mono
      if (channels === 1 || defaultToMonoSamples) {
        return {
          canAssign: true,
          targetVoice,
          assignAsMono: true,
          requiresConfirmation: false,
        };
      }

      // Stereo sample with defaultToMonoSamples OFF
      const nextVoice = targetVoice + 1;

      // Task 7.2.4: Handle edge case: stereo to voice 4 (no voice 5 available)
      if (targetVoice === 4) {
        return {
          canAssign: false,
          targetVoice,
          assignAsMono: false,
          requiresConfirmation: true,
          conflictInfo: {
            targetVoice,
            nextVoice: 5, // Doesn't exist
            existingSamples: [],
          },
        };
      }

      // Task 7.2.3: Handle conflicts when target voices have existing samples
      const targetVoiceSamples = allSamples.filter(
        (s) => s.voice_number === targetVoice,
      );
      const nextVoiceSamples = allSamples.filter(
        (s) => s.voice_number === nextVoice,
      );

      const hasConflicts =
        targetVoiceSamples.length > 0 || nextVoiceSamples.length > 0;

      if (hasConflicts) {
        const conflictInfo: StereoConflictInfo = {
          targetVoice,
          nextVoice,
          existingSamples: [
            {
              voice: targetVoice,
              samples: targetVoiceSamples.map((s) => s.filename),
            },
            {
              voice: nextVoice,
              samples: nextVoiceSamples.map((s) => s.filename),
            },
          ].filter((v) => v.samples.length > 0),
        };

        return {
          canAssign: false,
          targetVoice,
          assignAsMono: false,
          requiresConfirmation: true,
          conflictInfo,
        };
      }

      // No conflicts - can assign stereo across both voices
      return {
        canAssign: true,
        targetVoice,
        assignAsMono: false,
        requiresConfirmation: false,
      };
    },
    [defaultToMonoSamples],
  );

  /**
   * Task 7.3.1: Show dialog with options: force mono, replace existing, cancel
   * This would typically trigger a dialog component - for now we'll use toast
   */
  const handleStereoConflict = useCallback(
    (conflictInfo: StereoConflictInfo): Promise<StereoAssignmentOptions> => {
      return new Promise((resolve) => {
        // In a real implementation, this would show a dialog
        // For now, we'll auto-resolve based on the conflict type

        if (conflictInfo.nextVoice > 4) {
          // Voice 4 edge case - force mono
          toast.warning("Stereo assignment to voice 4", {
            description:
              "Voice 5 doesn't exist. Sample will be assigned as mono to voice 4.",
            duration: 5000,
          });
          resolve({ forceMono: true, replaceExisting: false, cancel: false });
          return;
        }

        // Has existing samples in target voices
        const existingVoices = conflictInfo.existingSamples
          .map((v) => `voice ${v.voice}`)
          .join(" and ");

        toast.warning("Stereo assignment conflict", {
          description: `${existingVoices} already have samples. Sample will be assigned as mono to voice ${conflictInfo.targetVoice}.`,
          duration: 7000,
        });

        // For now, default to mono assignment
        resolve({ forceMono: true, replaceExisting: false, cancel: false });
      });
    },
    [],
  );

  /**
   * Task 7.3.2: Apply choice and update kit with proper voice_number tracking
   */
  const applyStereoAssignment = useCallback(
    async (
      filePath: string,
      result: StereoHandlingResult,
      options: StereoAssignmentOptions,
      onSampleAdd?: (
        voice: number,
        slotIndex: number,
        filePath: string,
      ) => Promise<void>,
    ): Promise<boolean> => {
      if (options.cancel) {
        return false;
      }

      if (!onSampleAdd) {
        console.error("No sample add handler provided");
        return false;
      }

      try {
        if (options.forceMono || result.assignAsMono) {
          // Assign as mono to the target voice
          await onSampleAdd(result.targetVoice, -1, filePath); // -1 means find next available slot
          return true;
        }

        // Assign as stereo (left to target voice, right to next voice)
        // This would require special handling in the backend to split stereo samples
        // For now, we'll assign as mono
        await onSampleAdd(result.targetVoice, -1, filePath);

        toast.info("Stereo assignment", {
          description: `Stereo sample assigned as mono to voice ${result.targetVoice}. Full stereo assignment will be implemented in a future update.`,
          duration: 5000,
        });

        return true;
      } catch (error) {
        console.error("Failed to apply stereo assignment:", error);
        toast.error("Assignment failed", {
          description: "Failed to assign sample. Please try again.",
          duration: 5000,
        });
        return false;
      }
    },
    [],
  );

  return {
    defaultToMonoSamples,
    analyzeStereoAssignment,
    handleStereoConflict,
    applyStereoAssignment,
  };
}
