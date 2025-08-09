import type { NewSample, Sample } from "@romper/shared/db/schema";

/**
 * Factory for creating mock Sample objects
 * Reduces test data duplication for sample-related tests
 */
export const createMockSample = (overrides: Partial<Sample> = {}): Sample => ({
  bit_depth: 16,
  channels: 1,
  created_at: new Date().toISOString(),
  duration_seconds: 1.0,
  file_path: "/mock/local/store/A0/1 Kick.wav",
  file_size: 44100,
  filename: "1 Kick.wav",
  format: "wav",
  id: 1,
  kit_name: "A0",
  sample_rate: 44100,
  slot_number: 0,
  updated_at: new Date().toISOString(),
  voice_number: 1,
  ...overrides,
});

/**
 * Factory for creating mock NewSample objects
 */
export const createMockNewSample = (
  overrides: Partial<NewSample> = {},
): NewSample => ({
  bit_depth: 16,
  channels: 1,
  duration_seconds: 1.0,
  file_path: "/mock/local/store/A0/1 Kick.wav",
  file_size: 44100,
  filename: "1 Kick.wav",
  format: "wav",
  kit_name: "A0",
  sample_rate: 44100,
  slot_number: 0,
  voice_number: 1,
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
 * Creates samples with different audio formats
 */
export const createMockSamplesWithFormats = (): Sample[] => [
  createMockSample({
    file_size: 44100,
    filename: "kick.wav",
    format: "wav",
    id: 1,
  }),
  createMockSample({
    file_size: 88200,
    filename: "snare.aiff",
    format: "aiff",
    id: 2,
  }),
  createMockSample({
    file_size: 22050,
    filename: "hat.flac",
    format: "flac",
    id: 3,
  }),
];

/**
 * Creates samples with different audio characteristics
 */
export const createMockSamplesWithVariedAudio = (): Sample[] => [
  createMockSample({
    bit_depth: 16,
    channels: 1,
    duration_seconds: 1.0,
    filename: "mono_kick.wav",
    id: 1,
    sample_rate: 44100,
  }),
  createMockSample({
    bit_depth: 24,
    channels: 2,
    duration_seconds: 2.5,
    filename: "stereo_snare.wav",
    id: 2,
    sample_rate: 48000,
  }),
  createMockSample({
    bit_depth: 32,
    channels: 1,
    duration_seconds: 0.5,
    filename: "hq_hat.wav",
    id: 3,
    sample_rate: 96000,
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
