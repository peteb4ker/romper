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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg border-2 border-red-500">
        <div className="mb-4 flex items-center space-x-3">
          <FiAlertTriangle className="h-8 w-8 text-red-600" />
          <h2 className="text-xl font-bold text-red-900">{title}</h2>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end">
          <button
            autoFocus
            className="rounded bg-red-600 px-6 py-2 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
