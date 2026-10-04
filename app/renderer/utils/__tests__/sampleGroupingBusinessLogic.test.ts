import type { Sample } from "@romper/shared/db/schema";

import { describe, expect, test } from "vitest";

import { createMockSample } from "../../../../tests/factories/sample.factory";
import { groupDbSamplesByVoice } from "../sampleGroupingUtils";

/** Sample rows with the given filename, slot and voice */
const rows = (
  samples: Pick<Sample, "filename" | "slot_number" | "voice_number">[],
): Sample[] => samples.map((sample) => createMockSample(sample));

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
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "snare.wav",
          slot_number: 2,
          voice_number: 1,
        }, // Gap at slot 1
        {
          filename: "hat.wav",
          slot_number: 1,
          voice_number: 2,
        },
        {
          filename: "crash.wav",
          slot_number: 11,
          voice_number: 4,
        }, // Last slot
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

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
        slot_number: i,
        voice_number: 1,
      }));

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toHaveLength(12);
      expect(result[1][0]).toBe("sample1.wav");
      expect(result[1][11]).toBe("sample12.wav");
    });

    test("should ignore samples beyond slot 11 (invalid slots)", () => {
      const dbSamples = [
        {
          filename: "valid.wav",
          slot_number: 5,
          voice_number: 1,
        },
        {
          filename: "invalid.wav",
          slot_number: 12,
          voice_number: 1,
        }, // Beyond max slot
        {
          filename: "invalid2.wav",
          slot_number: -1,
          voice_number: 1,
        }, // Negative slot
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["", "", "", "", "", "valid.wav"]); // Only valid sample
    });

    test("should ignore samples for voices beyond 4 (invalid voices)", () => {
      const dbSamples = [
        {
          filename: "valid.wav",
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "invalid.wav",
          slot_number: 0,
          voice_number: 0,
        }, // Voice 0
        {
          filename: "invalid2.wav",
          slot_number: 0,
          voice_number: 5,
        }, // Voice 5
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual([]);
      expect(result[2]).toEqual(["valid.wav"]);
      expect(result[3]).toEqual([]);
      expect(result[4]).toEqual([]);
    });

    test("should sort samples correctly when provided out of order", () => {
      const dbSamples = [
        {
          filename: "slot2.wav",
          slot_number: 2,
          voice_number: 1,
        },
        {
          filename: "voice2.wav",
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "slot0.wav",
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "slot1.wav",
          slot_number: 1,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

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
          slot_number: 0,
          voice_number: 1,
        },
        // Slots 1-11 remain empty
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["sample.wav"]); // Only one element, trailing empties removed
      expect(result[2]).toEqual([]); // Empty voice, all empties removed
    });
  });

  describe("Stereo Sample Handling", () => {
    test("should not duplicate stereo sample to next voice", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          slot_number: 0,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["stereo.wav"]);
      expect(result[2]).toEqual([]); // Stereo is a voice config, no ghost entries
    });

    test("should not duplicate multiple stereo samples to next voice", () => {
      const dbSamples = [
        {
          filename: "stereo1.wav",
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "stereo2.wav",
          slot_number: 1,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["stereo1.wav", "stereo2.wav"]);
      expect(result[2]).toEqual([]); // No ghost entries
    });

    test("should keep stereo sample on voice 4 without duplication", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          slot_number: 0,
          voice_number: 4,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[4]).toEqual(["stereo.wav"]);
      expect(result[1]).toEqual([]);
      expect(result[2]).toEqual([]);
      expect(result[3]).toEqual([]);
    });

    test("should handle mixed stereo and mono samples without ghost entries", () => {
      const dbSamples = [
        {
          filename: "mono1.wav",
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "stereo.wav",
          slot_number: 1,
          voice_number: 1,
        },
        {
          filename: "mono2.wav",
          slot_number: 0,
          voice_number: 2,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["mono1.wav", "stereo.wav"]);
      expect(result[2]).toEqual(["mono2.wav"]); // No ghost entry from stereo
    });

    test("should handle stereo samples with gaps without ghost entries", () => {
      const dbSamples = [
        {
          filename: "stereo.wav",
          slot_number: 2,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["", "", "stereo.wav"]);
      expect(result[2]).toEqual([]); // No ghost entry
    });

    test("should handle stereo samples across different voices without ghost entries", () => {
      const dbSamples = [
        {
          filename: "stereo1.wav",
          slot_number: 3,
          voice_number: 2,
        },
        {
          filename: "stereo2.wav",
          slot_number: 7,
          voice_number: 3,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[2]).toEqual(["", "", "", "stereo1.wav"]);
      expect(result[3]).toEqual(["", "", "", "", "", "", "", "stereo2.wav"]); // Only its own sample
      expect(result[4]).toEqual([]); // No ghost entry
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    test("should handle samples with empty filenames", () => {
      const dbSamples = [
        { filename: "", slot_number: 0, voice_number: 1 },
        {
          filename: "valid.wav",
          slot_number: 1,
          voice_number: 1,
        },
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["", "valid.wav"]); // Empty filename preserved
    });

    test("should handle duplicate samples in same slot (last wins)", () => {
      const dbSamples = [
        {
          filename: "first.wav",
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "second.wav",
          slot_number: 0,
          voice_number: 1,
        }, // Same slot
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toEqual(["second.wav"]); // Last sample wins
    });

    test("should handle very large arrays efficiently", () => {
      // Test with maximum possible samples (4 voices * 12 slots = 48 samples)
      const dbSamples = [];
      for (let voice = 1; voice <= 4; voice++) {
        for (let slot = 0; slot < 12; slot++) {
          dbSamples.push({
            filename: `v${voice}s${slot}.wav`,
            slot_number: slot,
            voice_number: voice,
          });
        }
      }

      const result = groupDbSamplesByVoice(rows(dbSamples));

      expect(result[1]).toHaveLength(12);
      expect(result[4]).toHaveLength(12);
      expect(result[1][0]).toBe("v1s0.wav");
      expect(result[4][11]).toBe("v4s11.wav");
    });
  });

  describe("Performance and Memory Considerations", () => {
    test("should not mutate input array", () => {
      const dbSamples = rows([
        {
          filename: "test.wav",
          slot_number: 0,
          voice_number: 1,
        },
      ]);
      const originalSamples = JSON.parse(JSON.stringify(dbSamples)); // Deep clone

      groupDbSamplesByVoice(dbSamples);

      expect(dbSamples).toEqual(originalSamples); // Input unchanged
    });

    test("should create new voice arrays each time", () => {
      const dbSamples = [
        {
          filename: "test.wav",
          slot_number: 0,
          voice_number: 1,
        },
      ];

      const result1 = groupDbSamplesByVoice(rows(dbSamples));
      const result2 = groupDbSamplesByVoice(rows(dbSamples));

      expect(result1).toEqual(result2); // Same content
      expect(result1).not.toBe(result2); // Different objects
      expect(result1[1]).not.toBe(result2[1]); // Different arrays
    });

    test("should handle memory efficiently with sparse data", () => {
      const dbSamples = [
        {
          filename: "test.wav",
          slot_number: 11,
          voice_number: 4,
        }, // Only last slot
      ];

      const result = groupDbSamplesByVoice(rows(dbSamples));

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
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "snare.wav",
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "hat_closed.wav",
          slot_number: 0,
          voice_number: 3,
        },
        {
          filename: "hat_open.wav",
          slot_number: 1,
          voice_number: 3,
        },
        {
          filename: "crash.wav",
          slot_number: 0,
          voice_number: 4,
        }, // Stereo crash
      ];

      const result = groupDbSamplesByVoice(rows(drumKitSamples));

      expect(result[1]).toEqual(["kick.wav"]);
      expect(result[2]).toEqual(["snare.wav"]);
      expect(result[3]).toEqual(["hat_closed.wav", "hat_open.wav"]);
      expect(result[4]).toEqual(["crash.wav"]);
    });

    test("should handle melodic instrument multi-sampling", () => {
      const pianoSamples = [
        {
          filename: "piano_c3.wav",
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "piano_d3.wav",
          slot_number: 1,
          voice_number: 1,
        },
        {
          filename: "piano_e3.wav",
          slot_number: 2,
          voice_number: 1,
        },
        {
          filename: "piano_f3.wav",
          slot_number: 3,
          voice_number: 1,
        },
        // ... more chromatic samples
      ];

      const result = groupDbSamplesByVoice(rows(pianoSamples));

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

    test("should handle mixed stereo and mono in production scenario without ghost entries", () => {
      const mixedSamples = [
        {
          filename: "kick_mono.wav",
          slot_number: 0,
          voice_number: 1,
        },
        {
          filename: "snare_stereo.wav",
          slot_number: 1,
          voice_number: 1,
        },
        {
          filename: "bass_mono.wav",
          slot_number: 0,
          voice_number: 2,
        },
        {
          filename: "pad_stereo.wav",
          slot_number: 0,
          voice_number: 3,
        },
      ];

      const result = groupDbSamplesByVoice(rows(mixedSamples));

      expect(result[1]).toEqual(["kick_mono.wav", "snare_stereo.wav"]);
      expect(result[2]).toEqual(["bass_mono.wav"]); // No ghost from snare_stereo
      expect(result[3]).toEqual(["pad_stereo.wav"]);
      expect(result[4]).toEqual([]); // No ghost from pad_stereo
    });
  });
});
