import React, { useCallback, useRef } from "react";

import { LED_COLS, LED_COUNT, LED_ROWS } from "./ledConstants";
import { useLedAnimation } from "./useLedAnimation";

const LedPixelGrid: React.FC = React.memo(() => {
  const { addRipple, clearMousePosition, ledRefs, setMousePosition } =
    useLedAnimation();
  const gridRef = useRef<HTMLDivElement>(null);

  const translateCoords = useCallback(
    (clientX: number, clientY: number): { col: number; row: number } | null => {
      const grid = gridRef.current;
      if (!grid) return null;
      const rect = grid.getBoundingClientRect();
      // Account for padding (4px) to map within the content area
      const padding = 4;
      const x = clientX - rect.left - padding;
      const y = clientY - rect.top - padding;
      const contentWidth = rect.width - padding * 2;
      const contentHeight = rect.height - padding * 2;
      const col = (x / contentWidth) * LED_COLS;
      const row = (y / contentHeight) * LED_ROWS;
      return { col, row };
    },
    [],
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
