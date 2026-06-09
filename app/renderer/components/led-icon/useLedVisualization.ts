import { useCallback, useEffect, useRef } from "react";

import type { Ripple } from "../dialogs/led-grid/ledMath";
import type { CrossFadeState, VoiceVuState } from "./vuMeterState";

import { readGlowColor, readVoiceGlowColor } from "../dialogs/led-grid/ledMath";
import { hasActiveVoices } from "./audioLevels";
import {
  ICON_COLS,
  ICON_LED_COUNT,
  ICON_MAX_RIPPLES,
  ICON_RIPPLE_DURATION,
  ICON_TIME_HOVER,
  ICON_TIME_IDLE,
} from "./ledIconConstants";
import { renderAmbientLed, renderVuLed } from "./ledRenderers";
import {
  computeVoiceBar,
  getVuState,
  updateCrossFade,
  updatePeakState,
} from "./vuMeterState";

// Re-export the pure VU state machine for existing consumers/tests
export type { CrossFadeState, VoiceVuState } from "./vuMeterState";

export {
  computeVoiceBar,
  computeVuLedBrightness,
  decayPeak,
  getVuState,
  initVuState,
  updateCrossFade,
  updatePeakState,
} from "./vuMeterState";

interface UseLedVisualizationReturn {
  addRipple: (col: number, row: number) => void;
  clearMousePosition: () => void;
  ledRefs: React.RefObject<(HTMLDivElement | null)[]>;
  setMousePosition: (col: number, row: number) => void;
}

/**
 * Animation loop for the LED icon. Owns the rAF driver, time/hover speed
 * handling, and the pointer/ripple interaction API; per-frame VU state comes
 * from vuMeterState and per-LED painting from ledRenderers.
 */
export function useLedVisualization(
  isHoveredRef: React.RefObject<boolean>,
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

      lastRawTimeRef.current ??= rawTime;
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
          renderVuLed({
            ambientMix: crossFadeRef.current.ambientFade,
            col,
            defaultGlowColor: glowColorRef.current,
            el,
            rawTime,
            ripples: ripplesRef.current,
            row,
            time,
            voiceBarHeights,
            voiceGlowColors: voiceGlowColorsRef.current,
            voicePeakRows,
          });
        } else {
          renderAmbientLed({
            col,
            el,
            glowColor: glowColorRef.current,
            isHovered: isHoveredRef.current,
            mouse,
            rawTime,
            ripples: ripplesRef.current,
            row,
            time,
          });
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
