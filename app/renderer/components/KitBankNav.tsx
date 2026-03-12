import type { KitWithRelations } from "@romper/shared/db/schema";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface KitBankNavProps {
  bankNames?: Record<string, string>;
  kits: KitWithRelations[];
  onBankClick: (bank: string) => void;
  selectedBank?: string;
}

const banks = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// Fisheye scale: closest letter scales to max, fades over `radius` neighbors
const BASE_SCALE = 1;
const MAX_SCALE = 1.8;
const RADIUS = 2.5;

const BASE_FONT_SIZE = 12;
const BASE_HEIGHT = 24;
const BASE_WIDTH = 28;

function getScale(index: number, hoverIndex: number): number {
  const dist = Math.abs(index - hoverIndex);
  if (dist >= RADIUS) return BASE_SCALE;
  const t = dist / RADIUS;
  return (
    BASE_SCALE + (MAX_SCALE - BASE_SCALE) * (0.5 * (1 + Math.cos(Math.PI * t)))
  );
}

const KitBankNav: React.FC<KitBankNavProps> = ({
  bankNames = {},
  kits,
  onBankClick,
  selectedBank,
}) => {
  const navRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number>(0);
  const [hoverIndex, setHoverIndex] = useState(-1);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const clientY = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      const rect = nav.getBoundingClientRect();
      const style = getComputedStyle(nav);
      const padTop = Number.parseFloat(style.paddingTop);
      const y = clientY - rect.top - padTop;
      // Use fixed button height instead of nav content height.
      // The nav may be flex-stretched taller than its button content,
      // which skews the fraction and offsets the hover target.
      const buttonsHeight = banks.length * BASE_HEIGHT;
      const fraction = Math.max(0, Math.min(1, y / buttonsHeight));
      setHoverIndex(fraction * (banks.length - 1));
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setHoverIndex(-1);
  }, []);

  const isHovering = hoverIndex >= 0;
  const nearestIndex = Math.round(hoverIndex);
  const nearestBank =
    isHovering && nearestIndex >= 0 && nearestIndex < banks.length
      ? banks[nearestIndex]
      : null;

  return (
    <nav
      aria-label="Bank index"
      className="relative flex flex-col items-start py-2 select-none pl-1"
      data-testid="bank-nav"
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      ref={navRef}
    >
      {banks.map((bank, i) => {
        const enabled = kits.some(
          (k) =>
            k &&
            k.name &&
            typeof k.name === "string" &&
            k.name.startsWith(bank),
        );
        const isSelected = enabled && selectedBank === bank;
        const scale = isHovering ? getScale(i, hoverIndex) : BASE_SCALE;
        const isNearest = bank === nearestBank;

        return (
          <button
            aria-current={isSelected ? "true" : undefined}
            aria-label={`Jump to bank ${bank}`}
            className={`
              relative flex items-center justify-center
              rounded text-xs font-mono font-bold leading-none
              origin-left
              ${(() => {
                if (isSelected) return "bg-accent-primary text-text-inverse";
                if (isNearest && isHovering) return "text-accent-primary";
                if (enabled) return "text-text-secondary";
                return "text-text-tertiary/30 cursor-default";
              })()}
            `}
            disabled={!enabled}
            key={bank}
            onClick={() => onBankClick(bank)}
            style={{
              fontSize: `${BASE_FONT_SIZE}px`,
              height: `${BASE_HEIGHT}px`,
              transform: `scale(${scale})`,
              transformOrigin: "left center",
              transition: isHovering
                ? "transform 60ms ease-out"
                : "transform 200ms ease-out",
              width: `${BASE_WIDTH}px`,
              willChange: isHovering ? "transform" : "auto",
              zIndex: isNearest && isHovering ? 50 : "auto",
            }}
            title={!isHovering ? bankNames[bank] || undefined : undefined}
          >
            {bank}
            {/* Floating label — only when there's a bank name to show */}
            {isNearest && isHovering && bankNames[bank] && (
              <div
                className="absolute left-full ml-2 px-2.5 py-1
                  bg-surface-3 border border-border-subtle rounded-md shadow-lg
                  pointer-events-none whitespace-nowrap z-50"
              >
                <span className="text-sm text-text-secondary">
                  {bankNames[bank]}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default KitBankNav;
