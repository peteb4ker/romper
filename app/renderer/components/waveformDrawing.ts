import { type RefObject, useCallback, useRef } from "react";

/** The playhead line's color (orange-400) */
export const PLAYHEAD_COLOR = "#f59e42";

/** A sample's envelope, drawn once for its buffer, color and size */
interface EnvelopeImage {
  buffer: AudioBuffer;
  color: string;
  height: number;
  image: HTMLCanvasElement;
  width: number;
}

// Build min/max envelope arrays for waveform rendering
export function buildEnvelope(
  data: Float32Array,
  width: number,
  step: number,
  amp: number,
): { bottoms: Float32Array; tops: Float32Array } {
  const tops = new Float32Array(width);
  const bottoms = new Float32Array(width);
  for (let i = 0; i < width; i++) {
    let max = -1,
      min = 1;
    for (let j = 0; j < step; j++) {
      const datum = data[i * step + j] || 0;
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    tops[i] = (1 + max) * amp;
    bottoms[i] = (1 + min) * amp;
  }
  return { bottoms, tops };
}

/** Draw a sample's envelope (top/bottom outline with fill) */
export function drawEnvelope(
  ctx: CanvasRenderingContext2D,
  buffer: AudioBuffer,
  color: string,
  w: number,
  h: number,
): void {
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / w);
  const amp = h / 2;

  const { bottoms, tops } = buildEnvelope(data, w, step, amp);

  // Draw filled envelope
  ctx.beginPath();
  tracePath(ctx, tops);
  for (let i = w - 1; i >= 0; i--) {
    ctx.lineTo(i, bottoms[i]);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.fill();

  // Draw edge strokes
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  tracePath(ctx, tops);
  ctx.stroke();
  ctx.beginPath();
  tracePath(ctx, bottoms);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// Resolve a color value that may be a CSS var() reference into a raw color
// string usable by canvas APIs. Falls back to accent-primary or a default blue.
export function resolveWaveformColor(voiceColor?: string): string {
  if (voiceColor) {
    const varMatch = /^var\((.+)\)$/.exec(voiceColor);
    if (varMatch) {
      const resolved = getComputedStyle(document.documentElement)
        .getPropertyValue(varMatch[1])
        .trim();
      if (resolved) return resolved;
    }
    return voiceColor;
  }
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue("--accent-primary").trim() || "#2889be";
}

/**
 * Draws a slot's waveform: the sample's envelope and, while it plays, the
 * playhead. The envelope is drawn once per sample, color and size into an
 * offscreen canvas of the same size, and each frame copies it and draws the
 * playhead line over it, so a playing frame neither rebuilds the envelope
 * nor reads computed styles (RE-46).
 *
 * `paint(buffer, null)` (stopped) resolves the voice color first, and
 * `paint(buffer, position)` (playing, 0..1) uses the last one resolved.
 * The waveform paints stopped when it loads, starts playing and stops, so
 * colors are read then, as they were before; never per frame.
 */
export function useWaveformPainter(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  voiceColor?: string,
): (buffer: AudioBuffer, playhead: null | number) => void {
  // The resolved color, and the voice color it was resolved for
  const colorRef = useRef<{ for?: string; value: string } | null>(null);
  const envelopeRef = useRef<EnvelopeImage | null>(null);

  return useCallback(
    (buffer: AudioBuffer, playhead: null | number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      let resolved = colorRef.current;
      if (!resolved || playhead === null || resolved.for !== voiceColor) {
        resolved = { for: voiceColor, value: resolveWaveformColor(voiceColor) };
        colorRef.current = resolved;
      }
      const color = resolved.value;
      let envelope = envelopeRef.current;
      if (
        envelope?.buffer !== buffer ||
        envelope.color !== color ||
        envelope.width !== w ||
        envelope.height !== h
      ) {
        envelope = renderEnvelope(buffer, color, w, h);
        envelopeRef.current = envelope;
      }

      ctx.clearRect(0, 0, w, h);
      if (envelope) ctx.drawImage(envelope.image, 0, 0);
      if (playhead === null) return;
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.beginPath();
      const x = Math.floor(playhead * w);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    },
    [canvasRef, voiceColor],
  );
}

/** Draw the envelope into a new offscreen canvas of the waveform's size */
function renderEnvelope(
  buffer: AudioBuffer,
  color: string,
  width: number,
  height: number,
): EnvelopeImage | null {
  const image = document.createElement("canvas");
  image.width = width;
  image.height = height;
  const ctx = image.getContext("2d");
  if (!ctx) return null;
  drawEnvelope(ctx, buffer, color, width, height);
  return { buffer, color, height, image, width };
}

// Trace a canvas path through an array of y-values
function tracePath(ctx: CanvasRenderingContext2D, values: Float32Array): void {
  for (let i = 0; i < values.length; i++) {
    if (i === 0) ctx.moveTo(i, values[i]);
    else ctx.lineTo(i, values[i]);
  }
}
