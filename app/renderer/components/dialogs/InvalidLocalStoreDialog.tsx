import {
  ArrowsClockwiseIcon,
  FolderIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";

import { useSettings } from "../../utils/SettingsContext";
import FilePickerButton from "../utils/FilePickerButton";

interface InvalidLocalStoreDialogProps {
  errorMessage: string;
  isOpen: boolean;
  localStorePath: null | string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRerunWizard?: () => void;
}

/**
 * Reusable path display component to reduce duplication
 */
interface PathDisplayProps {
  label: string;
  path: string;
  variant: "current" | "selected";
}

const PathDisplay: React.FC<PathDisplayProps> = ({ label, path, variant }) => {
  const styles = {
    current: {
      container: "rounded bg-surface-3 p-2",
      label: "text-xs text-text-tertiary mb-1",
      path: "text-sm font-mono text-text-primary break-all",
    },
    selected: {
      container: "rounded bg-accent-primary/10 p-3",
      label: "text-xs text-accent-primary mb-1",
      path: "text-sm font-mono text-accent-primary break-all",
    },
  };

  const style = styles[variant];

  return (
    <div className={style.container}>
      <p className={style.label}>{label}:</p>
      <p className={style.path}>{path}</p>
    </div>
  );
};

/**
 * Modal blocking dialog for a configured local store that can't be opened
 * (C1-C6), including one on a drive that isn't connected (RE-80). The user
 * can try again, choose another directory, set up a new store, or exit.
 */
const InvalidLocalStoreDialog: React.FC<InvalidLocalStoreDialogProps> = ({
  errorMessage,
  isOpen,
  localStorePath,
  onMessage,
  onRerunWizard,
}) => {
  const { refreshLocalStoreStatus, setLocalStorePath } = useSettings();
  const [isValidating, setIsValidating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPath, setSelectedPath] = useState<null | string>(null);
  const [validationResult, setValidationResult] = useState<{
    error?: string;
    isValid: boolean;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<null | string>(null);

  // Track component mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSelectDirectory = async () => {
    setIsSelecting(true);
    try {
      if (!globalThis.electronAPI?.selectLocalStorePath) {
        throw new Error("Directory selection not available");
      }

      const path = await globalThis.electronAPI.selectLocalStorePath();
      if (path && isMountedRef.current) {
        setSelectedPath(path);
        await validatePath(path);
      }
    } catch (error) {
      onMessage?.(
        `Failed to select directory: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      if (isMountedRef.current) {
        setIsSelecting(false);
      }
    }
  };

  const validatePath = async (path: string) => {
    setIsValidating(true);
    try {
      if (!globalThis.electronAPI?.validateLocalStore) {
        throw new Error("Validation API not available");
      }

      const result = await globalThis.electronAPI.validateLocalStore(path);
      if (isMountedRef.current) {
        setValidationResult({
          error: result.error || undefined,
          isValid: result.isValid,
        });
      }
    } catch (error) {
      if (isMountedRef.current) {
        setValidationResult({
          error: error instanceof Error ? error.message : String(error),
          isValid: false,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsValidating(false);
      }
    }
  };

  const handleUpdatePath = async () => {
    if (!selectedPath || !validationResult?.isValid) return;

    setIsUpdating(true);
    try {
      // Saving refreshes the store status, which closes this dialog
      if (await setLocalStorePath(selectedPath)) {
        onMessage?.("Local store directory updated.", "success");
      } else {
        onMessage?.("Couldn't save the new local store directory.", "error");
      }
    } finally {
      if (isMountedRef.current) {
        setIsUpdating(false);
      }
    }
  };

  // The store may be on a drive that wasn't connected (RE-80): check it
  // again, and reopen the app on it if it's there now
  const handleTryAgain = async () => {
    if (!localStorePath) return;
    setIsRetrying(true);
    try {
      const result =
        await globalThis.electronAPI?.validateLocalStore?.(localStorePath);
      if (result?.isValid) {
        await refreshLocalStoreStatus();
      } else if (isMountedRef.current) {
        setRetryError(
          result?.error ?? "Romper still can't open the local store.",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  };

  const handleExitApp = () => {
    if (globalThis.electronAPI?.closeApp) {
      void globalThis.electronAPI.closeApp();
    } else {
      // Fallback for development or if API is not available
      window.close();
    }
  };

  const renderValidationStatus = () => {
    if (isValidating) {
      return (
        <div className="flex items-center space-x-2 text-accent-primary">
          <ArrowsClockwiseIcon className="animate-spin" size={16} />
          <span className="text-sm">Validating directory...</span>
        </div>
      );
    }

    if (validationResult?.isValid) {
      return (
        <div className="rounded bg-accent-success/10 p-2">
          <p className="text-sm text-accent-success">
            ✓ Valid local store directory
          </p>
        </div>
      );
    }

    return (
      <div className="rounded bg-accent-danger/10 p-2">
        <p className="text-sm text-accent-danger">
          ✗ {validationResult?.error || "Invalid directory"}
        </p>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="mx-4 w-full max-w-md rounded-lg bg-surface-2 border border-border-subtle p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
        <div className="mb-4 flex items-center space-x-3">
          <WarningIcon className="text-accent-danger" size={24} />
          <h2 className="text-lg font-semibold text-text-primary">
            Invalid Local Store
          </h2>
        </div>

        <div className="mb-4">
          <p className="text-sm text-text-secondary mb-3">{errorMessage}</p>

          {localStorePath && (
            <div className="mb-3">
              <PathDisplay
                label="Current path"
                path={localStorePath}
                variant="current"
              />
            </div>
          )}

          <p className="text-sm text-text-tertiary">
            If it's on a drive that isn't connected, connect the drive and click{" "}
            <strong>Try Again</strong>. Otherwise choose another local store
            directory, or set up a new one.
          </p>
          {retryError && (
            <p
              className="mt-2 text-sm text-accent-danger"
              data-testid="retry-error"
            >
              {retryError}
            </p>
          )}
        </div>

        {localStorePath && (
          <div className="mb-4">
            <button
              className="w-full rounded bg-accent-primary px-4 py-2 text-white hover:bg-accent-primary/80 disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="retry-local-store-btn"
              disabled={isRetrying || isUpdating || isSelecting}
              onClick={handleTryAgain}
              type="button"
            >
              <ArrowsClockwiseIcon
                className={isRetrying ? "animate-spin" : undefined}
                size={16}
              />
              {isRetrying ? "Checking..." : "Try Again"}
            </button>
          </div>
        )}

        {/* Directory Selection */}
        <div className="mb-4">
          <FilePickerButton
            disabled={isUpdating}
            icon={<FolderIcon size={16} />}
            isSelecting={isSelecting}
            onClick={handleSelectDirectory}
          >
            Choose Another Local Store Directory
          </FilePickerButton>
        </div>

        {/* Selected Path Display */}
        {selectedPath && (
          <div className="mb-4">
            <PathDisplay
              label="Selected path"
              path={selectedPath}
              variant="selected"
            />
          </div>
        )}

        {/* Validation Result */}
        {validationResult && (
          <div className="mb-4">{renderValidationStatus()}</div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <div className="flex space-x-3">
            <button
              className="flex-1 rounded bg-accent-primary px-4 py-2 text-white hover:bg-accent-primary/80 disabled:opacity-50"
              disabled={
                !selectedPath ||
                !validationResult?.isValid ||
                isUpdating ||
                isSelecting
              }
              onClick={handleUpdatePath}
            >
              {isUpdating ? "Updating..." : "Use This Directory"}
            </button>
            <button
              className="rounded bg-accent-danger px-4 py-2 text-white hover:bg-accent-danger/80 disabled:opacity-50"
              disabled={isUpdating || isSelecting}
              onClick={handleExitApp}
            >
              Exit App
            </button>
          </div>
          {onRerunWizard && (
            <button
              className="w-full rounded bg-surface-4 px-4 py-2 text-text-primary hover:bg-surface-3 disabled:opacity-50"
              data-testid="rerun-wizard-btn"
              disabled={isUpdating || isSelecting || isRetrying}
              onClick={onRerunWizard}
              type="button"
            >
              Set Up a New Local Store
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvalidLocalStoreDialog;
