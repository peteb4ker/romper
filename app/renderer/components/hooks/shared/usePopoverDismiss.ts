import { RefObject, useEffect } from "react";

export function usePopoverDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  isActive = true,
) {
  useEffect(() => {
    if (!isActive) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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
  }, [ref, onClose, isActive]);
}
