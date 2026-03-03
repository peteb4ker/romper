// LED Icon constants for miniature header icon animation

import type { RowLfoConfig } from "../dialogs/led-grid/ledConstants";

export const ICON_COLS = 14;
export const ICON_ROWS = 5;
export const ICON_LED_COUNT = ICON_COLS * ICON_ROWS;

// Each row gets its own LFO config for varied wave patterns
export const ICON_ROW_LFO_CONFIGS: RowLfoConfig[] = [
  { frequency: 0.12, phase: 0.0, spatialFreq: 0.3, wave: "sine" },
  { frequency: 0.18, phase: 0.8, spatialFreq: 0.25, wave: "triangle" },
  { frequency: 0.09, phase: 1.6, spatialFreq: 0.35, wave: "saw" },
  { frequency: 0.22, phase: 2.4, spatialFreq: 0.2, wave: "sine" },
  { frequency: 0.15, phase: 3.2, spatialFreq: 0.4, wave: "triangle" },
];

// Time multipliers for idle vs hover state
export const ICON_TIME_IDLE = 0.6; // gentle ambient drift at rest
export const ICON_TIME_HOVER = 1.0; // full speed on hover

// Interaction tuning (smaller grid = tighter values)
export const ICON_PROXIMITY_RADIUS_SQ = 8;
export const ICON_PROXIMITY_INTENSITY = 0.5;
export const ICON_RIPPLE_SPEED = 4;
export const ICON_RIPPLE_WIDTH = 1.0;
export const ICON_RIPPLE_DURATION = 0.8;
export const ICON_MAX_RIPPLES = 3;

// Base brightness range
export const ICON_BASE_MIN = 0.25;
export const ICON_BASE_MAX = 0.7;
export const ICON_BASE_SCALE = ICON_BASE_MAX - ICON_BASE_MIN;
