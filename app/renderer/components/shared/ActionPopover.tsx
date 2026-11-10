import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePopoverDismiss } from "../hooks/shared/usePopoverDismiss";

interface ActionPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

// The popover renders in document.body, but React events still bubble to the
// card that owns it: Enter and Space here must not open the kit (#889).
// Other keys, Escape included, go on to their handlers.
const stopOpeningKeys = (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") e.stopPropagation();
};

const ActionPopover: React.FC<ActionPopoverProps> = ({
  anchorRef,
  children,
  isOpen,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverWidth = 240;
    let x = rect.right - popoverWidth;
    const y = rect.bottom + 4;
    if (x < 8) x = 8;
    setPosition({ x, y });
  }, [isOpen, anchorRef]);

  usePopoverDismiss(popoverRef, onClose, isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed z-50 w-[240px] bg-surface-2 border border-border-strong rounded-lg shadow-lg p-3"
      data-testid="action-popover"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={stopOpeningKeys}
      ref={popoverRef}
      style={{ left: position.x, top: position.y }}
    >
      {children}
    </div>,
    document.body,
  );
};

export default ActionPopover;
