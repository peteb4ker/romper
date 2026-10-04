import type { Voice } from "@romper/shared/db/schema";

/**
 * Factory for creating mock Voice rows, with the schema's defaults
 */
export const createMockVoice = (overrides: Partial<Voice> = {}): Voice => ({
  id: 1,
  kit_name: "A0",
  sample_mode: "first",
  slice_enabled: false,
  slice_max_length: 2,
  slice_roll_amount: 100,
  slice_vary_length: false,
  stereo_choice: null,
  stereo_mode: false,
  voice_alias: null,
  voice_number: 1,
  voice_volume: 100,
  ...overrides,
});
