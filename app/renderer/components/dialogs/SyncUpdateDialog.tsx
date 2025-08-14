import React, { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDatabase,
  FiDownload,
  FiFile,
  FiFolder,
  FiHardDrive,
  FiX,
} from "react-icons/fi";

export interface SyncChangeSummary {
  estimatedSize: number; // in bytes
  estimatedTime: number; // in seconds
  filesToConvert: SyncFileOperation[];
  filesToCopy: SyncFileOperation[];
  hasFormatWarnings: boolean;
  validationErrors: SyncValidationError[];
  warnings: string[];
}

export interface SyncFileOperation {
  destinationPath: string;
  filename: string;
  operation: "convert" | "copy";
  originalFormat?: string;
  reason?: string;
  sourcePath: string;
  targetFormat?: string;
}

export interface SyncValidationError {
  error: string;
  filename: string;
  sourcePath: string;
  type: "access_denied" | "invalid_format" | "missing_file" | "other";
}

interface SyncUpdateDialogProps {
  isLoading?: boolean;
  isOpen: boolean;
  kitName: string;
  localChangeSummary: null | SyncChangeSummary;
  onClose: () => void;
  onConfirm: (options: {
    sdCardPath: null | string;
    wipeSdCard: boolean;
  }) => void;
  onGenerateChangeSummary?: (
    sdCardPath: string,
  ) => Promise<null | SyncChangeSummary>;
  onSdCardPathChange?: (path: null | string) => void;
  sdCardPath?: null | string;
}

