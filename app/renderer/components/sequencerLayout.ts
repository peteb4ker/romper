import React from "react";

/**
 * Shared geometry for the step sequencer, so the slice strip's waveform can
 * line up with the step columns below it: at /16, slice n sits right above
 * step n.
 *
 * Pads scale with the window (CSS variables on the sequencer root); the
 * fixed columns either side of them are constants here.
 */

/** Width of the transport column (play, BPM, loop) and the gap after it. */
export const TRANSPORT_WIDTH = 88;
export const TRANSPORT_GAP = 12;
/** Row label chip, mute button, and the gaps after each. */
export const LABEL_WIDTH = 36;
export const LABEL_GAP = 6;
export const MUTE_WIDTH = 30;
export const MUTE_GAP = 12;
/** Space between pads, and between rows. */
export const PAD_GAP = 6;
export const ROW_GAP = 8;

/** From the sequencer block's left edge to the first pad. */
export const PADS_LEFT =
  TRANSPORT_WIDTH +
  TRANSPORT_GAP +
  LABEL_WIDTH +
  LABEL_GAP +
  MUTE_WIDTH +
  MUTE_GAP;

/**
 * CSS variables for the sequencer root. Pads grow with the window between
 * 32 px and 48 px wide, and stay a little shorter than wide (like a TR's
 * step keys) to leave room for the voice panels; `--seq-pitch` is one
 * step's width including its gap.
 */
export const SEQUENCER_VARS = {
  "--seq-gap": `${PAD_GAP}px`,
  "--seq-pad": "clamp(32px, calc((100vw - 600px) / 16 - 6px), 48px)",
  "--seq-pad-h": "clamp(32px, calc(var(--seq-pad) - 8px), 40px)",
  "--seq-pitch": "calc(var(--seq-pad) + var(--seq-gap))",
} as React.CSSProperties;

/** Left offset of step `step`'s column, from the first pad. */
export function stepOffset(step: number): string {
  return `calc(var(--seq-pitch) * ${step})`;
}

/** Width of all 16 step columns, each with its share of the gap. */
export const STEPS_SPAN = "calc(var(--seq-pitch) * 16)";

const PAD_HEIGHT_KEY = "romper.sequencer.padHeight";
const PAD_HEIGHT_MIN = 28;
const PAD_HEIGHT_MAX = 60;

/**
 * Pad height chosen by dragging the sequencer drawer's top edge (null: the
 * default, which follows the window). Dragging up makes the pads taller;
 * the four rows share the drag, so the edge follows the pointer. The choice
 * is remembered on this computer.
 */
export function usePadHeight() {
  const [value, setValue] = React.useState<null | number>(readPadHeight);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const pad = document.querySelector<HTMLElement>(
        '[data-testid="seq-step-0-0"]',
      );
      const startHeight = value ?? pad?.offsetHeight ?? 40;
      const startY = e.clientY;
      let latest = startHeight;
      const onMove = (move: PointerEvent) => {
        latest = Math.round(
          Math.min(
            PAD_HEIGHT_MAX,
            Math.max(PAD_HEIGHT_MIN, startHeight - (move.clientY - startY) / 4),
          ),
        );
        setValue(latest);
      };
      const onUp = () => {
        globalThis.removeEventListener("pointermove", onMove);
        globalThis.removeEventListener("pointerup", onUp);
        writePadHeight(latest);
      };
      globalThis.addEventListener("pointermove", onMove);
      globalThis.addEventListener("pointerup", onUp);
    },
    [value],
  );

  const reset = React.useCallback(() => {
    setValue(null);
    writePadHeight(null);
  }, []);

  const style = React.useMemo(
    () =>
      (value == null
        ? {}
        : { "--seq-pad-h": `${value}px` }) as React.CSSProperties,
    [value],
  );

  return {
    max: PAD_HEIGHT_MAX,
    min: PAD_HEIGHT_MIN,
    onPointerDown,
    reset,
    style,
    value,
  };
}

function readPadHeight(): null | number {
  try {
    const stored = Number(globalThis.localStorage?.getItem(PAD_HEIGHT_KEY));
    return stored >= PAD_HEIGHT_MIN && stored <= PAD_HEIGHT_MAX ? stored : null;
  } catch {
    return null;
  }
}

function writePadHeight(height: null | number) {
  try {
    if (height == null) globalThis.localStorage?.removeItem(PAD_HEIGHT_KEY);
    else globalThis.localStorage?.setItem(PAD_HEIGHT_KEY, String(height));
  } catch {
    // Storage unavailable: the size just isn't remembered
  }
}
