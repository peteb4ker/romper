import React from "react";

import LocalStoreWizardUI from "./LocalStoreWizardUI";
import ModalDialog from "./shared/ModalDialog";

interface LocalStoreWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloseApp?: () => void;
  onInitializationChange?: (isInitializing: boolean) => void;
  onSuccess: () => void;
  /** Saves the store path; resolves false if it couldn't */
  setLocalStorePath: (path: string) => Promise<boolean>;
}

/**
 * Modal wrapper for LocalStoreWizardUI
 * Handles the modal presentation logic separately from the wizard content
 */
const LocalStoreWizardModal: React.FC<LocalStoreWizardModalProps> = ({
  isOpen,
  onClose,
  onCloseApp,
  onInitializationChange,
  onSuccess,
  setLocalStorePath,
}) => {
  if (!isOpen) return null;

  // Use onCloseApp if provided, otherwise use onClose
  const handleClose = onCloseApp || onClose;

  return (
    // Setup must finish (or the app close) first: Escape doesn't dismiss it
    <ModalDialog
      aria-labelledby="local-store-setup-title"
      className="bg-surface-1 rounded-lg p-6 max-w-2xl w-full mx-4"
      data-testid="local-store-wizard-modal"
    >
      <div className="mb-4">
        <h2
          className="text-xl font-bold text-text-primary"
          id="local-store-setup-title"
        >
          Local Store Setup Required
        </h2>
        <p className="text-text-secondary mt-2">
          The local store must be set up before the app can be used. Please
          complete the setup wizard to continue.
        </p>
      </div>
      <LocalStoreWizardUI
        onClose={handleClose}
        onInitializationChange={onInitializationChange}
        onSuccess={onSuccess}
        setLocalStorePath={setLocalStorePath}
      />
    </ModalDialog>
  );
};

export default React.memo(LocalStoreWizardModal);
