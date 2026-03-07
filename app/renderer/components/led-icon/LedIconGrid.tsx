import React, { useCallback, useRef } from "react";

import { ICON_COLS, ICON_LED_COUNT, ICON_ROWS } from "./ledIconConstants";
import { useLedVisualization } from "./useLedVisualization";

interface LedIconGridProps {
  onClick?: () => void;
}

const LedIconGrid: React.FC<LedIconGridProps> = React.memo(({ onClick }) => {
  const isHoveredRef = useRef(false);
  const { addRipple, clearMousePosition, ledRefs, setMousePosition } =
    useLedVisualization(isHoveredRef);
  const gridRef = useRef<HTMLDivElement>(null);

  const translateCoords = useCallback(
    (clientX: number, clientY: number): { col: number; row: number } | null => {
      const grid = gridRef.current;
      if (!grid) return null;
      const rect = grid.getBoundingClientRect();
      const padding = 3;
      const x = clientX - rect.left - padding;
      const y = clientY - rect.top - padding;
      const contentWidth = rect.width - padding * 2;
      const contentHeight = rect.height - padding * 2;
      const col = (x / contentWidth) * ICON_COLS;
      const row = (y / contentHeight) * ICON_ROWS;
      return { col, row };
    },
    [],
  );

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const coords = translateCoords(e.clientX, e.clientY);
      if (coords) setMousePosition(coords.col, coords.row);
    },
    [translateCoords, setMousePosition],
  );

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    clearMousePosition();
  }, [clearMousePosition]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const coords = translateCoords(e.clientX, e.clientY);
      if (coords) addRipple(coords.col, coords.row);
      onClick?.();
    },
    [translateCoords, addRipple, onClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        addRipple(ICON_COLS / 2, ICON_ROWS / 2);
        onClick?.();
      }
    },
    [addRipple, onClick],
  );

  return (
    <div
      aria-label="About Romper"
      className="h-[38px] rounded-sm bg-black overflow-hidden flex-shrink-0 cursor-pointer"
      data-testid="led-icon-grid"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      ref={gridRef}
      role="button"
      style={{
        display: "grid",
        gap: "1px",
        gridTemplateColumns: `repeat(${ICON_COLS}, 6px)`,
        gridTemplateRows: `repeat(${ICON_ROWS}, 6px)`,
        padding: "2px",
        placeContent: "center",
        width: "101px",
      }}
      tabIndex={0}
    >
      {Array.from({ length: ICON_LED_COUNT }, (_, i) => (
        <div
          className="rounded-full bg-voice-1"
          data-testid="led-icon-pixel"
          key={i}
          ref={(el) => {
            ledRefs.current[i] = el;
          }}
          style={{ height: "6px", opacity: 0.25, width: "6px" }}
        />
      ))}
    </div>
  );
});

LedIconGrid.displayName = "LedIconGrid";

export default LedIconGrid;
