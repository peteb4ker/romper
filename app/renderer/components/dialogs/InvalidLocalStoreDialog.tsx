import React, { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiFolder, FiRefreshCw } from "react-icons/fi";

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
      container: "rounded bg-gray-50 p-2",
      label: "text-xs text-gray-600 mb-1",
      path: "text-sm font-mono text-gray-800 break-all",
    },
    selected: {
      container: "rounded bg-blue-50 p-3",
      label: "text-xs text-blue-600 mb-1",
      path: "text-sm font-mono text-blue-800 break-all",
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
        <div className="flex items-center space-x-2 text-blue-600">
          <FiRefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Validating directory...</span>
        </div>
      );
    }

    if (validationResult?.isValid) {
      return (
        <div className="rounded bg-green-50 p-2">
          <p className="text-sm text-green-700">
            ✓ Valid local store directory
          </p>
        </div>
      );
    }

    return (
      <div className="rounded bg-red-50 p-2">
        <p className="text-sm text-red-700">
          ✗ {validationResult?.error || "Invalid directory"}
        </p>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center space-x-3">
          <FiAlertTriangle className="h-6 w-6 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Invalid Local Store
          </h2>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-3">{errorMessage}</p>

          {localStorePath && (
            <div className="mb-3">
              <PathDisplay
                label="Current path"
                path={localStorePath}
                variant="current"
              />
            </div>
          )}

          <p className="text-sm text-gray-600">
            Please select a new local store directory or exit the application.
            The app cannot function without a valid local store.
          </p>
        </div>

        {/* Directory Selection */}
        <div className="mb-4">
          <FilePickerButton
            disabled={isUpdating}
            icon={<FiFolder />}
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
            className="flex-1 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-300"
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
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:bg-gray-300"
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
