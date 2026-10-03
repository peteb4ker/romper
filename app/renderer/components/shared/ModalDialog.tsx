import React, { useEffect, useId, useRef } from "react";

/**
 * Every modal in Romper renders through this wrapper (Q-06, RE-48). It
 * gives the panel `role="dialog"` and `aria-modal="true"` with a label, keeps
 * Tab and Shift+Tab inside it, closes on Escape when the dialog can be
 * dismissed, and returns focus to where it was when the dialog closes.
 * Key handlers elsewhere detect an open modal by its `aria-modal`.
 */
export interface ModalDialogProps {
  /** id of the element that names the dialog, usually its heading */
  "aria-describedby"?: string;
  /** A name for a dialog without a visible heading */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: React.ReactNode;
  /** Classes for the dialog panel */
  className?: string;
  /** Close on a click on the backdrop as well as on Escape */
  closeOnBackdropClick?: boolean;
  "data-testid"?: string;
  /**
   * Called on Escape (and a backdrop click when `closeOnBackdropClick`).
   * Leave it out for a dialog that must be answered with one of its buttons.
   */
  onClose?: () => void;
  /** Classes for the full-window layer behind the panel; null for none */
  overlayClassName?: null | string;
  /** The panel's inline style */
  style?: React.CSSProperties;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

const DEFAULT_OVERLAY =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/60";

// Open modals, innermost last: only the innermost takes Escape and Tab
const openDialogs: string[] = [];

/** The elements Tab can reach in `root`, in order. */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && el.getAttribute("aria-hidden") !== "true",
  );
}

const ModalDialog: React.FC<ModalDialogProps> = ({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  className,
  closeOnBackdropClick = false,
  "data-testid": testId,
  onClose,
  overlayClassName = DEFAULT_OVERLAY,
  style,
}) => {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Register as the innermost dialog, move focus in, and give it back on close
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openDialogs.push(id);
    const panel = panelRef.current;
    // An autoFocus control inside has already taken focus; otherwise the
    // panel takes it, so the next Tab reaches the first control
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }
    return () => {
      const at = openDialogs.lastIndexOf(id);
      if (at !== -1) openDialogs.splice(at, 1);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [id]);

  // Escape and the focus trap. Bubble phase on the document, so a control
  // inside that handles Escape itself (a text field, a popover) and stops
  // it keeps it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (openDialogs.at(-1) !== id) return;
      const panel = panelRef.current;
      if (!panel) return;

      if (e.key === "Escape") {
        if (e.defaultPrevented || !onCloseRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      const active = document.activeElement;
      const inside = panel.contains(active);
      if (e.shiftKey && (!inside || active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [id]);

  // Focus that lands outside the innermost dialog (a click behind it, a
  // window coming back to the front) goes back into it
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (openDialogs.at(-1) !== id) return;
      const panel = panelRef.current;
      const target = e.target as Node | null;
      if (!panel || (target && panel.contains(target))) return;
      // A popover the dialog opened is portalled to <body>; leave it be
      if (
        (target as Element | null)?.closest?.(
          '[role="dialog"]:not([aria-modal="true"])',
        )
      )
        return;
      panel.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [id]);

  const panel = (
    <div
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={`focus:outline-none ${className ?? ""}`}
      data-testid={testId}
      ref={panelRef}
      role="dialog"
      style={style}
      tabIndex={-1}
    >
      {children}
    </div>
  );

  if (overlayClassName === null) return panel;

  return (
    <div
      className={overlayClassName}
      data-testid={testId ? `${testId}-backdrop` : undefined}
      onClick={(e) => {
        if (
          closeOnBackdropClick &&
          e.target === e.currentTarget &&
          onCloseRef.current
        ) {
          onCloseRef.current();
        }
      }}
      role="presentation"
    >
      {panel}
    </div>
  );
};

export default ModalDialog;
