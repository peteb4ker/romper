// VU meter layout and animation constants

// Voice-to-column mapping: 3 columns per voice, centered in 14-col grid
export const VU_VOICE_COLS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

export const VU_BORDER_COLS = [0, 13];

// Decay & responsiveness
export const VU_DECAY_RATE = 0.93; // ~200ms half-life at 60fps
export const VU_PEAK_HOLD_FRAMES = 10; // ~167ms at 60fps
export const VU_PEAK_DROP_INTERVAL = 2; // frames between peak drop steps
export const VU_SILENCE_THRESHOLD = 0.01;
export const VU_CROSSFADE_MS = 300;

// Level scaling — lower power curve compresses dynamic range (boosts quiet sounds)
export const VU_AMPLIFICATION = 2.5;
export const VU_POWER_CURVE = 0.55;
export const VU_NOISE_FLOOR = 0.02; // RMS below this reads as silence

// Brightness values
export const VU_LIT_MIN_BRIGHTNESS = 0.6;
export const VU_LIT_MAX_BRIGHTNESS = 1.0;
export const VU_PEAK_BRIGHTNESS = 1.0;
export const VU_UNLIT_BRIGHTNESS = 0.03;
export const VU_BORDER_BRIGHTNESS = 0.02;
