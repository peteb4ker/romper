import React from "react";
import { FiAlertTriangle } from "react-icons/fi";

interface CriticalErrorDialogProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  title: string;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="mx-4 w-full max-w-md rounded-lg bg-surface-2 p-6 shadow-lg border-2 border-accent-danger">
        <div className="mb-4 flex items-center space-x-3">
          <FiAlertTriangle className="h-8 w-8 text-accent-danger" />
          <h2 className="text-xl font-bold text-accent-danger">{title}</h2>
        </div>

        <div className="mb-6">
          <p className="text-sm text-text-secondary leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            autoFocus
            className="rounded bg-accent-danger px-6 py-2 text-white font-medium hover:bg-accent-danger/80 focus:outline-none focus:ring-2 focus:ring-accent-danger focus:ring-offset-2"
            onClick={onConfirm}
          >
            OK - Exit Application
          </button>
        </div>
      </div>
    </div>
  );
};

export default CriticalErrorDialog;
