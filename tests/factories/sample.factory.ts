import type { NewSample, Sample } from "../../shared/db/schema";

/**
 * Factory for creating mock Sample objects
 * Reduces test data duplication for sample-related tests
 */
export const createMockSample = (overrides: Partial<Sample> = {}): Sample => ({
  id: 1,
  kit_name: "A0",
  filename: "1 Kick.wav",
  voice_number: 1,
  slot_number: 0,
  file_path: "/mock/local/store/A0/1 Kick.wav",
  file_size: 44100,
  duration_seconds: 1.0,
  sample_rate: 44100,
  bit_depth: 16,
  channels: 1,
  format: "wav",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Factory for creating mock NewSample objects
 */
export const createMockNewSample = (
  overrides: Partial<NewSample> = {},
): NewSample => ({
  kit_name: "A0",
  filename: "1 Kick.wav",
  voice_number: 1,
  slot_number: 0,
  file_path: "/mock/local/store/A0/1 Kick.wav",
  file_size: 44100,
  duration_seconds: 1.0,
  sample_rate: 44100,
  bit_depth: 16,
  channels: 1,
  format: "wav",
  ...overrides,
});

/**
 * Creates a complete drum kit set of samples
 */
export const createMockDrumKitSamples = (kitName: string = "A0"): Sample[] => [
  createMockSample({
    id: 1,
    kit_name: kitName,
    filename: "1 Kick.wav",
    voice_number: 1,
    slot_number: 0,
  }),
  createMockSample({
    id: 2,
    kit_name: kitName,
    filename: "2 Snare.wav",
    voice_number: 2,
    slot_number: 0,
  }),
  createMockSample({
    id: 3,
    kit_name: kitName,
    filename: "3 Hat.wav",
    voice_number: 3,
    slot_number: 0,
  }),
  createMockSample({
    id: 4,
    kit_name: kitName,
    filename: "4 Tom.wav",
    voice_number: 4,
    slot_number: 0,
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
      id: i + 1,
      kit_name: kitName,
      filename: `${voiceNumber}_${i + 1}_sample.wav`,
      voice_number: voiceNumber,
      slot_number: i,
    }),
  );

/**
 * Creates samples with different audio formats
 */
export const createMockSamplesWithFormats = (): Sample[] => [
  createMockSample({
    id: 1,
    filename: "kick.wav",
    format: "wav",
    file_size: 44100,
  }),
  createMockSample({
    id: 2,
    filename: "snare.aiff",
    format: "aiff",
    file_size: 88200,
  }),
  createMockSample({
    id: 3,
    filename: "hat.flac",
    format: "flac",
    file_size: 22050,
  }),
];

/**
 * Creates samples with different audio characteristics
 */
export const createMockSamplesWithVariedAudio = (): Sample[] => [
  createMockSample({
    id: 1,
    filename: "mono_kick.wav",
    channels: 1,
    sample_rate: 44100,
    bit_depth: 16,
    duration_seconds: 1.0,
  }),
  createMockSample({
    id: 2,
    filename: "stereo_snare.wav",
    channels: 2,
    sample_rate: 48000,
    bit_depth: 24,
    duration_seconds: 2.5,
  }),
  createMockSample({
    id: 3,
    filename: "hq_hat.wav",
    channels: 1,
    sample_rate: 96000,
    bit_depth: 32,
    duration_seconds: 0.5,
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
