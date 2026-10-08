import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useLatestRef } from "./hooks/shared/useLatestRef";

const MIN_DB = -24;
const MAX_DB = 12;
const RANGE = MAX_DB - MIN_DB; // 36
const START_ANGLE = 225; // 7 o'clock (degrees, 0 = 3 o'clock, CW)
const END_ANGLE = -45; // 5 o'clock
const SWEEP = 270; // total degrees of arc
const PAGE_STEP_DB = 6; // Page Up / Page Down

/**
 * How long the knob waits after the last wheel notch or key press before it
 * saves, so a burst of them is saved once (RE-88)
 */
export const GAIN_SAVE_DELAY_MS = 300;

interface GainKnobProps {
  disabled?: boolean;
  /** The gain at each step of a turn, for the screen and playback; not saved */
  onChange: (db: number) => void;
  /**
   * The gain to save, once per turn (RE-88): when a drag is released, on a
   * click, GAIN_SAVE_DELAY_MS after the last wheel notch or key press, or
   * when the knob loses focus or goes away first. `fromDb` is the gain
   * before the turn.
   */
  onCommit?: (db: number, fromDb: number) => void;
  /** The gain in dB, or null if it isn't known: the knob shows "–" and is disabled (#628) */
  value: null | number;
}

/** A turn not saved yet, and the save it goes to */
interface PendingTurn {
  /** The knob's onCommit when the turn started, so it saves to that slot */
  commit?: (db: number, fromDb: number) => void;
  db: number;
  fromDb: number;
}

