import React, { useCallback, useEffect, useRef, useState } from "react";

const MIN_DB = -24;
const MAX_DB = 12;
const RANGE = MAX_DB - MIN_DB; // 36
const START_ANGLE = 225; // 7 o'clock (degrees, 0 = 3 o'clock, CW)
const END_ANGLE = -45; // 5 o'clock
const SWEEP = 270; // total degrees of arc

interface GainKnobProps {
  disabled?: boolean;
  onChange: (db: number) => void;
  value: number;
  voiceColor?: string;
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
  disabled,
  onChange,
  value,
  voiceColor,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);

  const clampDb = (db: number) => Math.max(MIN_DB, Math.min(MAX_DB, db));

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartValue.current = value;
    },
    [disabled, value],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      onChange(0);
    },
    [disabled, onChange],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return;
      e.stopPropagation();
      const step = e.shiftKey ? 0.5 : 1;
      const delta = e.deltaY < 0 ? step : -step;
      onChange(clampDb(value + delta));
    },
    [disabled, onChange, value],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dy = dragStartY.current - e.clientY;
      // 2px per dB — comfortable sensitivity
      const dbDelta = dy / 2;
      onChange(clampDb(dragStartValue.current + dbDelta));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onChange]);

  const showLabel = isHovered || isDragging;
  const active = isHovered || isDragging;
  const cx = 10;
  const cy = 10;
  const r = 7;

  // Background arc (full range)
  const bgArc = arcPath(cx, cy, r, START_ANGLE, END_ANGLE);

  // Value arc (from start to current value)
  const valAngle = dbToAngle(value);
  const valArc =
    value > MIN_DB ? arcPath(cx, cy, r, START_ANGLE, valAngle) : "";

  // Dot indicator position
  const dotRad = dbToRadians(value);
  const dotX = cx + r * Math.cos(dotRad);
  const dotY = cy - r * Math.sin(dotRad);

  const color = voiceColor || "var(--accent-primary)";

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ zIndex: active ? 10 : undefined }}
    >
      <svg
        aria-label={`Gain: ${formatDb(value)}`}
        aria-valuemax={MAX_DB}
        aria-valuemin={MIN_DB}
        aria-valuenow={value}
        className="transition-transform duration-150 ease-out"
        height={20}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        role="slider"
        style={{
          cursor: disabled ? "default" : "ns-resize",
          transform: active ? "scale(1.6)" : "scale(1)",
        }}
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
        {/* Value arc */}
        {valArc && (
          <path
            d={valArc}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={2}
          />
        )}
        {/* Dot indicator */}
        <circle cx={dotX} cy={dotY} fill={color} r={1.5} />
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
      {showLabel && (
        <span
          className="absolute text-text-secondary whitespace-nowrap pointer-events-none"
          style={{
            fontSize: 10,
            left: "100%",
            marginLeft: 4,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          {formatDb(value)}
        </span>
      )}
    </div>
  );
};

export default GainKnob;
