import { getVoiceLevel } from "./audioLevels";
import { ICON_ROWS } from "./ledIconConstants";
import {
  VU_AMPLIFICATION,
  VU_CROSSFADE_MS,
  VU_DECAY_RATE,
  VU_LIT_MAX_BRIGHTNESS,
  VU_LIT_MIN_BRIGHTNESS,
  VU_NOISE_FLOOR,
  VU_PEAK_BRIGHTNESS,
  VU_PEAK_DROP_INTERVAL,
  VU_PEAK_HOLD_FRAMES,
  VU_POWER_CURVE,
  VU_SILENCE_THRESHOLD,
  VU_UNLIT_BRIGHTNESS,
} from "./vuMeterConstants";

/**
 * Pure VU-meter state machine for the LED icon: per-voice level smoothing,
 * bar heights, peak hold/decay, and the VU-to-ambient cross-fade. No DOM
 * access — everything here is driven by the animation loop in
 * useLedVisualization and unit-testable in isolation.
 */

export interface CrossFadeState {
  ambientFade: number;
  vuInactiveSince: null | number;
  wasVuActive: boolean;
}

// Per-voice VU state
export interface VoiceVuState {
  peakDropCounter: number;
  peakHoldCounter: number;
  peakRow: number; // -1 = no peak
  smoothedLevel: number;
}

/** Compute smoothed level and bar height for a voice */
export function computeVoiceBar(state: VoiceVuState, voice: number): number {
  const level = getVoiceLevel(voice);
  const actualLevel = level ? Math.max(level.left, level.right) : 0;
  state.smoothedLevel = Math.max(
    actualLevel,
    state.smoothedLevel * VU_DECAY_RATE,
  );
  // Below noise floor = dead silence (0 bar height)
  if (state.smoothedLevel < VU_NOISE_FLOOR) return 0;
  const scaled = Math.pow(
    state.smoothedLevel * VU_AMPLIFICATION,
    VU_POWER_CURVE,
  );
  return Math.min(ICON_ROWS, Math.max(0, scaled * ICON_ROWS));
}

/** Compute VU brightness for a single LED */
export function computeVuLedBrightness(
  row: number,
  barHeight: number,
  peakRow: number,
): number {
  const litThreshold = ICON_ROWS - barHeight;
  const isLit = row >= litThreshold;
  const isPeak = row === peakRow && peakRow >= 0;

  if (isPeak) return VU_PEAK_BRIGHTNESS;
  if (isLit) {
    const posInBar =
      barHeight > 0 ? (ICON_ROWS - 1 - row) / (ICON_ROWS - 1) : 0;
    return (
      VU_LIT_MIN_BRIGHTNESS +
      posInBar * (VU_LIT_MAX_BRIGHTNESS - VU_LIT_MIN_BRIGHTNESS)
    );
  }
  return VU_UNLIT_BRIGHTNESS;
}

export function decayPeak(state: VoiceVuState): void {
  if (state.peakHoldCounter > 0) {
    state.peakHoldCounter--;
    return;
  }
  state.peakDropCounter++;
  if (state.peakDropCounter >= VU_PEAK_DROP_INTERVAL) {
    state.peakDropCounter = 0;
    state.peakRow++;
    if (state.peakRow >= ICON_ROWS) {
      state.peakRow = -1;
    }
  }
}

export function getVuState(
  states: Record<number, VoiceVuState>,
  voice: number,
): VoiceVuState {
  if (!states[voice]) {
    states[voice] = initVuState();
  }
  return states[voice];
}

export function initVuState(): VoiceVuState {
  return {
    peakDropCounter: 0,
    peakHoldCounter: 0,
    peakRow: -1,
    smoothedLevel: 0,
  };
}

export function updateCrossFade(
  cf: CrossFadeState,
  vuActive: boolean,
  rawTime: number,
  vuStates: Record<number, VoiceVuState>,
): void {
  if (vuActive) {
    cf.wasVuActive = true;
    cf.vuInactiveSince = null;
    cf.ambientFade = 0;
    return;
  }

  if (!cf.wasVuActive) {
    cf.ambientFade = 1;
    return;
  }

  const allDecayed = Object.values(vuStates).every(
    (s) => s.smoothedLevel < VU_SILENCE_THRESHOLD,
  );
  if (!allDecayed) return;

  cf.vuInactiveSince ??= rawTime;
  const elapsed = (rawTime - cf.vuInactiveSince) * 1000;
  cf.ambientFade = Math.min(1, elapsed / VU_CROSSFADE_MS);
  if (cf.ambientFade >= 1) {
    cf.wasVuActive = false;
    cf.vuInactiveSince = null;
  }
}

/** Update peak hold/drop state and return current peak row */
export function updatePeakState(state: VoiceVuState, barHeight: number): void {
  const currentTopRow = ICON_ROWS - Math.ceil(barHeight);

  if (barHeight > 0 && currentTopRow <= state.peakRow) {
    state.peakRow = currentTopRow;
    state.peakHoldCounter = VU_PEAK_HOLD_FRAMES;
    state.peakDropCounter = 0;
    return;
  }

  if (state.peakRow >= 0) {
    decayPeak(state);
    return;
  }

  if (barHeight > 0) {
    state.peakRow = currentTopRow;
    state.peakHoldCounter = VU_PEAK_HOLD_FRAMES;
    state.peakDropCounter = 0;
  }
}
