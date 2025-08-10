import { dbSlotToDisplaySlot } from "@romper/shared/slotUtils";

import type { VoiceSamples } from "../components/kitTypes";

/**
 * Convert database sample objects to VoiceSamples format
 * Groups samples by voice number and handles stereo samples
 */
export function groupDbSamplesByVoice(dbSamples: any[]): VoiceSamples {
  const voices: VoiceSamples = { 1: [], 2: [], 3: [], 4: [] };

  // First, sort samples by voice_number and slot_number to ensure proper ordering
  const sortedSamples = [...dbSamples].sort((a, b) => {
    if (a.voice_number !== b.voice_number) {
      return a.voice_number - b.voice_number;
    }
    return a.slot_number - b.slot_number;
  });

  // Group samples by voice, maintaining slot order
  sortedSamples.forEach((sample: any) => {
    const voiceNumber = sample.voice_number;
    if (voiceNumber >= 1 && voiceNumber <= 4) {
      // Create array with proper slot positions (12 slots per voice)
      if (!Array.isArray(voices[voiceNumber])) {
        voices[voiceNumber] = [];
      }
      // Convert database slot number to display slot, then to 0-based index
      let slotIndex: number;
      try {
        slotIndex = dbSlotToDisplaySlot(sample.slot_number) - 1;
      } catch {
        // Skip samples with invalid slot numbers
        return;
      }
      if (slotIndex >= 0 && slotIndex < 12) {
        voices[voiceNumber][slotIndex] = sample.filename;

        // Task 7: If this is a stereo sample, also show it in the next voice
        // This indicates that the next voice slot is consumed by the stereo pair
        if (sample.is_stereo && voiceNumber < 4) {
          const nextVoice = voiceNumber + 1;
          if (!Array.isArray(voices[nextVoice])) {
            voices[nextVoice] = [];
          }
          // Show the same filename in the next voice to indicate it's consumed
          voices[nextVoice][slotIndex] = sample.filename;
        }
      }
    }
  });

  // Fill empty slots with empty strings for consistent array length
  Object.keys(voices).forEach((v) => {
    const voice = voices[+v];
    for (let i = 0; i < 12; i++) {
      if (!voice[i]) {
        voice[i] = "";
      }
    }
    // Remove trailing empty slots
    while (voice.length > 0 && voice[voice.length - 1] === "") {
      voice.pop();
    }
  });

  return voices;
}
