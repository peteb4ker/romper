import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ActionPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

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

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const rafId = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside);
    });
    document.addEventListener("keydown", handleEscape);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed z-50 w-[240px] bg-surface-2 border border-border-strong rounded-lg shadow-lg p-3"
      data-testid="action-popover"
      ref={popoverRef}
      style={{ left: position.x, top: position.y }}
    >
      {children}
    </div>,
    document.body,
  );
};

export default ActionPopover;
