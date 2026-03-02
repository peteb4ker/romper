import React, { useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiFolder,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";

import { useSettings } from "../../utils/SettingsContext";
import FilePickerButton from "../utils/FilePickerButton";

interface ChangeLocalStoreDirectoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

const ChangeLocalStoreDirectoryDialog: React.FC<
  ChangeLocalStoreDirectoryDialogProps
> = ({ isOpen, onClose, onMessage }) => {
  const { localStorePath, setLocalStorePath } = useSettings();
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
        setValidationResult(null);
        // Auto-validate the selected directory
        await handleValidateDirectory(path);
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

  const handleValidateDirectory = async (pathToValidate?: string) => {
    const pathToUse = pathToValidate || selectedPath;
    if (!pathToUse) return;

    setIsValidating(true);
    try {
      // Check if it's the same directory first
      if (pathToUse === localStorePath) {
        setValidationResult({
          error: "Same directory selected",
          isValid: false, // Set to false to disable the Update button
        });
        return;
      }

      if (!window.electronAPI?.validateLocalStoreBasic) {
        throw new Error("Directory validation not available");
      }

      const result =
        await window.electronAPI.validateLocalStoreBasic(pathToUse);
      if (isMountedRef.current) {
        setValidationResult({
          error: result.error,
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

  const handleUpdateDirectory = async () => {
    if (!selectedPath || !validationResult?.isValid) return;

    setIsUpdating(true);
    try {
      // Use the settings context which will automatically refresh the app state
      await setLocalStorePath(selectedPath);

      onMessage?.(
        "Local store directory updated successfully! The application has been refreshed with the new directory.",
        "success",
        5000,
      );

      // Reset dialog state
      setSelectedPath(null);
      setValidationResult(null);
      onClose();
    } catch (error) {
      onMessage?.(
        `Failed to update directory: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      if (isMountedRef.current) {
        setIsUpdating(false);
      }
    }
  };

  const handleClose = () => {
    // Reset dialog state
    setSelectedPath(null);
    setValidationResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-2 border border-border-subtle w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FiFolder className="text-accent-primary" size={24} />
            Change Local Store Directory
          </h2>
          <button
            aria-label="Close"
            className="text-text-tertiary hover:text-text-primary"
            onClick={handleClose}
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Vertical layout */}
        <div className="space-y-6 mb-6">
          {/* Current Directory */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-text-primary">
              Current Directory
            </h3>
            <div className="p-4 rounded-lg border border-border-default bg-surface-3">
              <p className="font-mono text-sm text-text-primary break-all">
                {localStorePath || (
                  <span className="text-text-tertiary italic">Not set</span>
                )}
              </p>
            </div>
          </div>

          {/* New Directory Selection */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-text-primary">
              Select New Directory
            </h3>

            {/* Directory path and button row */}
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                {selectedPath ? (
                  <div
                    className={`p-3 rounded-lg border ${
                      validationResult?.isValid &&
                      selectedPath !== localStorePath
                        ? "border-accent-success/50 bg-accent-success/10"
                        : "border-border-default bg-surface-3"
                    }`}
                  >
                    <p className="font-mono text-sm text-text-primary break-all">
                      {selectedPath}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border-2 border-dashed border-border-default bg-surface-3">
                    <p className="text-sm text-text-tertiary italic text-center">
                      No directory selected
                    </p>
                  </div>
                )}
              </div>

              <FilePickerButton
                className="px-4 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/80 flex items-center gap-2 font-medium whitespace-nowrap"
                disabled={isValidating || isUpdating}
                icon={<FiFolder size={18} />}
                isSelecting={isSelecting}
                onClick={handleSelectDirectory}
              >
                Choose Directory
              </FilePickerButton>
            </div>

            {/* Validation Messages - Only show warnings/errors */}
            {validationResult && selectedPath === localStorePath && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-accent-warning/30 bg-accent-warning/10">
                <FiAlertTriangle
                  className="text-accent-warning flex-shrink-0"
                  size={16}
                />
                <p className="text-sm text-accent-warning">
                  This is the same as your current directory. Choose a different
                  directory to make changes.
                </p>
              </div>
            )}

            {validationResult &&
              selectedPath !== localStorePath &&
              !validationResult.isValid && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10">
                  <FiAlertTriangle
                    className="text-accent-danger flex-shrink-0"
                    size={16}
                  />
                  <p className="text-sm text-accent-danger">
                    {validationResult.error ||
                      "This directory does not contain a valid Romper database."}
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 border-t border-border-subtle">
          <button
            className="px-6 py-2.5 text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:bg-surface-3 font-medium transition-colors"
            disabled={isUpdating}
            onClick={handleClose}
          >
            Cancel
          </button>

          <button
            className="px-6 py-2.5 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
            disabled={
              !selectedPath ||
              !validationResult?.isValid ||
              isUpdating ||
              selectedPath === localStorePath
            }
            onClick={handleUpdateDirectory}
          >
            {isUpdating ? (
              <FiRefreshCw className="animate-spin" size={16} />
            ) : (
              <FiCheckCircle size={16} />
            )}
            {isUpdating ? "Updating..." : "Update Directory"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeLocalStoreDirectoryDialog;
