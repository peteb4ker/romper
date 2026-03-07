import { useCallback, useEffect, useRef } from "react";

import type { Ripple } from "../dialogs/led-grid/ledMath";

import {
  applyLedStyle,
  computeBaseLfo,
  computeProximityBoost,
  computeRippleBoost,
  readGlowColor,
  readVoiceGlowColor,
} from "../dialogs/led-grid/ledMath";
import { getVoiceLevel, hasActiveVoices } from "./audioLevels";
import {
  ICON_BASE_MIN,
  ICON_BASE_SCALE,
  ICON_COLS,
  ICON_LED_COUNT,
  ICON_MAX_RIPPLES,
  ICON_PROXIMITY_INTENSITY,
  ICON_PROXIMITY_RADIUS_SQ,
  ICON_RIPPLE_DURATION,
  ICON_RIPPLE_SPEED,
  ICON_RIPPLE_WIDTH,
  ICON_ROW_LFO_CONFIGS,
  ICON_ROWS,
  ICON_TIME_HOVER,
  ICON_TIME_IDLE,
} from "./ledIconConstants";
import {
  VU_AMPLIFICATION,
  VU_BORDER_BRIGHTNESS,
  VU_BORDER_COLS,
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
  VU_VOICE_COLS,
} from "./vuMeterConstants";

export type VisualizationMode = "classic" | "screensaver";

interface UseLedVisualizationReturn {
  addRipple: (col: number, row: number) => void;
  clearMousePosition: () => void;
  ledRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  setMousePosition: (col: number, row: number) => void;
}

// Per-voice VU state
interface VoiceVuState {
  peakDropCounter: number;
  peakHoldCounter: number;
  peakRow: number; // -1 = no peak
  smoothedLevel: number;
}

// Build column-to-voice lookup table
const colToVoice = new Map<number, number>();
for (const [voice, cols] of Object.entries(VU_VOICE_COLS)) {
  for (const col of cols) {
    colToVoice.set(col, Number(voice));
  }
}

const borderColSet = new Set(VU_BORDER_COLS);

interface CrossFadeState {
  ambientFade: number;
  vuInactiveSince: null | number;
  wasVuActive: boolean;
}

