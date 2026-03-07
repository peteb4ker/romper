import type { KitWithRelations } from "@romper/shared/db/schema";

import React, { useCallback, useRef, useState } from "react";

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
  const [hoverIndex, setHoverIndex] = useState(-1);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const fraction = y / rect.height;
    setHoverIndex(fraction * banks.length);
  }, []);

  const handleMouseLeave = useCallback(() => {
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
              ${
                isSelected
                  ? "bg-accent-primary text-text-inverse"
                  : isNearest && isHovering
                    ? "text-accent-primary"
                    : enabled
                      ? "text-text-secondary"
                      : "text-text-tertiary/30 cursor-default"
              }
            `}
            disabled={!enabled}
            key={bank}
            onClick={() => onBankClick(bank)}
            style={{
              fontSize: `${scale * 12}px`,
              height: `${scale * 24}px`,
              transition: isHovering
                ? "font-size 60ms ease-out, height 60ms ease-out"
                : "font-size 200ms ease-out, height 200ms ease-out",
              width: `${scale * 28}px`,
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
