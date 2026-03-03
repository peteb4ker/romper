import { useCallback, useEffect, useRef } from "react";

import type { Ripple } from "../dialogs/led-grid/ledMath";

import {
  applyLedStyle,
  computeBaseLfo,
  computeProximityBoost,
  computeRippleBoost,
  readGlowColor,
} from "../dialogs/led-grid/ledMath";
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
  ICON_TIME_HOVER,
  ICON_TIME_IDLE,
} from "./ledIconConstants";

interface UseMiniLedAnimationReturn {
  addRipple: (col: number, row: number) => void;
  clearMousePosition: () => void;
  ledRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  setMousePosition: (col: number, row: number) => void;
}

export function useMiniLedAnimation(
  isHoveredRef: React.MutableRefObject<boolean>,
): UseMiniLedAnimationReturn {
  const ledRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseRef = useRef<{ col: number; row: number } | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const rafRef = useRef<null | number>(null);
  const glowColorRef = useRef<string>("224, 90, 96");
  // Accumulated "animation time" that runs at different speeds
  const animTimeRef = useRef<number>(0);
  const lastRawTimeRef = useRef<null | number>(null);

  useEffect(() => {
    glowColorRef.current = readGlowColor();
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const rawTime = performance.now() / 1000;
      const mouse = mouseRef.current;

      // Compute delta and accumulate with time multiplier
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

      // Prune expired ripples (use raw time for ripple timing)
      ripplesRef.current = ripplesRef.current.filter(
        (r) => rawTime - r.startTime < ICON_RIPPLE_DURATION,
      );

      for (let i = 0; i < ICON_LED_COUNT; i++) {
        const el = ledRefs.current[i];
        if (!el) continue;

        const col = i % ICON_COLS;
        const row = Math.floor(i / ICON_COLS);
        const config = ICON_ROW_LFO_CONFIGS[row];

        // Base LFO brightness
        let brightness =
          ICON_BASE_MIN +
          computeBaseLfo(col, row, time, config, ICON_BASE_SCALE) *
            ICON_BASE_SCALE;

        // Mouse proximity boost (only when hovered)
        if (isHoveredRef.current && mouse) {
          brightness += computeProximityBoost(
            col,
            row,
            mouse.col,
            mouse.row,
            ICON_PROXIMITY_RADIUS_SQ,
            ICON_PROXIMITY_INTENSITY,
          );
        }

        // Ripple boost (always, for click feedback)
        if (ripplesRef.current.length > 0) {
          brightness += computeRippleBoost(
            col,
            row,
            rawTime,
            ripplesRef.current,
            ICON_RIPPLE_SPEED,
            ICON_RIPPLE_WIDTH,
            ICON_RIPPLE_DURATION,
          );
        }

        applyLedStyle(el, brightness, glowColorRef.current);
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
