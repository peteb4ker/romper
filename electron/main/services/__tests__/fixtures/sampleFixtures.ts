import type { Sample } from "@romper/shared/db/schema";

/**
 * Shared test fixtures for Sample objects
 * Eliminates duplication of mockSample definitions across test files
 */

export const baseMockSample: Sample = {
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
};

export const mockStereoSample: Sample = {
  ...baseMockSample,
  filename: "stereo_test.wav",
  id: 2,
  is_stereo: true,
  source_path: "/path/to/stereo_test.wav",
  wav_channels: 2,
};

export const mockMonoSample: Sample = {
  ...baseMockSample,
  filename: "mono_test.wav",
  id: 3,
  is_stereo: false,
  wav_channels: 1,
};

/**
 * Create a sample with custom properties
 */
export function createMockSample(overrides: Partial<Sample> = {}): Sample {
  return {
    ...baseMockSample,
    ...overrides,
  };
}

/**
 * Create multiple samples for testing
 */
export function createMockSamples(
  count: number,
  baseOverrides: Partial<Sample> = {},
): Sample[] {
  return Array.from({ length: count }, (_, index) =>
    createMockSample({
      ...baseOverrides,
      filename: `test_${index + 1}.wav`,
      id: index + 1,
      source_path: `/path/to/test_${index + 1}.wav`,
    }),
  );
}

/**
 * Voice data fixtures for stereo handling tests
 */
export const mockVoices = [
  {
    id: 1,
    kit_name: "A0",
    stereo_mode: false,
    voice_alias: null,
    voice_number: 1,
  },
  {
    id: 2,
    kit_name: "A0",
    stereo_mode: false,
    voice_alias: null,
    voice_number: 2,
  },
  {
    id: 3,
    kit_name: "A0",
    stereo_mode: false,
    voice_alias: null,
    voice_number: 3,
  },
  {
    id: 4,
    kit_name: "A0",
    stereo_mode: false,
    voice_alias: null,
    voice_number: 4,
  },
];

export const mockStereoVoices = [
  {
    id: 1,
    kit_name: "A0",
    stereo_mode: true,
    voice_alias: null,
    voice_number: 1,
  },
  {
    id: 2,
    kit_name: "A0",
    stereo_mode: false,
    voice_alias: null,
    voice_number: 2,
  },
  {
    id: 3,
    kit_name: "A0",
    stereo_mode: true,
    voice_alias: null,
    voice_number: 3,
  },
  {
    id: 4,
    kit_name: "A0",
    stereo_mode: false,
    voice_alias: null,
    voice_number: 4,
  },
];