const SyncUpdateDialog: React.FC<SyncUpdateDialogProps> = ({
  isLoading = false,
  isOpen,
  kitName,
  localChangeSummary,
  onClose,
  onConfirm,
  onGenerateChangeSummary,
  onSdCardPathChange,
  sdCardPath,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [wipeSdCard, setWipeSdCard] = useState(false);
  const [localSdCardPath, setLocalSdCardPath] = useState<null | string>(
    sdCardPath || null,
  );
  const [changeSummary, setChangeSummary] = useState<null | SyncChangeSummary>(
    localChangeSummary,
  );
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    // Reset details view when dialog opens
    if (isOpen) {
      setShowDetails(false);
      setWipeSdCard(false);
      setLocalSdCardPath(sdCardPath || null);
      setChangeSummary(localChangeSummary);

      // If we have an SD card path from environment (test mode), generate summary automatically
      if (
        sdCardPath &&
        !changeSummary &&
        onGenerateChangeSummary &&
        !isGeneratingSummary
      ) {
        console.log("Auto-generating change summary for path:", sdCardPath);
        setIsGeneratingSummary(true);
        onGenerateChangeSummary(sdCardPath)
          .then((summary) => {
            console.log("Change summary generated:", summary);
            if (summary) {
              setChangeSummary(summary);
            }
            setIsGeneratingSummary(false);
          })
          .catch((error) => {
            console.error("Failed to generate change summary:", error);
            setIsGeneratingSummary(false);
          });
      }
    }
  }, [
    isOpen,
    sdCardPath,
    changeSummary,
    onGenerateChangeSummary,
    isGeneratingSummary,
    localChangeSummary,
  ]);

  const handleSdCardSelect = async () => {
    if (window.electronAPI?.selectSdCard) {
      const selectedPath = await window.electronAPI.selectSdCard();
      if (selectedPath) {
        setLocalSdCardPath(selectedPath);
        if (onSdCardPathChange) {
          onSdCardPathChange(selectedPath);
        }

        // Generate change summary after selecting SD card
        if (onGenerateChangeSummary) {
          setIsGeneratingSummary(true);
          try {
            const summary = await onGenerateChangeSummary(selectedPath);
            if (summary) {
              setChangeSummary(summary);
            }
          } catch (error) {
            console.error("Failed to generate change summary:", error);
          } finally {
            setIsGeneratingSummary(false);
          }
        }
      }
    }
  };

  const handleConfirm = () => {
    onConfirm({ sdCardPath: localSdCardPath, wipeSdCard });
  };

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  };

  const totalFiles = changeSummary
    ? (changeSummary?.filesToCopy?.length || 0) +
      (changeSummary?.filesToConvert?.length || 0)
    : 0;
  const hasValidationErrors =
    changeSummary?.validationErrors &&
    changeSummary.validationErrors.length > 0;

  const getStatusMessage = () => {
    if (!localSdCardPath) {
      return (
        <span className="text-red-600 dark:text-red-400">
          Please select an SD card location to continue
        </span>
      );
    }

    if (hasValidationErrors) {
      return (
        <span className="text-red-600 dark:text-red-400">
          Cannot sync - {changeSummary?.validationErrors?.length || 0} file
          {(changeSummary?.validationErrors?.length || 0) !== 1 ? "s" : ""}{" "}
          missing
        </span>
      );
    }

    if (totalFiles === 0) {
      return "No changes to sync";
    }

    return (
      <>
        This will copy {totalFiles} file{totalFiles !== 1 ? "s" : ""} to your SD
        card
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        data-testid="sync-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FiDownload className="text-lg text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Sync All Kits to SD Card
            </h2>
          </div>
          <button
            aria-label="Close sync dialog"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
            disabled={isLoading}
            onClick={onClose}
          >
            <FiX />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-96">
          {/* Kit Info */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <FiDatabase className="text-blue-600 dark:text-blue-400" />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {kitName === "All Kits" ? "All Kits" : `Kit ${kitName}`}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Ready to sync to SD card
              </div>
            </div>
          </div>

          {/* SD Card Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
              <FiHardDrive className="text-gray-600 dark:text-gray-400" />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  SD Card Location
                </div>
                {localSdCardPath ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    <span data-testid="sd-card-path">{localSdCardPath}</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-500 italic">
                    No SD card selected
                  </div>
                )}
              </div>
              <button
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                data-testid="select-sd-card"
                disabled={isLoading}
                onClick={handleSdCardSelect}
              >
                <FiFolder className="w-4 h-4" />
                {localSdCardPath ? "Change" : "Select"}
              </button>
            </div>

            {/* Wipe Option */}
            {localSdCardPath && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <input
                  checked={wipeSdCard}
                  className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  data-testid="wipe-sd-card-checkbox"
                  disabled={isLoading}
                  id="wipeSdCard"
                  onChange={(e) => setWipeSdCard(e.target.checked)}
                  type="checkbox"
                />
                <label className="flex-1" htmlFor="wipeSdCard">
                  <div className="font-medium text-yellow-800 dark:text-yellow-200">
                    Clear SD card before sync
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    This will delete all existing files on the SD card before
                    copying new ones
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalFiles}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Files
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {changeSummary
                  ? formatFileSize(changeSummary.estimatedSize)
                  : "-"}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Size
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {changeSummary ? formatTime(changeSummary.estimatedTime) : "-"}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Est. Time
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {changeSummary?.validationErrors &&
            changeSummary.validationErrors.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <FiX className="text-red-600 dark:text-red-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-800 dark:text-red-200">
                      Sync Cannot Proceed
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                      The following files cannot be accessed:
                    </div>
                    <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1">
                      {changeSummary?.validationErrors?.map((error) => (
                        <li
                          className="flex items-start gap-1"
                          key={error.sourcePath}
                        >
                          <span className="text-red-600 dark:text-red-400 mt-0.5">
                            •
                          </span>
                          <div>
                            <div className="font-mono">{error.filename}</div>
                            <div className="text-xs">{error.sourcePath}</div>
                            <div className="text-xs italic">{error.error}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

          {/* Warnings */}
          {changeSummary?.hasFormatWarnings && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <FiAlertTriangle className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <div className="font-medium text-yellow-800 dark:text-yellow-200">
                    Format Conversion Required
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Some samples need format conversion during sync:
                  </div>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                    {changeSummary?.warnings?.map((warning) => (
                      <li className="flex items-start gap-1" key={warning}>
                        <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">
                          •
                        </span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Operation Summary */}
          <div className="space-y-3" data-testid="sync-summary-stats">
            {(changeSummary?.filesToCopy?.length || 0) > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <FiFile className="text-green-600 dark:text-green-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {changeSummary?.filesToCopy?.length || 0} file(s) will be
                  copied directly
                </span>
              </div>
            )}
            {(changeSummary?.filesToConvert?.length || 0) > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <FiHardDrive className="text-blue-600 dark:text-blue-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {changeSummary?.filesToConvert?.length || 0} file(s) will be
                  converted during copy
                </span>
              </div>
            )}
          </div>

          {/* Details Toggle */}
          <div>
            <button
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </button>
          </div>

          {/* File Details */}
          {showDetails && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {(changeSummary?.filesToCopy?.length || 0) > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Files to Copy
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {changeSummary?.filesToCopy?.map((file) => (
                      <div
                        className="text-sm p-2 bg-gray-50 dark:bg-slate-700 rounded"
                        key={file.sourcePath}
                      >
                        <div className="font-mono text-gray-900 dark:text-gray-100">
                          {file.filename}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                          {file.sourcePath}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(changeSummary?.filesToConvert?.length || 0) > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Files to Convert
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {changeSummary?.filesToConvert?.map((file) => (
                      <div
                        className="text-sm p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded"
                        key={file.sourcePath}
                      >
                        <div className="font-mono text-gray-900 dark:text-gray-100">
                          {file.filename}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                          {file.originalFormat} → {file.targetFormat}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs">
                          {file.sourcePath}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getStatusMessage()}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              data-testid="cancel-sync"
              disabled={isLoading}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              data-testid="confirm-sync"
              disabled={
                isLoading ||
                isGeneratingSummary ||
                !changeSummary ||
                totalFiles === 0 ||
                hasValidationErrors ||
                !localSdCardPath
              }
              onClick={handleConfirm}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <FiCheckCircle />
                  Start Sync
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncUpdateDialog;
