import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  DiceFiveIcon,
  ScissorsIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  MAX_LENGTH_OPTIONS,
  ROLL_AMOUNTS,
  SLICER_DIVISIONS,
  type SlicerDivision,
  type VoiceSliceSettings,
} from "@romper/shared/sliceTypes";
import React from "react";

import type { SliceView } from "./hooks/shared/sliceConstants";

import { usePopoverDismiss } from "./hooks/shared/usePopoverDismiss";

const WAVE_COLUMNS = 512;

export interface SliceStripProps {
  /** Whether the kit's next undo is a sequencer edit (a roll, a slice…). */
  canUndo: boolean;
  division: SlicerDivision;
  editingVoice: number;
  hoverView: null | SliceView;
  kitName: string;
  notice?: null | string;
  onAssign: (startSlice: number, lengthSlices: number) => void;
  onAudition: (startSlice: number, lengthSlices: number) => void;
  /** Hide the strip. Sliced voices keep playing their slices. */
  onClose: () => void;
  onDivisionChange: (division: SlicerDivision) => void;
  onRoll: () => void;
  onSelectVoice: (voiceNumber: number) => void;
  onSettingsChange: (update: Partial<VoiceSliceSettings>) => void;
  onUndo: () => void;
  playingView: null | SliceView;
  sampleName: null | string;
  selectedStep: null | number;
  selectedStepRandom: boolean;
  selectedView: null | SliceView;
  settings: VoiceSliceSettings;
  sliceVoices: number[];
  slotIndex: null | number;
  usedSlices: Set<number>;
  voiceLabel: string;
  /** Places the waveform so its slices line up with the step columns. */
  waveformStyle?: React.CSSProperties;
}

/** Tell the user what to do next, based on what is selected. */
export function sliceHint(
  props: Pick<
    SliceStripProps,
    | "sampleName"
    | "selectedStep"
    | "selectedStepRandom"
    | "selectedView"
    | "voiceLabel"
  >,
): string {
  const { sampleName, selectedStep, selectedStepRandom, selectedView } = props;
  if (!sampleName) {
    return `Voice ${props.voiceLabel} has no sample to slice. Drop a long sample into one of its slots.`;
  }
  if (selectedStep == null || !selectedView) {
    return "Click a step in the ✂ row, then click a slice here to choose what it plays.";
  }
  if (selectedStepRandom) {
    return `Step ${selectedStep + 1} picks a random slice each time it plays. Click a slice to fix it to one.`;
  }
  return `Step ${selectedStep + 1} plays ${spanText(selectedView)}. Click a slice to change it, drag across slices for a longer hit, or 🎲 Roll for surprises. Click the step again to turn it off.`;
}

/** Interleaved [min, max] per column, in -1 … 1. */
function buildPeaks(data: Float32Array, columns: number): Float32Array {
  const peaks = new Float32Array(columns * 2);
  const step = Math.max(1, Math.floor(data.length / columns));
  for (let c = 0; c < columns; c++) {
    let min = 0;
    let max = 0;
    const end = Math.min(data.length, (c + 1) * step);
    for (let i = c * step; i < end; i++) {
      const d = data[i];
      if (d < min) min = d;
      if (d > max) max = d;
    }
    peaks[c * 2] = min;
    peaks[c * 2 + 1] = max;
  }
  return peaks;
}

function drawPeaks(
  canvas: HTMLCanvasElement | null,
  peaks: Float32Array | null,
  color: string,
) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!peaks) return;
  const columns = peaks.length / 2;
  const mid = canvas.height / 2;
  const colWidth = canvas.width / columns;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  for (let c = 0; c < columns; c++) {
    const top = mid - peaks[c * 2 + 1] * mid;
    const bottom = mid - peaks[c * 2] * mid;
    ctx.fillRect(
      c * colWidth,
      top,
      Math.max(1, colWidth),
      Math.max(1, bottom - top),
    );
  }
  ctx.globalAlpha = 1;
}

/** Label every slice up to /24, then thin out so numbers stay readable. */
function labelEvery(division: number): number {
  if (division <= 24) return 1;
  if (division <= 32) return 2;
  if (division <= 64) return 4;
  return 8;
}

