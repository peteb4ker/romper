import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, it } from "vitest";

import { SampleSlotService } from "../sampleSlotService.js";

/**
 * Integration tests for SampleSlotService
 *
 * These tests exercise multi-method workflows and complex scenarios
 * that go beyond single-method unit tests. They verify slot allocation,
 * boundary validation, gap detection, and cross-voice operations work
 * together correctly.
 */

const createSample = (
  voiceNumber: number,
  slotNumber: number,
  overrides: Partial<Sample> = {},
): Sample => ({
  filename: `sample_v${voiceNumber}_s${slotNumber}.wav`,
  gain_db: 0,
  id: voiceNumber * 100 + slotNumber,
  is_stereo: false,
  kit_name: "TestKit",
  slot_number: slotNumber,
  source_path: `/path/to/sample_v${voiceNumber}_s${slotNumber}.wav`,
  voice_number: voiceNumber,
  wav_bit_depth: null,
  wav_bitrate: null,
  wav_channels: null,
  wav_sample_rate: null,
  ...overrides,
});

describe("SampleSlotService Integration Tests", () => {
  let service: SampleSlotService;

  beforeEach(() => {
    service = new SampleSlotService();
  });

  describe("slot allocation workflow", () => {
    it("should allocate slots sequentially for an empty voice", () => {
      const samples: Sample[] = [];

      // First allocation should be slot 0
      const slot0 = service.findNextAvailableSlot(1, samples);
      expect(slot0).toBe(0);

      // Simulate adding the sample
      samples.push(createSample(1, slot0));

      // Next allocation should be slot 1
      const slot1 = service.findNextAvailableSlot(1, samples);
      expect(slot1).toBe(1);

      samples.push(createSample(1, slot1));

      // Next should be slot 2
      const slot2 = service.findNextAvailableSlot(1, samples);
      expect(slot2).toBe(2);
    });

    it("should fill gaps before extending", () => {
      // Create samples with a gap at slot 1
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 2),
        createSample(1, 3),
      ];

      // Should find the gap at slot 1
      const nextSlot = service.findNextAvailableSlot(1, samples);
      expect(nextSlot).toBe(1);

      // Verify there's a gap
      expect(service.hasGapsInVoice(1, samples)).toBe(true);

      // Fill the gap
      samples.push(createSample(1, 1));

      // Now should allocate after the last contiguous slot
      const afterFill = service.findNextAvailableSlot(1, samples);
      expect(afterFill).toBe(4);

      // No more gaps
      expect(service.hasGapsInVoice(1, samples)).toBe(false);
    });

    it("should allocate slots independently per voice", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(1, 2),
        createSample(2, 0),
      ];

      // Voice 1 should allocate at slot 3
      expect(service.findNextAvailableSlot(1, samples)).toBe(3);

      // Voice 2 should allocate at slot 1
      expect(service.findNextAvailableSlot(2, samples)).toBe(1);

      // Voice 3 (empty) should allocate at slot 0
      expect(service.findNextAvailableSlot(3, samples)).toBe(0);
    });
  });

  describe("slot boundary validation workflow", () => {
    it("should allow moves up to the next available slot boundary", () => {
      const samples: Sample[] = [createSample(1, 0), createSample(1, 1)];

      // Move to occupied slot 0 - allowed (swap)
      expect(service.validateSlotBoundary(1, 0, samples).success).toBe(true);

      // Move to occupied slot 1 - allowed (swap)
      expect(service.validateSlotBoundary(1, 1, samples).success).toBe(true);

      // Move to next available slot 2 - allowed
      expect(service.validateSlotBoundary(1, 2, samples).success).toBe(true);

      // Move to slot 3 - NOT allowed (would create a gap)
      const result = service.validateSlotBoundary(1, 3, samples);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot move to slot 4");
      expect(result.error).toContain("Next available slot is 3");
    });

    it("should validate boundary considering gaps", () => {
      // Samples with gap at slot 1
      const samples: Sample[] = [createSample(1, 0), createSample(1, 2)];

      // Move to slot 0 (occupied) - allowed
      expect(service.validateSlotBoundary(1, 0, samples).success).toBe(true);

      // Move to slot 1 (the gap) - allowed
      expect(service.validateSlotBoundary(1, 1, samples).success).toBe(true);

      // Move to slot 2 - NOT allowed (beyond the gap at 1)
      const result = service.validateSlotBoundary(1, 2, samples);
      expect(result.success).toBe(false);
    });

    it("should allow slot 0 for any empty voice", () => {
      const samples: Sample[] = [];

      for (let voice = 1; voice <= 4; voice++) {
        const result = service.validateSlotBoundary(voice, 0, samples);
        expect(result.success).toBe(true);
      }
    });

    it("should reject slot 1 for an empty voice", () => {
      const samples: Sample[] = [];

      const result = service.validateSlotBoundary(1, 1, samples);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot move to slot 2");
      expect(result.error).toContain("Next available slot is 1");
    });

    it("should validate independently per voice", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(1, 2), // Voice 1 has 3 samples
        createSample(2, 0), // Voice 2 has 1 sample
      ];

      // Voice 1: can move to slot 3
      expect(service.validateSlotBoundary(1, 3, samples).success).toBe(true);

      // Voice 2: cannot move to slot 2 (only slot 1 is next available)
      expect(service.validateSlotBoundary(2, 2, samples).success).toBe(false);

      // Voice 2: can move to slot 1
      expect(service.validateSlotBoundary(2, 1, samples).success).toBe(true);
    });
  });

  describe("gap detection and occupied slots", () => {
    it("should accurately track gaps across all slot positions", () => {
      // Create a voice with samples at non-contiguous positions
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 3),
        createSample(1, 5),
        createSample(1, 7),
      ];

      expect(service.hasGapsInVoice(1, samples)).toBe(true);

      const occupied = service.getOccupiedSlotsForVoice(1, samples);
      expect(occupied).toEqual([0, 3, 5, 7]);

      // The next available slot should be the first gap
      expect(service.findNextAvailableSlot(1, samples)).toBe(1);
    });

    it("should report no gaps for perfectly contiguous slots starting from 0", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(1, 2),
        createSample(1, 3),
      ];

      expect(service.hasGapsInVoice(1, samples)).toBe(false);
      expect(service.getOccupiedSlotsForVoice(1, samples)).toEqual([
        0, 1, 2, 3,
      ]);
    });

    it("should detect gap when slot 0 is missing", () => {
      const samples: Sample[] = [createSample(1, 1), createSample(1, 2)];

      expect(service.hasGapsInVoice(1, samples)).toBe(true);
      expect(service.findNextAvailableSlot(1, samples)).toBe(0);
    });

    it("should not confuse slots across different voices", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(2, 0),
        createSample(2, 2), // Gap in voice 2
        createSample(3, 5), // Gap in voice 3
      ];

      expect(service.hasGapsInVoice(1, samples)).toBe(false);
      expect(service.hasGapsInVoice(2, samples)).toBe(true);
      expect(service.hasGapsInVoice(3, samples)).toBe(true);
      expect(service.hasGapsInVoice(4, samples)).toBe(false); // Empty
    });
  });

  describe("isSlotOccupied integration", () => {
    it("should correctly identify occupied and empty slots across voices", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(2, 0),
        createSample(3, 3),
      ];

      // Voice 1
      expect(service.isSlotOccupied(1, 0, samples)).toBe(true);
      expect(service.isSlotOccupied(1, 1, samples)).toBe(true);
      expect(service.isSlotOccupied(1, 2, samples)).toBe(false);

      // Voice 2
      expect(service.isSlotOccupied(2, 0, samples)).toBe(true);
      expect(service.isSlotOccupied(2, 1, samples)).toBe(false);

      // Voice 3
      expect(service.isSlotOccupied(3, 0, samples)).toBe(false);
      expect(service.isSlotOccupied(3, 3, samples)).toBe(true);

      // Voice 4 (empty)
      expect(service.isSlotOccupied(4, 0, samples)).toBe(false);
    });

    it("should be consistent with getOccupiedSlotsForVoice", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 2),
        createSample(1, 5),
      ];

      const occupiedSlots = service.getOccupiedSlotsForVoice(1, samples);

      // Check all slots 0-11
      for (let slot = 0; slot < 12; slot++) {
        const isOccupied = service.isSlotOccupied(1, slot, samples);
        const expectedOccupied = occupiedSlots.includes(slot);
        expect(isOccupied).toBe(expectedOccupied);
      }
    });
  });

  describe("sample counting", () => {
    it("should count samples per voice correctly", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(1, 2),
        createSample(2, 0),
        createSample(2, 1),
        createSample(3, 0),
      ];

      expect(service.getSampleCountForVoice(1, samples)).toBe(3);
      expect(service.getSampleCountForVoice(2, samples)).toBe(2);
      expect(service.getSampleCountForVoice(3, samples)).toBe(1);
      expect(service.getSampleCountForVoice(4, samples)).toBe(0);
    });

    it("should count total samples across all voices", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(2, 0),
        createSample(3, 0),
        createSample(4, 0),
      ];

      expect(service.getTotalSampleCount(samples)).toBe(5);
    });

    it("should be consistent: total equals sum of per-voice counts", () => {
      const samples: Sample[] = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(2, 0),
        createSample(2, 1),
        createSample(2, 2),
        createSample(3, 0),
      ];

      const total = service.getTotalSampleCount(samples);
      const sumByVoice =
        service.getSampleCountForVoice(1, samples) +
        service.getSampleCountForVoice(2, samples) +
        service.getSampleCountForVoice(3, samples) +
        service.getSampleCountForVoice(4, samples);

      expect(total).toBe(sumByVoice);
    });
  });

  describe("full slot capacity scenario", () => {
    it("should handle a voice with all 12 slots filled", () => {
      const samples: Sample[] = [];
      for (let slot = 0; slot < 12; slot++) {
        samples.push(createSample(1, slot));
      }

      expect(service.getSampleCountForVoice(1, samples)).toBe(12);
      expect(service.hasGapsInVoice(1, samples)).toBe(false);
      expect(service.findNextAvailableSlot(1, samples)).toBe(12);
      expect(service.getOccupiedSlotsForVoice(1, samples)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      ]);

      // Slot boundary validation: slot 12 is next available
      expect(service.validateSlotBoundary(1, 12, samples).success).toBe(true);
      expect(service.validateSlotBoundary(1, 13, samples).success).toBe(false);
    });

    it("should handle all 4 voices fully populated", () => {
      const samples: Sample[] = [];
      for (let voice = 1; voice <= 4; voice++) {
        for (let slot = 0; slot < 12; slot++) {
          samples.push(createSample(voice, slot));
        }
      }

      expect(service.getTotalSampleCount(samples)).toBe(48);

      for (let voice = 1; voice <= 4; voice++) {
        expect(service.getSampleCountForVoice(voice, samples)).toBe(12);
        expect(service.hasGapsInVoice(voice, samples)).toBe(false);
      }
    });
  });

  describe("slot allocation and boundary validation consistency", () => {
    it("findNextAvailableSlot result should always pass validateSlotBoundary", () => {
      // Test with various sample configurations
      const configs: Sample[][] = [
        [], // Empty
        [createSample(1, 0)], // Single sample
        [createSample(1, 0), createSample(1, 1)], // Two contiguous
        [createSample(1, 0), createSample(1, 2)], // Gap at 1
        [createSample(1, 1)], // Gap at 0
      ];

      for (const samples of configs) {
        const nextSlot = service.findNextAvailableSlot(1, samples);
        const validation = service.validateSlotBoundary(1, nextSlot, samples);
        expect(validation.success).toBe(true);
      }
    });

    it("slot one past findNextAvailableSlot should always fail validateSlotBoundary", () => {
      const configs: Sample[][] = [
        [], // Empty - next available is 0, so slot 1 should fail
        [createSample(1, 0)], // Next available is 1, so slot 2 should fail
        [createSample(1, 0), createSample(1, 1)], // Next is 2, so 3 fails
      ];

      for (const samples of configs) {
        const nextSlot = service.findNextAvailableSlot(1, samples);
        const validation = service.validateSlotBoundary(
          1,
          nextSlot + 1,
          samples,
        );
        expect(validation.success).toBe(false);
      }
    });
  });
});
