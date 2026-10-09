import type { NewSample, Sample } from "@romper/shared/db/schema";

/**
 * Factory for creating mock Sample objects
 * Reduces test data duplication for sample-related tests
 */
export const createMockSample = (overrides: Partial<Sample> = {}): Sample => ({
  filename: "1 Kick.wav",
  gain_db: 0,
  id: 1,
  kit_name: "A0",
  slot_number: 0,
  source_mtime_ms: null,
  source_path: "/mock/local/store/A0/1 Kick.wav",
  source_size: null,
  source_status: null,
  voice_number: 1,
  wav_bit_depth: 16,
  wav_bitrate: null,
  wav_channels: 1,
  wav_format_tag: 1,
  wav_sample_rate: 44100,
  ...overrides,
});

/**
 * Factory for creating mock NewSample objects
 */
export const createMockNewSample = (
  overrides: Partial<NewSample> = {},
): NewSample => ({
  filename: "1 Kick.wav",
  kit_name: "A0",
  slot_number: 0,
  source_path: "/mock/local/store/A0/1 Kick.wav",
  voice_number: 1,
  wav_bit_depth: 16,
  wav_channels: 1,
  wav_sample_rate: 44100,
  ...overrides,
});

/**
 * Creates a complete drum kit set of samples
 */
export const createMockDrumKitSamples = (kitName: string = "A0"): Sample[] => [
  createMockSample({
    filename: "1 Kick.wav",
    id: 1,
    kit_name: kitName,
    slot_number: 0,
    voice_number: 1,
  }),
  createMockSample({
    filename: "2 Snare.wav",
    id: 2,
    kit_name: kitName,
    slot_number: 0,
    voice_number: 2,
  }),
  createMockSample({
    filename: "3 Hat.wav",
    id: 3,
    kit_name: kitName,
    slot_number: 0,
    voice_number: 3,
  }),
  createMockSample({
    filename: "4 Tom.wav",
    id: 4,
    kit_name: kitName,
    slot_number: 0,
    voice_number: 4,
  }),
];

/**
 * Creates samples for a specific voice with multiple slots
 */
export const createMockVoiceSamples = (
  kitName: string,
  voiceNumber: number,
  slotCount: number = 4,
): Sample[] =>
  Array.from({ length: slotCount }, (_, i) =>
    createMockSample({
      filename: `${voiceNumber}_${i + 1}_sample.wav`,
      id: i + 1,
      kit_name: kitName,
      slot_number: i,
      voice_number: voiceNumber,
    }),
  );

/**
 * Creates samples with different WAV formats
 */
export const createMockSamplesWithVariedAudio = (): Sample[] => [
  createMockSample({
    filename: "mono_kick.wav",
    id: 1,
    wav_bit_depth: 16,
    wav_channels: 1,
    wav_sample_rate: 44100,
  }),
  createMockSample({
    filename: "stereo_snare.wav",
    id: 2,
    wav_bit_depth: 24,
    wav_channels: 2,
    wav_sample_rate: 48000,
  }),
  createMockSample({
    filename: "hq_hat.wav",
    id: 3,
    wav_bit_depth: 32,
    wav_channels: 1,
    wav_sample_rate: 96000,
  }),
];

/**
 * Creates sample count arrays for kit browser display
 */
export const createMockSampleCounts = (): Record<
  string,
  [number, number, number, number]
> => ({
  A0: [1, 1, 1, 1], // 1 sample per voice
  A1: [2, 1, 0, 3], // varied samples per voice
  B0: [0, 0, 0, 0], // empty kit
  B1: [4, 4, 4, 4], // full kit
});