function resolveCssVar(name: string): string {
  if (typeof getComputedStyle !== "function") return "#888";
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    "#888"
  );
}

/** The strip header's sample name, with its slot number when known. */
function sampleLabel(sampleName: null | string, slotIndex: null | number) {
  if (!sampleName) return "no sample";
  if (slotIndex == null) return sampleName;
  return `${sampleName} (slot ${slotIndex + 1})`;
}

function spanText(view: SliceView): string {
  const first = view.startSlice + 1;
  return view.lengthSlices > 1
    ? `slices ${first}–${first + view.lengthSlices - 1}`
    : `slice ${first}`;
}

/** Decode a slot's audio into a min/max envelope for drawing. */
function useWaveformPeaks(
  kitName: string,
  voiceNumber: number,
  slotIndex: null | number,
): Float32Array | null {
  const [peaks, setPeaks] = React.useState<Float32Array | null>(null);
  const cacheRef = React.useRef(new Map<string, Float32Array>());

  React.useEffect(() => {
    if (slotIndex == null) {
      setPeaks(null);
      return;
    }
    const key = `${kitName}:${voiceNumber}:${slotIndex}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setPeaks(cached);
      return;
    }
    setPeaks(null);
    const api = globalThis.electronAPI;
    const OfflineCtx = globalThis.OfflineAudioContext;
    if (!api?.getSampleAudioBuffer || !OfflineCtx) return;

    let cancelled = false;
    api
      .getSampleAudioBuffer(kitName, voiceNumber, slotIndex)
      .then(async (result) => {
        if (cancelled || !result.success || !result.data) return;
        const ctx = new OfflineCtx(1, 1, 44100);
        const buffer = await ctx.decodeAudioData(result.data.slice(0));
        if (cancelled) return;
        const next = buildPeaks(buffer.getChannelData(0), WAVE_COLUMNS);
        cacheRef.current.set(key, next);
        setPeaks(next);
      })
      .catch((err) => {
        console.warn("[SliceStrip] Could not load waveform:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [kitName, voiceNumber, slotIndex]);

  return peaks;
}

const selectClass =
  "h-6 px-1 text-xs rounded border border-border-default bg-surface-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary";
const buttonClass =
  "btn-secondary h-6 px-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary";

/** Roll settings, behind a small menu next to Roll: how much a roll
 * changes and whether it varies slice length. */
const RollOptions: React.FC<{
  onSettingsChange: (update: Partial<VoiceSliceSettings>) => void;
  settings: VoiceSliceSettings;
}> = ({ onSettingsChange, settings }) => {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  usePopoverDismiss(menuRef, close, open);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-label="Roll options"
        className={`${buttonClass} px-1.5`}
        data-testid="slice-roll-options"
        onClick={() => setOpen((o) => !o)}
        title={`Roll options: ${settings.rollAmount}% of steps${settings.varyLength ? `, lengths up to ${settings.maxLength}` : ""}`}
        type="button"
      >
        <CaretDownIcon size={12} weight="bold" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 flex flex-col gap-2 p-3 rounded-lg border border-border-strong bg-surface-2 shadow-lg text-xs whitespace-nowrap"
          data-testid="slice-roll-options-menu"
          role="dialog"
        >
          <label
            className="flex items-center gap-1 text-text-secondary"
            title="How many of the row's steps a roll changes"
          >
            <span>Amount</span>
            <select
              aria-label="Roll amount"
              className={selectClass}
              data-testid="slice-roll-amount"
              onChange={(e) =>
                onSettingsChange({ rollAmount: Number(e.target.value) })
              }
              value={settings.rollAmount}
            >
              {ROLL_AMOUNTS.map((a) => (
                <option key={a} value={a}>
                  {a}%
                </option>
              ))}
            </select>
          </label>
          <label
            className="flex items-center gap-1 text-text-secondary"
            title="Rolls and random steps also pick a random length"
          >
            <input
              checked={settings.varyLength}
              data-testid="slice-vary-length"
              onChange={(e) =>
                onSettingsChange({ varyLength: e.target.checked })
              }
              type="checkbox"
            />
            <span>Vary length</span>
          </label>
          <label
            className="flex items-center gap-1 text-text-secondary"
            title="Longest random length, in slices"
          >
            <span>up to</span>
            <select
              aria-label="Maximum random length"
              className={selectClass}
              data-testid="slice-max-length"
              disabled={!settings.varyLength}
              onChange={(e) =>
                onSettingsChange({ maxLength: Number(e.target.value) })
              }
              value={settings.maxLength}
            >
              {MAX_LENGTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
};

/**
 * Waveform strip above the sequencer grid for the voice being sliced:
 * shows the slices, lets you point the selected step at a slice (click)
 * or span (drag), and holds the division and dice controls.
 */
const SliceStrip: React.FC<SliceStripProps> = (props) => {
  const {
    canUndo,
    division,
    editingVoice,
    hoverView,
    kitName,
    notice,
    onAssign,
    onAudition,
    onClose,
    onDivisionChange,
    onRoll,
    onSelectVoice,
    onSettingsChange,
    onUndo,
    playingView,
    sampleName,
    selectedView,
    settings,
    sliceVoices,
    slotIndex,
    usedSlices,
    voiceLabel,
    waveformStyle,
  } = props;

  const voiceColor = `var(--voice-${editingVoice})`;
  const peaks = useWaveformPeaks(kitName, editingVoice, slotIndex);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    drawPeaks(
      canvasRef.current,
      peaks,
      resolveCssVar(`--voice-${editingVoice}`),
    );
  }, [peaks, editingVoice]);

  // Drag across slices to choose a span
  const areaRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<{
    alt: boolean;
    anchor: number;
    current: number;
  } | null>(null);

  const sliceAt = (clientX: number): null | number => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(division - 1, Math.max(0, Math.floor(ratio * division)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !sampleName) return;
    const slice = sliceAt(e.clientX);
    if (slice == null) return;
    e.preventDefault();
    areaRef.current?.setPointerCapture?.(e.pointerId);
    setDrag({ alt: e.altKey, anchor: slice, current: slice });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const slice = sliceAt(e.clientX);
    if (slice != null && slice !== drag.current) {
      setDrag({ ...drag, current: slice });
    }
  };
  const onPointerUp = () => {
    if (!drag) return;
    const start = Math.min(drag.anchor, drag.current);
    const length = Math.abs(drag.current - drag.anchor) + 1;
    setDrag(null);
    if (drag.alt) onAudition(start, length);
    else onAssign(start, length);
  };

  const dragView: null | SliceView = drag
    ? {
        lengthSlices: Math.abs(drag.current - drag.anchor) + 1,
        startSlice: Math.min(drag.anchor, drag.current),
      }
    : null;
  const highlightView = dragView ?? selectedView;
  const every = labelEvery(division);
  const pct = (slices: number) => `${(slices / division) * 100}%`;

  return (
    <div
      className="w-full mb-3 rounded-md border border-border-subtle bg-surface-1/60 px-2 py-1.5"
      data-testid="slice-strip"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
        <span
          className="flex items-center gap-1 font-semibold text-text-primary"
          title="Slice mode: each step plays part of this sample"
        >
          <ScissorsIcon size={14} style={{ color: voiceColor }} weight="bold" />
          {sliceVoices.length > 1 ? (
            <span className="flex gap-0.5" role="tablist">
              {sliceVoices.map((v) => (
                <button
                  aria-selected={v === editingVoice}
                  className={`px-1.5 rounded ${v === editingVoice ? "bg-surface-3 text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
                  data-testid={`slice-voice-tab-${v}`}
                  key={v}
                  onClick={() => onSelectVoice(v)}
                  role="tab"
                  title={`Edit voice ${v}'s slices`}
                  type="button"
                >
                  V{v}
                </button>
              ))}
            </span>
          ) : (
            <span>Voice {voiceLabel}</span>
          )}
        </span>
        <span
          className="truncate max-w-[180px] font-mono text-text-secondary"
          data-testid="slice-strip-sample"
          title={sampleName ?? undefined}
        >
          {sampleLabel(sampleName, slotIndex)}
        </span>

        <span className="flex-1" />

        <label
          className="flex items-center gap-1 text-text-secondary"
          title="Kit-wide — like the Rample's SLICER setting. Changing it and back never loses your slices."
        >
          <span>Slices</span>
          <select
            aria-label="Slice division"
            className={selectClass}
            data-testid="slice-division"
            onChange={(e) =>
              onDivisionChange(Number(e.target.value) as SlicerDivision)
            }
            value={division}
          >
            {SLICER_DIVISIONS.map((d) => (
              <option key={d} value={d}>
                /{d}
              </option>
            ))}
          </select>
        </label>

        <button
          className={buttonClass}
          data-testid="slice-roll"
          disabled={!sampleName}
          onClick={onRoll}
          title="Give steps random slices (D). Locked steps are kept."
          type="button"
        >
          <DiceFiveIcon size={14} weight="bold" />
          Roll
        </button>
        <RollOptions onSettingsChange={onSettingsChange} settings={settings} />
        <button
          className={buttonClass}
          data-testid="slice-undo-roll"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo the last sequencer change (Cmd/Ctrl+Z)"
          type="button"
        >
          <ArrowCounterClockwiseIcon size={14} weight="bold" />
          Undo
        </button>
        <button
          aria-label="Close slicer"
          className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-3"
          data-testid="slice-close"
          onClick={onClose}
          title="Close the slicer. Sliced voices keep playing their slices; click a step on a sliced row to edit again."
          type="button"
        >
          <XIcon size={14} weight="bold" />
        </button>
      </div>

      {/* Waveform with slice grid, and slice numbers */}
      <div style={waveformStyle}>
        <div
          className="relative h-16 rounded bg-surface-3 overflow-hidden cursor-pointer select-none touch-none"
          data-testid="slice-waveform"
          onPointerCancel={() => setDrag(null)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={areaRef}
        >
          <canvas
            className="absolute inset-0 w-full h-full pointer-events-none"
            height={64}
            ref={canvasRef}
            width={WAVE_COLUMNS * 2}
          />
          {hoverView && !dragView && (
            <div
              className="absolute inset-y-0 border-2 border-dashed rounded-sm pointer-events-none"
              data-testid="slice-hover"
              style={{
                borderColor: voiceColor,
                left: pct(hoverView.startSlice),
                width: pct(hoverView.lengthSlices),
              }}
            />
          )}
          {highlightView && (
            <div
              className="absolute inset-y-0 rounded-sm pointer-events-none"
              data-testid="slice-selected"
              style={{
                background: voiceColor,
                left: pct(highlightView.startSlice),
                opacity: 0.35,
                width: pct(highlightView.lengthSlices),
              }}
            />
          )}
          {playingView && (
            <div
              className="absolute inset-y-0 pointer-events-none"
              data-testid="slice-playing"
              style={{
                background: "#fff",
                left: pct(playingView.startSlice),
                opacity: 0.25,
                width: pct(playingView.lengthSlices),
              }}
            />
          )}
          {/* One button per slice: gridlines, used-slice ticks, keyboard access */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: division }, (_, i) => (
              <button
                aria-label={`Slice ${i + 1}`}
                className={`relative flex-1 h-full focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary ${i > 0 ? "border-l border-text-tertiary/25" : ""}`}
                data-testid={`slice-${i}`}
                key={i}
                onClick={(e) => {
                  // Mouse clicks are handled by the pointer events above;
                  // this handles keyboard activation (Enter/Space).
                  if (e.detail !== 0 || !sampleName) return;
                  onAssign(i, selectedView?.lengthSlices ?? 1);
                }}
                tabIndex={sampleName ? 0 : -1}
                type="button"
              >
                {usedSlices.has(i) && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: voiceColor }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Slice numbers */}
        <div
          className="flex mt-0.5 text-[9px] leading-none text-text-tertiary select-none"
          data-testid="slice-labels"
        >
          {Array.from({ length: division }, (_, i) => (
            <span className="flex-1 text-center overflow-visible" key={i}>
              {i % every === 0 ? i + 1 : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Hint line */}
      <p
        className="mt-1 text-[11px] text-text-tertiary"
        data-testid="slice-hint"
        role="status"
      >
        {notice ?? sliceHint(props)}
      </p>
    </div>
  );
};

export default SliceStrip;
