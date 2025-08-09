import { useCallback } from "react";
import { toast } from "sonner";

import { useSettings } from "../../../utils/SettingsContext";

export interface StereoAssignmentOptions {
  cancel: boolean;
  forceMono: boolean;
  replaceExisting: boolean;
}

export interface StereoConflictInfo {
  existingSamples: {
    samples: string[];
    voice: number;
  }[];
  nextVoice: number;
  targetVoice: number;
}

export interface StereoHandlingResult {
  assignAsMono: boolean;
  canAssign: boolean;
  conflictInfo?: StereoConflictInfo;
  requiresConfirmation: boolean;
  targetVoice: number;
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
   * Task 7.1.3: Allow per-sample override for mono/stereo
   */
  const analyzeStereoAssignment = useCallback(
    (
      targetVoice: number,
      channels: number,
      allSamples: Array<{ filename: string; voice_number: number }>,
      overrideSetting?: { forceMono?: boolean; forceStereo?: boolean },
    ): StereoHandlingResult => {
      // Task 7.1.3: Check for per-sample override first
      let effectiveDefaultToMono = defaultToMonoSamples;
      if (overrideSetting) {
        if (overrideSetting.forceMono) {
          effectiveDefaultToMono = true;
        } else if (overrideSetting.forceStereo) {
          effectiveDefaultToMono = false;
        }
      }

      // If mono sample or effective setting is ON, always assign as mono
      if (channels === 1 || effectiveDefaultToMono) {
        return {
          assignAsMono: true,
          canAssign: true,
          requiresConfirmation: false,
          targetVoice,
        };
      }

      // Stereo sample with defaultToMonoSamples OFF
      const nextVoice = targetVoice + 1;

      // Task 7.2.4: Handle edge case: stereo to voice 4 (no voice 5 available)
      if (targetVoice === 4) {
        return {
          assignAsMono: false,
          canAssign: false,
          conflictInfo: {
            existingSamples: [],
            nextVoice: 5, // Doesn't exist
            targetVoice,
          },
          requiresConfirmation: true,
          targetVoice,
        };
      }

      // Task 7.2.3: Handle conflicts when target voices have existing samples
      // For stereo: check if voice N has samples AND if voice N+1 has samples (it needs to be empty)
      const targetVoiceSamples = allSamples.filter(
        (s) => s.voice_number === targetVoice,
      );
      const nextVoiceSamples = allSamples.filter(
        (s) => s.voice_number === nextVoice,
      );

      // Conflict if either voice has samples (voice N+1 must be empty for stereo)
      const hasConflicts =
        targetVoiceSamples.length > 0 || nextVoiceSamples.length > 0;

      if (hasConflicts) {
        const conflictInfo: StereoConflictInfo = {
          existingSamples: [
            {
              samples: targetVoiceSamples.map((s) => s.filename),
              voice: targetVoice,
            },
            {
              samples: nextVoiceSamples.map((s) => s.filename),
              voice: nextVoice,
            },
          ].filter((v) => v.samples.length > 0),
          nextVoice,
          targetVoice,
        };

        return {
          assignAsMono: false,
          canAssign: false,
          conflictInfo,
          requiresConfirmation: true,
          targetVoice,
        };
      }

      // No conflicts - can assign stereo across both voices
      return {
        assignAsMono: false,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice,
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
          resolve({ cancel: false, forceMono: true, replaceExisting: false });
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
        resolve({ cancel: false, forceMono: true, replaceExisting: false });
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
        options?: { forceMono?: boolean; forceStereo?: boolean },
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
          await onSampleAdd(result.targetVoice, -1, filePath, {
            forceMono: true,
          }); // -1 means find next available slot
          return true;
        }

        // Task 7.2.2: Stereo assignment: sample goes to voice N, voice N+1 is consumed
        // Only add to the left voice - hardware will automatically use voice N+1 for right channel
        await onSampleAdd(result.targetVoice, -1, filePath, {
          forceStereo: true,
        }); // Sample added to left voice only with stereo flag
        // Voice N+1 is consumed by the stereo pair but no sample entry is created

        toast.success("Stereo assignment", {
          description: `Stereo sample assigned to voices ${result.targetVoice} (left) and ${result.targetVoice + 1} (right).`,
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
    analyzeStereoAssignment,
    applyStereoAssignment,
    defaultToMonoSamples,
    handleStereoConflict,
  };
}
