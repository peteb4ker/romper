import type { DbResult, Sample } from "@romper/shared/db/schema.js";

/**
 * Service for sample slot management and boundary validation
 * Handles slot contiguity, gap prevention, and slot boundary validation
 */
export class SampleSlotService {
  /**
   * Find the next available slot in a voice (first gap or after last sample)
   */
  findNextAvailableSlot(
    voiceNumber: number,
    existingSamples: Sample[]
  ): number {
    // Get samples for the target voice
    const voiceSamples = existingSamples
      .filter((s) => s.voice_number === voiceNumber)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Find the next available slot (first gap or after last sample)
    let nextAvailableSlot = 0; // 0-based slot indexing
    for (let i = 0; i < voiceSamples.length; i++) {
      if (voiceSamples[i].slot_number === nextAvailableSlot) {
        nextAvailableSlot++;
      } else {
        // Found a gap, this is the next available slot
        break;
      }
    }

    return nextAvailableSlot;
  }

  /**
   * Get all occupied slots for a voice, sorted by slot number
   */
  getOccupiedSlotsForVoice(
    voiceNumber: number,
    existingSamples: Sample[]
  ): number[] {
    return existingSamples
      .filter((s) => s.voice_number === voiceNumber)
      .map((s) => s.slot_number)
      .sort((a, b) => a - b);
  }

  /**
   * Count samples for a specific voice
   */
  getSampleCountForVoice(
    voiceNumber: number,
    existingSamples: Sample[]
  ): number {
    return existingSamples.filter((s) => s.voice_number === voiceNumber).length;
  }

  /**
   * Count total samples across all voices
   */
  getTotalSampleCount(existingSamples: Sample[]): number {
    return existingSamples.length;
  }

  /**
   * Check for gaps in sample slots for a voice
   */
  hasGapsInVoice(voiceNumber: number, existingSamples: Sample[]): boolean {
    const occupiedSlots = this.getOccupiedSlotsForVoice(
      voiceNumber,
      existingSamples
    );

    if (occupiedSlots.length === 0) {
      return false; // No samples, no gaps
    }

    // Check if slots are contiguous from 0
    for (let i = 0; i < occupiedSlots.length; i++) {
      if (occupiedSlots[i] !== i) {
        return true; // Found a gap
      }
    }

    return false;
  }

  /**
   * Check if a slot is occupied in a specific voice
   */
  isSlotOccupied(
    voiceNumber: number,
    slotNumber: number,
    existingSamples: Sample[]
  ): boolean {
    return existingSamples.some(
      (s) => s.voice_number === voiceNumber && s.slot_number === slotNumber
    );
  }

  /**
   * Validate that a move target doesn't exceed the next available slot boundary
   * Prevents creating gaps in the sample sequence
   */
  validateSlotBoundary(
    toVoice: number,
    toSlot: number, // ZERO-BASED slot number (0-11)
    existingSamples: Sample[]
  ): DbResult<void> {
    // Get samples for the target voice
    const voiceSamples = existingSamples
      .filter((s) => s.voice_number === toVoice)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Find the next available slot (first gap or after last sample)
    let nextAvailableSlot = 0; // 0-based slot indexing
    for (let i = 0; i < voiceSamples.length; i++) {
      if (voiceSamples[i].slot_number === nextAvailableSlot) {
        nextAvailableSlot++;
      } else {
        // Found a gap, this is the next available slot
        break;
      }
    }

    // Allow moves to any slot up to and including the next available slot
    if (toSlot > nextAvailableSlot) {
      return {
        error: `Cannot move to slot ${toSlot + 1}. Next available slot is ${nextAvailableSlot + 1}`,
        success: false,
      };
    }

    return { success: true };
  }
}

// Export singleton instance
export const sampleSlotService = new SampleSlotService();