export function useLedVisualization(
  isHoveredRef: React.MutableRefObject<boolean>,
): UseLedVisualizationReturn {
  const ledRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseRef = useRef<{ col: number; row: number } | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const rafRef = useRef<null | number>(null);
  const glowColorRef = useRef<string>("224, 90, 96");
  const voiceGlowColorsRef = useRef<Record<number, string>>({});
  const animTimeRef = useRef<number>(0);
  const lastRawTimeRef = useRef<null | number>(null);
  const vuStateRef = useRef<Record<number, VoiceVuState>>({});
  const crossFadeRef = useRef<CrossFadeState>({
    ambientFade: 1,
    vuInactiveSince: null,
    wasVuActive: false,
  });

  useEffect(() => {
    glowColorRef.current = readGlowColor();
    for (let v = 1; v <= 4; v++) {
      voiceGlowColorsRef.current[v] = readVoiceGlowColor(v);
    }
  }, []);

  useEffect(() => {
    const animate = () => {
      const rawTime = performance.now() / 1000;
      const mouse = mouseRef.current;

      if (lastRawTimeRef.current === null) {
        lastRawTimeRef.current = rawTime;
      }
      const delta = rawTime - lastRawTimeRef.current;
      lastRawTimeRef.current = rawTime;
      const multiplier = isHoveredRef.current
        ? ICON_TIME_HOVER
        : ICON_TIME_IDLE;
      animTimeRef.current += delta * multiplier;
      const time = animTimeRef.current;

      ripplesRef.current = ripplesRef.current.filter(
        (r) => rawTime - r.startTime < ICON_RIPPLE_DURATION,
      );

      const vuActive = hasActiveVoices();
      const voiceBarHeights: Record<number, number> = {};
      const voicePeakRows: Record<number, number> = {};

      // When all voices stop, reset VU state immediately (no lingering decay)
      if (!vuActive && crossFadeRef.current.wasVuActive) {
        for (const state of Object.values(vuStateRef.current)) {
          state.smoothedLevel = 0;
          state.peakRow = -1;
          state.peakHoldCounter = 0;
          state.peakDropCounter = 0;
        }
      }

      for (let v = 1; v <= 4; v++) {
        const state = getVuState(vuStateRef.current, v);
        const barHeight = computeVoiceBar(state, v);
        voiceBarHeights[v] = barHeight;
        updatePeakState(state, barHeight);
        voicePeakRows[v] = state.peakRow;
      }

      updateCrossFade(
        crossFadeRef.current,
        vuActive,
        rawTime,
        vuStateRef.current,
      );
      const isVuMode = crossFadeRef.current.ambientFade < 1;

      for (let i = 0; i < ICON_LED_COUNT; i++) {
        const el = ledRefs.current[i];
        if (!el) continue;

        const col = i % ICON_COLS;
        const row = Math.floor(i / ICON_COLS);

        if (isVuMode) {
          renderVuLed(
            el,
            col,
            row,
            time,
            rawTime,
            voiceBarHeights,
            voicePeakRows,
            crossFadeRef.current.ambientFade,
            glowColorRef.current,
            voiceGlowColorsRef.current,
            ripplesRef.current,
          );
        } else {
          renderAmbientLed(
            el,
            col,
            row,
            time,
            rawTime,
            isHoveredRef.current,
            mouse,
            glowColorRef.current,
            ripplesRef.current,
          );
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isHoveredRef]);

  const setMousePosition = useCallback((col: number, row: number) => {
    mouseRef.current = { col, row };
  }, []);

  const clearMousePosition = useCallback(() => {
    mouseRef.current = null;
  }, []);

  const addRipple = useCallback((col: number, row: number) => {
    const time = performance.now() / 1000;
    ripplesRef.current = [
      ...ripplesRef.current.slice(-(ICON_MAX_RIPPLES - 1)),
      { col, row, startTime: time },
    ];
  }, []);

  return { addRipple, clearMousePosition, ledRefs, setMousePosition };
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

/** Compute smoothed level and bar height for a voice */
function computeVoiceBar(state: VoiceVuState, voice: number): number {
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
function computeVuLedBrightness(
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

function decayPeak(state: VoiceVuState): void {
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

function getVuState(
  states: Record<number, VoiceVuState>,
  voice: number,
): VoiceVuState {
  if (!states[voice]) {
    states[voice] = initVuState();
  }
  return states[voice];
}

function initVuState(): VoiceVuState {
  return {
    peakDropCounter: 0,
    peakHoldCounter: 0,
    peakRow: -1,
    smoothedLevel: 0,
  };
}

function renderAmbientLed(
  el: HTMLElement,
  col: number,
  row: number,
  time: number,
  rawTime: number,
  isHovered: boolean,
  mouse: { col: number; row: number } | null,
  glowColor: string,
  ripples: Ripple[],
): void {
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

function renderVuLed(
  el: HTMLElement,
  col: number,
  row: number,
  time: number,
  rawTime: number,
  voiceBarHeights: Record<number, number>,
  voicePeakRows: Record<number, number>,
  ambientMix: number,
  defaultGlowColor: string,
  voiceGlowColors: Record<number, string>,
  ripples: Ripple[],
): void {
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

function updateCrossFade(
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

  if (cf.vuInactiveSince === null) {
    cf.vuInactiveSince = rawTime;
  }
  const elapsed = (rawTime - cf.vuInactiveSince) * 1000;
  cf.ambientFade = Math.min(1, elapsed / VU_CROSSFADE_MS);
  if (cf.ambientFade >= 1) {
    cf.wasVuActive = false;
    cf.vuInactiveSince = null;
  }
}

/** Update peak hold/drop state and return current peak row */
function updatePeakState(state: VoiceVuState, barHeight: number): void {
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