/** Gain change for a key on the focused knob, or null if it isn't one. */
export function gainForKey(
  key: string,
  db: number,
  shiftKey: boolean,
): null | number {
  const step = shiftKey ? 0.5 : 1;
  switch (key) {
    // 0 sets unity gain, like a click
    case "0":
      return 0;
    case "ArrowDown":
    case "ArrowLeft":
      return db - step;
    case "ArrowRight":
    case "ArrowUp":
      return db + step;
    case "End":
      return MAX_DB;
    case "Home":
      return MIN_DB;
    case "PageDown":
      return db - PAGE_STEP_DB;
    case "PageUp":
      return db + PAGE_STEP_DB;
    default:
      return null;
  }
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const s = polarToCart(cx, cy, r, startDeg);
  const e = polarToCart(cx, cy, r, endDeg);
  const sweep = startDeg - endDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

function dbToAngle(db: number): number {
  const t = (db - MIN_DB) / RANGE; // 0..1
  return START_ANGLE - t * SWEEP; // CW from start to end
}

function dbToRadians(db: number): number {
  return (dbToAngle(db) * Math.PI) / 180;
}

function formatDb(db: number): string {
  const rounded = Math.round(db);
  if (rounded > 0) return `+${rounded} dB`;
  return `${rounded} dB`;
}

function polarToCart(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

const GainKnob: React.FC<GainKnobProps> = ({
  disabled: disabledProp,
  onChange,
  onCommit,
  value,
}) => {
  const unknown = value === null;
  const disabled = disabledProp || unknown;
  const [localDb, setLocalDb] = useState(value ?? 0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);
  const didDrag = useRef(false);

  // Sync local state when prop changes (e.g. kit reload)
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    setLocalDb(value ?? 0);
  }

  const clampDb = (db: number) => Math.max(MIN_DB, Math.min(MAX_DB, db));

  // A turn shows and plays each step at once, but is saved once (RE-88)
  const onCommitRef = useLatestRef(onCommit);
  const dbRef = useLatestRef(localDb);
  const pending = useRef<null | PendingTurn>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const commit = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const turn = pending.current;
    pending.current = null;
    turn?.commit?.(turn.db, turn.fromDb);
  }, []);

  const commitSoon = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(commit, GAIN_SAVE_DELAY_MS);
  }, [commit]);

  // Save a turn the knob is in the middle of when it goes away
  useEffect(() => commit, [commit]);

  // A gain from elsewhere (another kit's slot, a reload) ends the turn, so
  // the next step starts a new one
  useLayoutEffect(() => {
    if (pending.current && value !== pending.current.db) commit();
  }, [commit, value]);

  const updateGain = useCallback(
    (db: number) => {
      const clamped = clampDb(db);
      pending.current ??= {
        commit: onCommitRef.current,
        db: clamped,
        fromDb: dbRef.current,
      };
      pending.current.db = clamped;
      dbRef.current = clamped;
      setLocalDb(clamped);
      onChange(clamped);
    },
    [dbRef, onChange, onCommitRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      didDrag.current = false;
      dragStartY.current = e.clientY;
      dragStartValue.current = localDb;
    },
    [disabled, localDb],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || didDrag.current) return;
      e.preventDefault();
      e.stopPropagation();
      updateGain(0);
      commit();
    },
    [commit, disabled, updateGain],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return;
      e.stopPropagation();
      const step = e.shiftKey ? 0.5 : 1;
      const delta = e.deltaY < 0 ? step : -step;
      updateGain(localDb + delta);
      commitSoon();
    },
    [commitSoon, disabled, updateGain, localDb],
  );

  // Keyboard: arrows by 1 dB (Shift: 0.5), Page Up/Down by 6 dB, Home and
  // End to the ends, 0 to unity (Q-06, RE-48). The keys stay with the knob:
  // the sample list and the kit editor use the arrows too. Any other key
  // saves the turn first, so a shortcut it triggers comes after the save.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const modified = e.metaKey || e.ctrlKey || e.altKey;
      const next = gainForKey(e.key, localDb, e.shiftKey);
      if (disabled || modified || next === null) {
        commit();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      updateGain(next);
      commitSoon();
    },
    [commit, commitSoon, disabled, localDb, updateGain],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dy = dragStartY.current - e.clientY;
      if (Math.abs(dy) > 2) didDrag.current = true;
      const dbDelta = dy / 2;
      updateGain(dragStartValue.current + dbDelta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      commit();
    };

    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);
    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
    };
  }, [commit, isDragging, updateGain]);

  const active = isHovered || isDragging || isFocused;
  const cx = 10;
  const cy = 10;
  const r = 7;

  // Background arc (full range)
  const bgArc = arcPath(cx, cy, r, START_ANGLE, END_ANGLE);

  // Value arc (from start to current value)
  const valAngle = dbToAngle(localDb);
  const valArc =
    localDb > MIN_DB ? arcPath(cx, cy, r, START_ANGLE, valAngle) : "";

  // Dot indicator position
  const dotRad = dbToRadians(localDb);
  const dotX = cx + r * Math.cos(dotRad);
  const dotY = cy - r * Math.sin(dotRad);

  const color = "var(--text-secondary)";
  const shownDb = unknown ? "–" : formatDb(localDb);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Leaving the knob ends a wheel turn, so a click elsewhere (such as
        // turning editing off) comes after the save; a drag goes on
        if (!isDragging) commit();
      }}
      role="presentation"
      style={{ zIndex: active ? 10 : undefined }}
    >
      <svg
        aria-disabled={disabled || undefined}
        aria-label={`Gain: ${shownDb}`}
        aria-valuemax={MAX_DB}
        aria-valuemin={MIN_DB}
        aria-valuenow={unknown ? undefined : localDb}
        aria-valuetext={shownDb}
        className="transition-transform duration-150 ease-out rounded-full focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-primary"
        height={20}
        onBlur={() => {
          setIsFocused(false);
          commit();
        }}
        onClick={handleClick}
        // Mouse presses don't focus the knob (handleMouseDown prevents it),
        // so focus means the keyboard: show the value as hover does
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        role="slider"
        style={{
          cursor: disabled ? "default" : "ns-resize",
          transform: active ? "scale(1.6)" : "scale(1)",
        }}
        tabIndex={disabled ? -1 : 0}
        viewBox="0 0 20 20"
        width={20}
      >
        {/* Background arc */}
        <path
          d={bgArc}
          fill="none"
          opacity={0.25}
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={2}
        />
        {/* Value arc; an unknown gain has none, and no dot */}
        {valArc && !unknown && (
          <path
            d={valArc}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={2}
          />
        )}
        {/* Dot indicator */}
        {!unknown && <circle cx={dotX} cy={dotY} fill={color} r={1.5} />}
        {/* Unity mark (tiny tick at 12 o'clock for 0 dB reference) */}
        {!active && (
          <line
            opacity={0.3}
            stroke="currentColor"
            strokeWidth={0.5}
            x1={cx}
            x2={cx}
            y1={cy - r - 1}
            y2={cy - r + 1}
          />
        )}
      </svg>
      {active && (
        <span
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 text-text-primary font-mono font-medium leading-none pointer-events-none select-none whitespace-nowrap bg-surface-2 border border-border-default rounded px-1.5 py-0.5"
          style={{ fontSize: 11 }}
        >
          {shownDb}
        </span>
      )}
    </div>
  );
};

export default GainKnob;
