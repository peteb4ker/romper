import { useCallback, useEffect, useRef } from "react";

import type { Ripple } from "./ledMath";

import {
  BASE_MIN,
  BASE_SCALE,
  LED_COLS,
  LED_COUNT,
  MAX_RIPPLES,
  PROXIMITY_INTENSITY,
  PROXIMITY_RADIUS_SQ,
  RIPPLE_DURATION,
  RIPPLE_SPEED,
  RIPPLE_WIDTH,
  ROW_LFO_CONFIGS,
} from "./ledConstants";
import {
  applyLedStyle,
  computeBaseLfo,
  computeProximityBoost,
  computeRippleBoost,
  readGlowColor,
} from "./ledMath";

interface UseLedAnimationReturn {
  addRipple: (col: number, row: number) => void;
  clearMousePosition: () => void;
  ledRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  setMousePosition: (col: number, row: number) => void;
}

export function useLedAnimation(): UseLedAnimationReturn {
  const ledRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseRef = useRef<{ col: number; row: number } | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const rafRef = useRef<null | number>(null);
  const glowColorRef = useRef<string>("224, 90, 96");

  // Read the --voice-1 CSS color once on mount
  useEffect(() => {
    glowColorRef.current = readGlowColor();
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const time = performance.now() / 1000;
      const mouse = mouseRef.current;

      // Prune expired ripples
      ripplesRef.current = ripplesRef.current.filter(
        (r) => time - r.startTime < RIPPLE_DURATION,
      );

      for (let i = 0; i < LED_COUNT; i++) {
        const el = ledRefs.current[i];
        if (!el) continue;

        const col = i % LED_COLS;
        const row = Math.floor(i / LED_COLS);
        const config = ROW_LFO_CONFIGS[row];

        // Base LFO brightness
        let brightness =
          BASE_MIN +
          computeBaseLfo(col, row, time, config, BASE_SCALE) * BASE_SCALE;

        // Mouse proximity boost
        if (mouse) {
          brightness += computeProximityBoost(
            col,
            row,
            mouse.col,
            mouse.row,
            PROXIMITY_RADIUS_SQ,
            PROXIMITY_INTENSITY,
          );
        }

        // Ripple boost
        if (ripplesRef.current.length > 0) {
          brightness += computeRippleBoost(
            col,
            row,
            time,
            ripplesRef.current,
            RIPPLE_SPEED,
            RIPPLE_WIDTH,
            RIPPLE_DURATION,
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
  }, []);

  const setMousePosition = useCallback((col: number, row: number) => {
    mouseRef.current = { col, row };
  }, []);

  const clearMousePosition = useCallback(() => {
    mouseRef.current = null;
  }, []);

  const addRipple = useCallback((col: number, row: number) => {
    const time = performance.now() / 1000;
    ripplesRef.current = [
      ...ripplesRef.current.slice(-(MAX_RIPPLES - 1)),
      { col, row, startTime: time },
    ];
  }, []);

  return { addRipple, clearMousePosition, ledRefs, setMousePosition };
}
