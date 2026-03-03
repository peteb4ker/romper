// Pure math functions for LED grid animation (easily testable)

import type { RowLfoConfig, WaveType } from "./ledConstants";

export interface Ripple {
  col: number;
  row: number;
  startTime: number;
}

/**
 * Apply brightness to an LED element via direct DOM mutation.
 * Sets opacity and adds glow box-shadow for bright LEDs.
 */
export function applyLedStyle(
  el: HTMLElement,
  brightness: number,
  glowColor: string,
): void {
  const clamped = Math.min(1, Math.max(0, brightness));
  el.style.opacity = String(clamped);
  if (clamped > 0.5) {
    const glowIntensity = (clamped - 0.5) * 2;
    const spread = Math.round(glowIntensity * 4);
    el.style.boxShadow = `0 0 ${spread}px ${Math.round(spread * 0.5)}px rgba(${glowColor}, ${(glowIntensity * 0.6).toFixed(2)})`;
  } else {
    el.style.boxShadow = "none";
  }
}

/**
 * Compute base LFO brightness for a single LED.
 * Returns 0..1 (before min/max scaling).
 */
export function computeBaseLfo(
  col: number,
  row: number,
  time: number,
  config: RowLfoConfig,
  _scale: number,
): number {
  const t = time * config.frequency + config.phase + col * config.spatialFreq;
  // Mix in a subtle row-dependent offset for visual variety
  const rowOffset = row * 0.1;
  return waveFunction(config.wave, t + rowOffset);
}

/**
 * Compute proximity brightness boost from mouse position.
 * Uses gaussian-like falloff based on squared distance.
 * Returns 0..intensity.
 */
export function computeProximityBoost(
  col: number,
  row: number,
  mouseCol: number,
  mouseRow: number,
  radiusSq: number,
  intensity: number,
): number {
  const dx = col - mouseCol;
  const dy = row - mouseRow;
  const distSq = dx * dx + dy * dy;
  if (distSq > radiusSq) return 0;
  // Gaussian-like falloff
  const falloff = Math.exp((-distSq * 3) / radiusSq);
  return falloff * intensity;
}

/**
 * Compute ripple brightness boost from active ripples.
 * Each ripple is an expanding ring that fades over time.
 * Returns 0..1.
 */
export function computeRippleBoost(
  col: number,
  row: number,
  time: number,
  ripples: Ripple[],
  speed: number,
  width: number,
  duration: number,
): number {
  let boost = 0;
  for (const ripple of ripples) {
    const elapsed = time - ripple.startTime;
    if (elapsed < 0 || elapsed > duration) continue;
    const radius = elapsed * speed;
    const dx = col - ripple.col;
    const dy = row - ripple.row;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ringDist = Math.abs(dist - radius);
    if (ringDist < width) {
      const ringIntensity = 1 - ringDist / width;
      const fadeOut = 1 - elapsed / duration;
      boost = Math.max(boost, ringIntensity * fadeOut);
    }
  }
  return boost;
}

/**
 * Read the --voice-1 CSS variable and return as "R, G, B" string for box-shadow.
 * Falls back to default warm red if not found.
 */
export function readGlowColor(): string {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const voice1 = style.getPropertyValue("--voice-1").trim();
  if (voice1) {
    const hex = voice1.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
  }
  return "224, 90, 96";
}

/** Sawtooth wave: 0..1 */
export function saw(t: number): number {
  return ((t % 1) + 1) % 1;
}

/** Sine wave: 0..1 */
export function sine(t: number): number {
  return (Math.sin(t * Math.PI * 2) + 1) * 0.5;
}

/** Triangle wave: 0..1 */
export function triangle(t: number): number {
  const wrapped = ((t % 1) + 1) % 1;
  return wrapped < 0.5 ? wrapped * 2 : 2 - wrapped * 2;
}

/** Dispatch to wave function by type */
export function waveFunction(type: WaveType, t: number): number {
  switch (type) {
    case "saw":
      return saw(t);
    case "sine":
      return sine(t);
    case "triangle":
      return triangle(t);
  }
}
