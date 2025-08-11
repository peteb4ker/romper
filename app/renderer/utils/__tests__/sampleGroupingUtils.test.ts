import { describe, expect, it } from "vitest";

import { groupDbSamplesByVoice } from "../sampleGroupingUtils";

describe("sampleGroupingUtils", () => {
  describe("groupDbSamplesByVoice", () => {
    it("should initialize empty voices structure", () => {
      const result = groupDbSamplesByVoice([]);
      expect(result).toEqual({ 1: [], 2: [], 3: [], 4: [] });
    });

    it("should group samples by voice number", () => {
      const dbSamples = [
        { filename: "sample1.wav", slot_number: 0, voice_number: 1 },
        { filename: "sample2.wav", slot_number: 0, voice_number: 2 },
        { filename: "sample3.wav", slot_number: 0, voice_number: 3 },
        { filename: "sample4.wav", slot_number: 0, voice_number: 4 },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1]).toContain("sample1.wav");
      expect(result[2]).toContain("sample2.wav");
      expect(result[3]).toContain("sample3.wav");
      expect(result[4]).toContain("sample4.wav");
    });

    it("should maintain slot order within voices", () => {
      const dbSamples = [
        { filename: "slot3.wav", slot_number: 2, voice_number: 1 },
        { filename: "slot1.wav", slot_number: 0, voice_number: 1 },
        { filename: "slot2.wav", slot_number: 1, voice_number: 1 },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1][0]).toBe("slot1.wav"); // slot_number 0 -> index 0
      expect(result[1][1]).toBe("slot2.wav"); // slot_number 1 -> index 1
      expect(result[1][2]).toBe("slot3.wav"); // slot_number 2 -> index 2
    });

    it("should handle stereo samples by duplicating to next voice", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1][0]).toBe("stereo.wav");
      expect(result[2][0]).toBe("stereo.wav"); // duplicated to next voice
    });

    it("should not duplicate stereo samples from voice 4", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 4,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[4][0]).toBe("stereo.wav");
      // Voice 5 doesn't exist, so no duplication should occur
    });

    it("should ignore samples with invalid voice numbers", () => {
      const dbSamples = [
        { filename: "invalid0.wav", slot_number: 0, voice_number: 0 },
        { filename: "invalid5.wav", slot_number: 0, voice_number: 5 },
        { filename: "valid.wav", slot_number: 0, voice_number: 1 },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1]).toContain("valid.wav");
      expect(result[1]).not.toContain("invalid0.wav");
      expect(result[1]).not.toContain("invalid5.wav");
    });

    it("should ignore samples with invalid slot numbers", () => {
      const dbSamples = [
        {
          filename: "invalid-slot-negative.wav",
          slot_number: -1,
          voice_number: 1,
        },
        { filename: "invalid-slot13.wav", slot_number: 13, voice_number: 1 },
        { filename: "valid-slot.wav", slot_number: 0, voice_number: 1 },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1]).toContain("valid-slot.wav");
      expect(result[1]).not.toContain("invalid-slot-negative.wav");
      expect(result[1]).not.toContain("invalid-slot13.wav");
    });

    it("should fill empty slots with empty strings", () => {
      const dbSamples = [
        { filename: "first.wav", slot_number: 0, voice_number: 1 },
        { filename: "third.wav", slot_number: 2, voice_number: 1 },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1][0]).toBe("first.wav");
      expect(result[1][1]).toBe(""); // empty slot 2
      expect(result[1][2]).toBe("third.wav");
    });

    it("should remove trailing empty slots", () => {
      const dbSamples = [
        { filename: "second.wav", slot_number: 1, voice_number: 1 },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      // Should have empty string for slot 1, then second.wav, then truncated
      expect(result[1]).toEqual(["", "second.wav"]);
      expect(result[1]).toHaveLength(2); // No trailing empty slots
    });

    it("should sort samples by voice and slot number", () => {
      const dbSamples = [
        { filename: "v2s2.wav", slot_number: 1, voice_number: 2 },
        { filename: "v1s2.wav", slot_number: 1, voice_number: 1 },
        { filename: "v2s1.wav", slot_number: 0, voice_number: 2 },
        { filename: "v1s1.wav", slot_number: 0, voice_number: 1 },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1][0]).toBe("v1s1.wav");
      expect(result[1][1]).toBe("v1s2.wav");
      expect(result[2][0]).toBe("v2s1.wav");
      expect(result[2][1]).toBe("v2s2.wav");
    });

    it("should handle mixed stereo and mono samples", () => {
      const dbSamples = [
        {
          filename: "mono.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "stereo.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "another.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 4,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);
      expect(result[1][0]).toBe("mono.wav");
      expect(result[2][0]).toBe("stereo.wav");
      expect(result[3][0]).toBe("stereo.wav"); // stereo duplicated to voice 3
      expect(result[4][0]).toBe("another.wav");
    });
  });
});
