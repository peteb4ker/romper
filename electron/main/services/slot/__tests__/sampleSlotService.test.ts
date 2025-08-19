import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, it } from "vitest";

import { SampleSlotService } from "../sampleSlotService";

describe("SampleSlotService", () => {
  let service: SampleSlotService;

  const createSample = (voiceNumber: number, slotNumber: number): Sample => ({
    created_at: "2023-01-01",
    filename: `sample_${voiceNumber}_${slotNumber}.wav`,
    id: voiceNumber * 100 + slotNumber,
    is_stereo: false,
    kit_name: "TestKit",
    slot_number: slotNumber,
    source_path: `/path/to/sample_${voiceNumber}_${slotNumber}.wav`,
    voice_number: voiceNumber,
  });

  beforeEach(() => {
    service = new SampleSlotService();
  });

  describe("validateSlotBoundary", () => {
    it("should allow move to next available slot", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 1), // Slots 0, 1 occupied, next available is 2
      ];

      const result = service.validateSlotBoundary(1, 2, existingSamples);

      expect(result.success).toBe(true);
    });

    it("should allow move to existing slot", () => {
      const existingSamples = [createSample(1, 0), createSample(1, 1)];

      const result = service.validateSlotBoundary(1, 1, existingSamples);

      expect(result.success).toBe(true);
    });

    it("should reject move beyond next available slot", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 1), // Next available is 2, trying to move to 3
      ];

      const result = service.validateSlotBoundary(1, 3, existingSamples);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Cannot move to slot 4. Next available slot is 3"
      );
    });

    it("should allow move to slot 0 when voice is empty", () => {
      const existingSamples: Sample[] = [];

      const result = service.validateSlotBoundary(1, 0, existingSamples);

      expect(result.success).toBe(true);
    });

    it("should handle gaps in slots correctly", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 2), // Gap at slot 1, next available is 1
      ];

      const result = service.validateSlotBoundary(1, 1, existingSamples);

      expect(result.success).toBe(true);
    });
  });

  describe("findNextAvailableSlot", () => {
    it("should return 0 for empty voice", () => {
      const existingSamples: Sample[] = [];

      const result = service.findNextAvailableSlot(1, existingSamples);

      expect(result).toBe(0);
    });

    it("should return next slot after contiguous samples", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(1, 2),
      ];

      const result = service.findNextAvailableSlot(1, existingSamples);

      expect(result).toBe(3);
    });

    it("should return first gap in slots", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 2), // Gap at slot 1
        createSample(1, 3),
      ];

      const result = service.findNextAvailableSlot(1, existingSamples);

      expect(result).toBe(1);
    });

    it("should ignore other voices", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(2, 0), // Different voice
        createSample(2, 1), // Different voice
      ];

      const result = service.findNextAvailableSlot(1, existingSamples);

      expect(result).toBe(1); // Next slot for voice 1 is 1
    });
  });

  describe("isSlotOccupied", () => {
    it("should return true for occupied slot", () => {
      const existingSamples = [createSample(1, 0)];

      const result = service.isSlotOccupied(1, 0, existingSamples);

      expect(result).toBe(true);
    });

    it("should return false for empty slot", () => {
      const existingSamples = [createSample(1, 0)];

      const result = service.isSlotOccupied(1, 1, existingSamples);

      expect(result).toBe(false);
    });

    it("should return false for different voice", () => {
      const existingSamples = [createSample(1, 0)];

      const result = service.isSlotOccupied(2, 0, existingSamples);

      expect(result).toBe(false);
    });
  });

  describe("getOccupiedSlotsForVoice", () => {
    it("should return sorted slot numbers for voice", () => {
      const existingSamples = [
        createSample(1, 2),
        createSample(1, 0),
        createSample(1, 1),
        createSample(2, 0), // Different voice
      ];

      const result = service.getOccupiedSlotsForVoice(1, existingSamples);

      expect(result).toEqual([0, 1, 2]);
    });

    it("should return empty array for voice with no samples", () => {
      const existingSamples = [createSample(2, 0)];

      const result = service.getOccupiedSlotsForVoice(1, existingSamples);

      expect(result).toEqual([]);
    });
  });

  describe("hasGapsInVoice", () => {
    it("should return false for contiguous slots", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(1, 2),
      ];

      const result = service.hasGapsInVoice(1, existingSamples);

      expect(result).toBe(false);
    });

    it("should return true for gaps in slots", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 2), // Gap at slot 1
      ];

      const result = service.hasGapsInVoice(1, existingSamples);

      expect(result).toBe(true);
    });

    it("should return false for empty voice", () => {
      const existingSamples: Sample[] = [];

      const result = service.hasGapsInVoice(1, existingSamples);

      expect(result).toBe(false);
    });

    it("should return true when not starting from slot 0", () => {
      const existingSamples = [
        createSample(1, 1), // Missing slot 0
        createSample(1, 2),
      ];

      const result = service.hasGapsInVoice(1, existingSamples);

      expect(result).toBe(true);
    });
  });

  describe("getSampleCountForVoice", () => {
    it("should count samples for specific voice", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(2, 0), // Different voice
      ];

      const result = service.getSampleCountForVoice(1, existingSamples);

      expect(result).toBe(2);
    });

    it("should return 0 for voice with no samples", () => {
      const existingSamples = [createSample(2, 0)];

      const result = service.getSampleCountForVoice(1, existingSamples);

      expect(result).toBe(0);
    });
  });

  describe("getTotalSampleCount", () => {
    it("should count all samples", () => {
      const existingSamples = [
        createSample(1, 0),
        createSample(1, 1),
        createSample(2, 0),
      ];

      const result = service.getTotalSampleCount(existingSamples);

      expect(result).toBe(3);
    });

    it("should return 0 for empty array", () => {
      const result = service.getTotalSampleCount([]);

      expect(result).toBe(0);
    });
  });
});
