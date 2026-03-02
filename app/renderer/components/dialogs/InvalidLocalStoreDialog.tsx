import { ArrowsClockwise, Folder, Warning } from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";

import { useSettings } from "../../utils/SettingsContext";
import FilePickerButton from "../utils/FilePickerButton";

interface InvalidLocalStoreDialogProps {
  errorMessage: string;
  isOpen: boolean;
  localStorePath: null | string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
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
 * Modal blocking dialog for invalid local store scenarios (C1-C6)
 * User cannot cancel - must choose new directory or exit app
 * According to requirements: modal, blocking, cannot cancel
 */
const InvalidLocalStoreDialog: React.FC<InvalidLocalStoreDialogProps> = ({
  errorMessage,
  isOpen,
  localStorePath,
  onMessage,
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
      if (!window.electronAPI?.selectLocalStorePath) {
        throw new Error("Directory selection not available");
      }

      const path = await window.electronAPI.selectLocalStorePath();
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
      if (!window.electronAPI?.validateLocalStore) {
        throw new Error("Validation API not available");
      }

      const result = await window.electronAPI.validateLocalStore(path);
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
      setLocalStorePath(selectedPath);
      onMessage?.(
        "Local store directory updated successfully. Refreshing...",
        "success",
      );

      // Give user a moment to see the success message before refresh
      // Use React-friendly settings refresh instead of window.location.reload()
      setTimeout(async () => {
        await refreshLocalStoreStatus();
      }, 1000);
    } catch (error) {
      onMessage?.(
        `Failed to update local store path: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      if (isMountedRef.current) {
        setIsUpdating(false);
      }
    }
  };

  const handleExitApp = () => {
    if (window.electronAPI?.closeApp) {
      window.electronAPI.closeApp();
    } else {
      // Fallback for development or if API is not available
      window.close();
    }
  };

  const renderValidationStatus = () => {
    if (isValidating) {
      return (
        <div className="flex items-center space-x-2 text-accent-primary">
          <ArrowsClockwise className="animate-spin" size={16} />
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
          <Warning className="text-accent-danger" size={24} />
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
            Please select a new local store directory or exit the application.
            The app cannot function without a valid local store.
          </p>
        </div>

        {/* Directory Selection */}
        <div className="mb-4">
          <FilePickerButton
            disabled={isUpdating}
            icon={<Folder size={16} />}
            isSelecting={isSelecting}
            onClick={handleSelectDirectory}
          >
            Choose New Local Store Directory
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
      </div>
    </div>
  );
};

export default InvalidLocalStoreDialog;
