// LED Grid constants for About dialog animated background

export const LED_COLS = 28;
export const LED_ROWS = 16;
export const LED_COUNT = LED_COLS * LED_ROWS;

export interface RowLfoConfig {
  frequency: number; // Hz (cycles per second)
  phase: number; // initial phase offset (0..2π)
  spatialFreq: number; // spatial frequency across columns
  wave: WaveType;
}

// Wave types for LFO modulation
export type WaveType = "saw" | "sine" | "triangle";

// Each row gets its own LFO config for varied wave patterns
export const ROW_LFO_CONFIGS: RowLfoConfig[] = [
  { frequency: 0.12, phase: 0.0, spatialFreq: 0.3, wave: "sine" },
  { frequency: 0.18, phase: 0.4, spatialFreq: 0.25, wave: "triangle" },
  { frequency: 0.09, phase: 0.8, spatialFreq: 0.35, wave: "saw" },
  { frequency: 0.22, phase: 1.2, spatialFreq: 0.2, wave: "sine" },
  { frequency: 0.15, phase: 1.6, spatialFreq: 0.4, wave: "triangle" },
  { frequency: 0.1, phase: 2.0, spatialFreq: 0.15, wave: "sine" },
  { frequency: 0.25, phase: 2.4, spatialFreq: 0.3, wave: "saw" },
  { frequency: 0.08, phase: 2.8, spatialFreq: 0.28, wave: "triangle" },
  { frequency: 0.2, phase: 3.2, spatialFreq: 0.22, wave: "sine" },
  { frequency: 0.14, phase: 3.6, spatialFreq: 0.38, wave: "saw" },
  { frequency: 0.3, phase: 4.0, spatialFreq: 0.18, wave: "triangle" },
  { frequency: 0.11, phase: 4.4, spatialFreq: 0.32, wave: "sine" },
  { frequency: 0.19, phase: 4.8, spatialFreq: 0.26, wave: "saw" },
  { frequency: 0.35, phase: 5.2, spatialFreq: 0.2, wave: "triangle" },
  { frequency: 0.13, phase: 5.6, spatialFreq: 0.35, wave: "sine" },
  { frequency: 0.16, phase: 6.0, spatialFreq: 0.24, wave: "saw" },
];

// Interaction tuning
export const PROXIMITY_RADIUS_SQ = 12; // squared grid-cell radius for mouse glow
export const PROXIMITY_INTENSITY = 0.6; // max brightness boost from proximity
export const RIPPLE_SPEED = 8; // grid cells per second
export const RIPPLE_WIDTH = 1.5; // ring thickness in grid cells
export const RIPPLE_DURATION = 1.2; // seconds before ripple fades out
export const MAX_RIPPLES = 8; // max concurrent ripples

// Base brightness range
export const BASE_MIN = 0.06; // minimum LED opacity (dim)
export const BASE_MAX = 0.5; // maximum LED opacity from LFO
export const BASE_SCALE = BASE_MAX - BASE_MIN;
