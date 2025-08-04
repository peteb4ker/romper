import React from "react";

import LocalStoreWizardUI from "./LocalStoreWizardUI";

interface LocalStoreWizardModalProps {
  isAutoTriggered?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  setLocalStorePath: (path: string) => void;
}

/**
 * Modal wrapper for LocalStoreWizardUI
 * Handles the modal presentation logic separately from the wizard content
 */
const LocalStoreWizardModal: React.FC<LocalStoreWizardModalProps> = ({
  isAutoTriggered = false,
  isOpen,
  onClose,
  onSuccess,
  setLocalStorePath,
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    if (isAutoTriggered) {
      // Close the app if user cancels the auto-triggered wizard
      window.electronAPI?.closeApp?.();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Local Store Setup Required
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            The local store must be set up before the app can be used. Please
            complete the setup wizard to continue.
          </p>
        </div>
        <LocalStoreWizardUI
          onClose={handleClose}
          onSuccess={onSuccess}
          setLocalStorePath={setLocalStorePath}
        />
      </div>
    </div>
  );
};

export default React.memo(LocalStoreWizardModal);
