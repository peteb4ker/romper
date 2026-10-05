import { WarningIcon } from "@phosphor-icons/react";
import React from "react";

import ModalDialog from "../shared/ModalDialog";

interface CriticalErrorDialogProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  title: string;
}

/**
 * The dialog's only button. It takes focus as it mounts, from inside the
 * dialog: a child's effect runs before ModalDialog's, so ModalDialog finds
 * focus already inside and leaves it there.
 */
const ExitButton: React.FC<Readonly<{ onConfirm: () => void }>> = ({
  onConfirm,
}) => {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <button
      className="rounded bg-accent-danger px-6 py-2 text-white font-medium hover:bg-accent-danger/80 focus:outline-none focus:ring-2 focus:ring-accent-danger focus:ring-offset-2"
      onClick={onConfirm}
      ref={buttonRef}
    >
      OK - Exit Application
    </button>
  );
};

/**
 * Critical error dialog for non-recoverable errors
 * User must acknowledge and then app will close
 */
const CriticalErrorDialog: React.FC<CriticalErrorDialogProps> = ({
  isOpen,
  message,
  onConfirm,
  title,
}) => {
  if (!isOpen) return null;

  return (
    // Must be answered: Escape doesn't dismiss it
    <ModalDialog
      aria-describedby="critical-error-message"
      aria-labelledby="critical-error-title"
      className="mx-4 w-full max-w-md rounded-lg bg-surface-2 p-6 shadow-lg border-2 border-accent-danger"
      data-testid="critical-error-dialog"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
    >
      <div className="mb-4 flex items-center space-x-3">
        <WarningIcon className="text-accent-danger" size={32} />
        <h2
          className="text-xl font-bold text-accent-danger"
          id="critical-error-title"
        >
          {title}
        </h2>
      </div>

      <div className="mb-6">
        <p
          className="text-sm text-text-secondary leading-relaxed"
          id="critical-error-message"
        >
          {message}
        </p>
      </div>

      <div className="flex justify-end">
        <ExitButton onConfirm={onConfirm} />
      </div>
    </ModalDialog>
  );
};

export default CriticalErrorDialog;
