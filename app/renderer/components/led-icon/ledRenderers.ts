import type { Ripple } from "../dialogs/led-grid/ledMath";

import {
  applyLedStyle,
  computeBaseLfo,
  computeProximityBoost,
  computeRippleBoost,
} from "../dialogs/led-grid/ledMath";
import {
  ICON_BASE_MIN,
  ICON_BASE_SCALE,
  ICON_PROXIMITY_INTENSITY,
  ICON_PROXIMITY_RADIUS_SQ,
  ICON_RIPPLE_DURATION,
  ICON_RIPPLE_SPEED,
  ICON_RIPPLE_WIDTH,
  ICON_ROW_LFO_CONFIGS,
} from "./ledIconConstants";
import {
  VU_BORDER_BRIGHTNESS,
  VU_BORDER_COLS,
  VU_UNLIT_BRIGHTNESS,
  VU_VOICE_COLS,
} from "./vuMeterConstants";
import { computeVuLedBrightness } from "./vuMeterState";

/**
 * Per-LED paint functions for the LED icon's two visual modes: the ambient
 * LFO animation and the per-voice VU meter. Called once per LED per frame by
 * the animation loop in useLedVisualization.
 */

export interface AmbientLedOptions {
  col: number;
  el: HTMLElement;
  glowColor: string;
  isHovered: boolean;
  mouse: { col: number; row: number } | null;
  rawTime: number;
  ripples: Ripple[];
  row: number;
  time: number;
}

export interface VuLedOptions {
  ambientMix: number;
  col: number;
  defaultGlowColor: string;
  el: HTMLElement;
  rawTime: number;
  ripples: Ripple[];
  row: number;
  time: number;
  voiceBarHeights: Record<number, number>;
  voiceGlowColors: Record<number, string>;
  voicePeakRows: Record<number, number>;
}

// Build column-to-voice lookup table
const colToVoice = new Map<number, number>();
for (const [voice, cols] of Object.entries(VU_VOICE_COLS)) {
  for (const col of cols) {
    colToVoice.set(col, Number(voice));
  }
}

const borderColSet = new Set(VU_BORDER_COLS);

export function renderAmbientLed(options: AmbientLedOptions): void {
  const { col, el, glowColor, isHovered, mouse, rawTime, ripples, row, time } =
    options;
  el.style.backgroundColor = "";
  let brightness = computeAmbientBrightness(col, row, time);

  if (isHovered && mouse) {
    brightness += computeProximityBoost(
      col,
      row,
      mouse.col,
      mouse.row,
      ICON_PROXIMITY_RADIUS_SQ,
      ICON_PROXIMITY_INTENSITY,
    );
  }

  brightness += addRippleBoost(col, row, rawTime, ripples);
  applyLedStyle(el, brightness, glowColor);
}

export function renderVuLed(options: VuLedOptions): void {
  const {
    ambientMix,
    col,
    defaultGlowColor,
    el,
    rawTime,
    ripples,
    row,
    time,
    voiceBarHeights,
    voiceGlowColors,
    voicePeakRows,
  } = options;
  const voice = colToVoice.get(col);
  const isBorder = borderColSet.has(col);

  let brightness: number;
  let glowColor: string;

  if (isBorder) {
    brightness = VU_BORDER_BRIGHTNESS;
    glowColor = defaultGlowColor;
    el.style.backgroundColor = "";
  } else if (voice) {
    brightness = computeVuLedBrightness(
      row,
      voiceBarHeights[voice],
      voicePeakRows[voice],
    );
    glowColor = voiceGlowColors[voice] ?? defaultGlowColor;
    const alpha = brightness > VU_UNLIT_BRIGHTNESS ? brightness : 0.05;
    el.style.backgroundColor = `rgba(${glowColor}, ${alpha.toFixed(2)})`;
  } else {
    brightness = VU_UNLIT_BRIGHTNESS;
    glowColor = defaultGlowColor;
    el.style.backgroundColor = "";
  }

  if (ambientMix > 0) {
    const ambientBrightness = computeAmbientBrightness(col, row, time);
    brightness = brightness * (1 - ambientMix) + ambientBrightness * ambientMix;
    if (ambientMix > 0.5) {
      el.style.backgroundColor = "";
    }
  }

  brightness += addRippleBoost(col, row, rawTime, ripples);
  applyLedStyle(el, brightness, glowColor);
}

function addRippleBoost(
  col: number,
  row: number,
  rawTime: number,
  ripples: Ripple[],
): number {
  if (ripples.length === 0) return 0;
  return computeRippleBoost(
    col,
    row,
    rawTime,
    ripples,
    ICON_RIPPLE_SPEED,
    ICON_RIPPLE_WIDTH,
    ICON_RIPPLE_DURATION,
  );
}

function computeAmbientBrightness(
  col: number,
  row: number,
  time: number,
): number {
  const config = ICON_ROW_LFO_CONFIGS[row];
  return (
    ICON_BASE_MIN +
    computeBaseLfo(col, row, time, config, ICON_BASE_SCALE) * ICON_BASE_SCALE
  );
}
