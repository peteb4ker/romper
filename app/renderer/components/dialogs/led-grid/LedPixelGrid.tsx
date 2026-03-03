import React, { useCallback, useRef } from "react";

import { LED_COLS, LED_COUNT, LED_ROWS } from "./ledConstants";
import { useLedAnimation } from "./useLedAnimation";

const LedPixelGrid: React.FC = React.memo(() => {
  const { addRipple, clearMousePosition, ledRefs, setMousePosition } =
    useLedAnimation();
  const gridRef = useRef<HTMLDivElement>(null);

  const translateCoords = useCallback(
    (clientX: number, clientY: number): { col: number; row: number } | null => {
      // Use actual LED element positions to map mouse to grid coordinates.
      // This accounts for padding, gaps, and any CSS layout effects.
      const firstLed = ledRefs.current[0];
      const lastLed = ledRefs.current[LED_COUNT - 1];
      if (!firstLed || !lastLed) return null;
      const first = firstLed.getBoundingClientRect();
      const last = lastLed.getBoundingClientRect();
      const firstCx = first.left + first.width / 2;
      const firstCy = first.top + first.height / 2;
      const lastCx = last.left + last.width / 2;
      const lastCy = last.top + last.height / 2;
      const col = ((clientX - firstCx) / (lastCx - firstCx)) * (LED_COLS - 1);
      const row = ((clientY - firstCy) / (lastCy - firstCy)) * (LED_ROWS - 1);
      return { col, row };
    },
    [ledRefs],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const coords = translateCoords(e.clientX, e.clientY);
      if (coords) setMousePosition(coords.col, coords.row);
    },
    [translateCoords, setMousePosition],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const coords = translateCoords(e.clientX, e.clientY);
      if (coords) addRipple(coords.col, coords.row);
    },
    [translateCoords, addRipple],
  );

  const handleMouseLeave = useCallback(() => {
    clearMousePosition();
  }, [clearMousePosition]);

  return (
    <div
      className="absolute inset-0"
      data-testid="led-pixel-grid"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          addRipple(LED_COLS / 2, LED_ROWS / 2);
        }
      }}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      ref={gridRef}
      role="presentation"
      style={{
        display: "grid",
        gap: "2px",
        gridTemplateColumns: `repeat(${LED_COLS}, 1fr)`,
        gridTemplateRows: `repeat(${LED_ROWS}, 1fr)`,
        padding: "4px",
      }}
    >
      {Array.from({ length: LED_COUNT }, (_, i) => (
        <div
          className="rounded-full bg-voice-1"
          data-testid="led-pixel"
          key={i}
          ref={(el) => {
            ledRefs.current[i] = el;
          }}
          style={{ aspectRatio: "1", opacity: 0.06 }}
        />
      ))}
    </div>
  );
});

LedPixelGrid.displayName = "LedPixelGrid";

export default LedPixelGrid;
