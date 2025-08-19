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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FiFolder className="text-blue-500" size={24} />
            Change Local Store Directory
          </h2>
          <button
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={handleClose}
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Vertical layout */}
        <div className="space-y-6 mb-6">
          {/* Current Directory */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Current Directory
            </h3>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700">
              <p className="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                {localStorePath || (
                  <span className="text-gray-500 dark:text-gray-400 italic">
                    Not set
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* New Directory Selection */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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
                        ? "border-green-300 bg-green-50 dark:border-green-500 dark:bg-green-900/20"
                        : "border-gray-200 bg-gray-50 dark:border-slate-600 dark:bg-slate-700"
                    }`}
                  >
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                      {selectedPath}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">
                      No directory selected
                    </p>
                  </div>
                )}
              </div>

              <FilePickerButton
                className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 font-medium whitespace-nowrap"
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
              <div className="flex items-center gap-2 p-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-900/20">
                <FiAlertTriangle
                  className="text-yellow-600 dark:text-yellow-400 flex-shrink-0"
                  size={16}
                />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  This is the same as your current directory. Choose a different
                  directory to make changes.
                </p>
              </div>
            )}

            {validationResult &&
              selectedPath !== localStorePath &&
              !validationResult.isValid && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20">
                  <FiAlertTriangle
                    className="text-red-600 dark:text-red-400 flex-shrink-0"
                    size={16}
                  />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {validationResult.error ||
                      "This directory does not contain a valid Romper database."}
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-slate-600">
          <button
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition-colors"
            disabled={isUpdating}
            onClick={handleClose}
          >
            Cancel
          </button>

          <button
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
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
