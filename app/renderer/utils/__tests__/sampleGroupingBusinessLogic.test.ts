import { describe, expect, test } from "vitest";

import { groupDbSamplesByVoice } from "../sampleGroupingUtils";

/**
 * Enhanced Business Logic Tests for Sample Grouping
 *
 * These tests provide comprehensive coverage of the sample grouping algorithm
 * including edge cases, stereo sample handling, and slot management logic.
 */

describe("Sample Grouping Business Logic - Extended Tests", () => {
  describe("groupDbSamplesByVoice - Core Algorithm", () => {
    test("should handle complex sample arrangements with gaps", () => {
      const dbSamples = [
        {
          filename: "kick.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "snare.wav",
          is_stereo: false,
          slot_number: 2,
          voice_number: 1,
        }, // Gap at slot 1
        {
          filename: "hat.wav",
          is_stereo: false,
          slot_number: 1,
          voice_number: 2,
        },
        {
          filename: "crash.wav",
          is_stereo: false,
          slot_number: 11,
          voice_number: 4,
        }, // Last slot
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["kick.wav", "", "snare.wav"]); // Gap preserved
      expect(result[2]).toEqual(["", "hat.wav"]); // First slot empty
      expect(result[3]).toEqual([]); // No samples
      expect(result[4]).toEqual([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "crash.wav",
      ]); // Last slot only
    });

    test("should handle maximum slots per voice (12 slots)", () => {
      const dbSamples = Array.from({ length: 12 }, (_, i) => ({
        filename: `sample${i + 1}.wav`,
        is_stereo: false,
        slot_number: i,
        voice_number: 1,
      }));

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toHaveLength(12);
      expect(result[1][0]).toBe("sample1.wav");
      expect(result[1][11]).toBe("sample12.wav");
    });

    test("should ignore samples beyond slot 11 (invalid slots)", () => {
      const dbSamples = [
        {
          filename: "valid.wav",
          is_stereo: false,
          slot_number: 5,
          voice_number: 1,
        },
        {
          filename: "invalid.wav",
          is_stereo: false,
          slot_number: 12,
          voice_number: 1,
        }, // Beyond max slot
        {
          filename: "invalid2.wav",
          is_stereo: false,
          slot_number: -1,
          voice_number: 1,
        }, // Negative slot
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["", "", "", "", "", "valid.wav"]); // Only valid sample
    });

    test("should ignore samples for voices beyond 4 (invalid voices)", () => {
      const dbSamples = [
        {
          filename: "valid.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "invalid.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 0,
        }, // Voice 0
        {
          filename: "invalid2.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 5,
        }, // Voice 5
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual([]);
      expect(result[2]).toEqual(["valid.wav"]);
      expect(result[3]).toEqual([]);
      expect(result[4]).toEqual([]);
    });

    test("should sort samples correctly when provided out of order", () => {
      const dbSamples = [
        {
          filename: "slot2.wav",
          is_stereo: false,
          slot_number: 2,
          voice_number: 1,
        },
        {
          filename: "voice2.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "slot0.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "slot1.wav",
          is_stereo: false,
          slot_number: 1,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["slot0.wav", "slot1.wav", "slot2.wav"]);
      expect(result[2]).toEqual(["voice2.wav"]);
    });

    test("should handle empty sample array", () => {
      const result = groupDbSamplesByVoice([]);

      expect(result).toEqual({ 1: [], 2: [], 3: [], 4: [] });
    });

    test("should trim trailing empty slots", () => {
      const dbSamples = [
        {
          filename: "sample.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        // Slots 1-11 remain empty
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["sample.wav"]); // Only one element, trailing empties removed
      expect(result[2]).toEqual([]); // Empty voice, all empties removed
    });
  });

  describe("Stereo Sample Handling", () => {
    test("should duplicate stereo sample to next voice", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["stereo.wav"]);
      expect(result[2]).toEqual(["stereo.wav"]); // Duplicated to next voice
    });

    test("should handle multiple stereo samples in same voice", () => {
      const dbSamples = [
        {
          filename: "stereo1.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "stereo2.wav",
          is_stereo: true,
          slot_number: 1,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["stereo1.wav", "stereo2.wav"]);
      expect(result[2]).toEqual(["stereo1.wav", "stereo2.wav"]); // Both duplicated
    });

    test("should not duplicate stereo sample from voice 4 (no next voice)", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 4,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[4]).toEqual(["stereo.wav"]);
      expect(result[1]).toEqual([]); // No wraparound to voice 1
      expect(result[2]).toEqual([]);
      expect(result[3]).toEqual([]);
    });

    test("should handle mixed stereo and mono samples", () => {
      const dbSamples = [
        {
          filename: "mono1.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "stereo.wav",
          is_stereo: true,
          slot_number: 1,
          voice_number: 1,
        },
        {
          filename: "mono2.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 2,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["mono1.wav", "stereo.wav"]);
      expect(result[2]).toEqual(["mono2.wav", "stereo.wav"]); // Stereo duplicated + original mono
    });

    test("should handle stereo samples with gaps", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          is_stereo: true,
          slot_number: 2,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["", "", "stereo.wav"]);
      expect(result[2]).toEqual(["", "", "stereo.wav"]); // Gap preserved in duplication
    });

    test("should handle stereo samples across different slot positions", () => {
      const dbSamples = [
        {
          filename: "stereo1.wav",
          is_stereo: true,
          slot_number: 3,
          voice_number: 2,
        },
        {
          filename: "stereo2.wav",
          is_stereo: true,
          slot_number: 7,
          voice_number: 3,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[2]).toEqual(["", "", "", "stereo1.wav"]);
      expect(result[3]).toEqual([
        "",
        "",
        "",
        "stereo1.wav",
        "",
        "",
        "",
        "stereo2.wav",
      ]); // Mixed duplication + original
      expect(result[4]).toEqual(["", "", "", "", "", "", "", "stereo2.wav"]); // Stereo2 duplicated
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    test("should handle samples with empty filenames", () => {
      const dbSamples = [
        { filename: "", is_stereo: false, slot_number: 0, voice_number: 1 },
        {
          filename: "valid.wav",
          is_stereo: false,
          slot_number: 1,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["", "valid.wav"]); // Empty filename preserved
    });

    test("should handle samples with null/undefined properties gracefully", () => {
      const dbSamples = [
        {
          filename: "test.wav",
          is_stereo: null,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "test2.wav",
          is_stereo: undefined,
          slot_number: 1,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["test.wav", "test2.wav"]);
      expect(result[2]).toEqual([]); // Falsy is_stereo values don't duplicate
    });

    test("should handle duplicate samples in same slot (last wins)", () => {
      const dbSamples = [
        {
          filename: "first.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "second.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        }, // Same slot
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual(["second.wav"]); // Last sample wins
    });

    test("should handle invalid data gracefully", () => {
      const dbSamples = [
        {
          filename: "valid.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "missing_props.wav",
          slot_number: null,
          voice_number: undefined,
        },
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      // Should only include valid samples and handle missing properties gracefully
      expect(result[1]).toEqual(["valid.wav"]);
      expect(result[2]).toEqual([]);
      expect(result[3]).toEqual([]);
      expect(result[4]).toEqual([]);
    });

    test("should handle very large arrays efficiently", () => {
      // Test with maximum possible samples (4 voices * 12 slots = 48 samples)
      const dbSamples = [];
      for (let voice = 1; voice <= 4; voice++) {
        for (let slot = 0; slot < 12; slot++) {
          dbSamples.push({
            filename: `v${voice}s${slot}.wav`,
            is_stereo: false,
            slot_number: slot,
            voice_number: voice,
          });
        }
      }

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toHaveLength(12);
      expect(result[4]).toHaveLength(12);
      expect(result[1][0]).toBe("v1s0.wav");
      expect(result[4][11]).toBe("v4s11.wav");
    });
  });

  describe("Performance and Memory Considerations", () => {
    test("should not mutate input array", () => {
      const dbSamples = [
        {
          filename: "test.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
      ];
      const originalSamples = JSON.parse(JSON.stringify(dbSamples)); // Deep clone

      groupDbSamplesByVoice(dbSamples);

      expect(dbSamples).toEqual(originalSamples); // Input unchanged
    });

    test("should create new voice arrays each time", () => {
      const dbSamples = [
        {
          filename: "test.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
      ];

      const result1 = groupDbSamplesByVoice(dbSamples);
      const result2 = groupDbSamplesByVoice(dbSamples);

      expect(result1).toEqual(result2); // Same content
      expect(result1).not.toBe(result2); // Different objects
      expect(result1[1]).not.toBe(result2[1]); // Different arrays
    });

    test("should handle memory efficiently with sparse data", () => {
      const dbSamples = [
        {
          filename: "test.wav",
          is_stereo: false,
          slot_number: 11,
          voice_number: 4,
        }, // Only last slot
      ];

      const result = groupDbSamplesByVoice(dbSamples);

      expect(result[1]).toEqual([]); // Empty voices are truly empty
      expect(result[2]).toEqual([]);
      expect(result[3]).toEqual([]);
      expect(result[4].length).toBe(12); // Full array for voice 4, but mostly empty
    });
  });

  describe("Real-world Usage Patterns", () => {
    test("should handle typical drum kit sample arrangement", () => {
      const drumKitSamples = [
        {
          filename: "kick.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "snare.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "hat_closed.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 3,
        },
        {
          filename: "hat_open.wav",
          is_stereo: false,
          slot_number: 1,
          voice_number: 3,
        },
        {
          filename: "crash.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 4,
        }, // Stereo crash
      ];

      const result = groupDbSamplesByVoice(drumKitSamples);

      expect(result[1]).toEqual(["kick.wav"]);
      expect(result[2]).toEqual(["snare.wav"]);
      expect(result[3]).toEqual(["hat_closed.wav", "hat_open.wav"]);
      expect(result[4]).toEqual(["crash.wav"]); // No duplication (voice 4 -> no next voice)
    });

    test("should handle melodic instrument multi-sampling", () => {
      const pianoSamples = [
        {
          filename: "piano_c3.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "piano_d3.wav",
          is_stereo: false,
          slot_number: 1,
          voice_number: 1,
        },
        {
          filename: "piano_e3.wav",
          is_stereo: false,
          slot_number: 2,
          voice_number: 1,
        },
        {
          filename: "piano_f3.wav",
          is_stereo: false,
          slot_number: 3,
          voice_number: 1,
        },
        // ... more chromatic samples
      ];

      const result = groupDbSamplesByVoice(pianoSamples);

      expect(result[1]).toEqual([
        "piano_c3.wav",
        "piano_d3.wav",
        "piano_e3.wav",
        "piano_f3.wav",
      ]);
      expect(result[2]).toEqual([]);
      expect(result[3]).toEqual([]);
      expect(result[4]).toEqual([]);
    });

    test("should handle mixed stereo and mono in production scenario", () => {
      const mixedSamples = [
        {
          filename: "kick_mono.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "snare_stereo.wav",
          is_stereo: true,
          slot_number: 1,
          voice_number: 1,
        },
        {
          filename: "bass_mono.wav",
          is_stereo: false,
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "pad_stereo.wav",
          is_stereo: true,
          slot_number: 0,
          voice_number: 3,
        },
      ];

      const result = groupDbSamplesByVoice(mixedSamples);

      expect(result[1]).toEqual(["kick_mono.wav", "snare_stereo.wav"]);
      expect(result[2]).toEqual(["bass_mono.wav", "snare_stereo.wav"]); // Stereo duplication
      expect(result[3]).toEqual(["pad_stereo.wav"]);
      expect(result[4]).toEqual(["pad_stereo.wav"]); // Stereo duplication
    });
  });
});
