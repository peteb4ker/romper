import { describe, expect, it } from "vitest";

import {
  baseMockSample,
  createMockSample,
  createMockSamples,
  mockMonoSample,
  mockStereoSample,
  mockStereoVoices,
  mockVoices,
} from "../sampleFixtures.js";

describe("Sample Fixtures", () => {
  describe("baseMockSample", () => {
    it("should have correct default properties", () => {
      expect(baseMockSample).toEqual({
        filename: "test.wav",
        id: 1,
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/path/to/test.wav",
        voice_number: 1,
        wav_bit_depth: 16,
        wav_bitrate: 16,
        wav_channels: 1,
        wav_sample_rate: 44100,
      });
    });
  });

  describe("mockStereoSample", () => {
    it("should be stereo with correct properties", () => {
      expect(mockStereoSample.is_stereo).toBe(true);
      expect(mockStereoSample.wav_channels).toBe(2);
      expect(mockStereoSample.filename).toBe("stereo_test.wav");
      expect(mockStereoSample.id).toBe(2);
    });
  });

  describe("mockMonoSample", () => {
    it("should be mono with correct properties", () => {
      expect(mockMonoSample.is_stereo).toBe(false);
      expect(mockMonoSample.wav_channels).toBe(1);
      expect(mockMonoSample.filename).toBe("mono_test.wav");
      expect(mockMonoSample.id).toBe(3);
    });
  });

  describe("createMockSample", () => {
    it("should create sample with default properties", () => {
      const sample = createMockSample();
      expect(sample).toEqual(baseMockSample);
    });

    it("should override properties correctly", () => {
      const sample = createMockSample({
        filename: "custom.wav",
        id: 99,
        is_stereo: true,
      });

      expect(sample.id).toBe(99);
      expect(sample.filename).toBe("custom.wav");
      expect(sample.is_stereo).toBe(true);
      expect(sample.kit_name).toBe("A0"); // Should keep default
    });

    it("should handle empty overrides", () => {
      const sample = createMockSample({});
      expect(sample).toEqual(baseMockSample);
    });
  });

  describe("createMockSamples", () => {
    it("should create correct number of samples", () => {
      const samples = createMockSamples(3);
      expect(samples).toHaveLength(3);
    });

    it("should assign unique IDs and filenames", () => {
      const samples = createMockSamples(3);

      expect(samples[0]).toEqual(
        expect.objectContaining({
          filename: "test_1.wav",
          id: 1,
          source_path: "/path/to/test_1.wav",
        }),
      );

      expect(samples[1]).toEqual(
        expect.objectContaining({
          filename: "test_2.wav",
          id: 2,
          source_path: "/path/to/test_2.wav",
        }),
      );

      expect(samples[2]).toEqual(
        expect.objectContaining({
          filename: "test_3.wav",
          id: 3,
          source_path: "/path/to/test_3.wav",
        }),
      );
    });

    it("should apply base overrides to all samples", () => {
      const samples = createMockSamples(2, { is_stereo: true, kit_name: "B1" });

      expect(samples[0].kit_name).toBe("B1");
      expect(samples[0].is_stereo).toBe(true);
      expect(samples[1].kit_name).toBe("B1");
      expect(samples[1].is_stereo).toBe(true);
    });

    it("should handle zero count", () => {
      const samples = createMockSamples(0);
      expect(samples).toHaveLength(0);
    });
  });

  describe("Voice fixtures", () => {
    describe("mockVoices", () => {
      it("should have 4 voices with correct properties", () => {
        expect(mockVoices).toHaveLength(4);

        mockVoices.forEach((voice, index) => {
          expect(voice).toEqual({
            id: index + 1,
            kit_name: "A0",
            stereo_mode: false,
            voice_alias: null,
            voice_number: index + 1,
          });
        });
      });
    });

    describe("mockStereoVoices", () => {
      it("should have alternating stereo modes", () => {
        expect(mockStereoVoices).toHaveLength(4);
        expect(mockStereoVoices[0].stereo_mode).toBe(true); // Voice 1
        expect(mockStereoVoices[1].stereo_mode).toBe(false); // Voice 2
        expect(mockStereoVoices[2].stereo_mode).toBe(true); // Voice 3
        expect(mockStereoVoices[3].stereo_mode).toBe(false); // Voice 4
      });
    });
  });
});
