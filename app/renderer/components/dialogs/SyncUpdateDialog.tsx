import React, { useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiDatabase,
  FiDownload,
  FiFolder,
  FiHardDrive,
  FiX,
} from "react-icons/fi";

export interface SyncChangeSummary {
  fileCount: number;
  kitCount: number;
}

export interface SyncErrorDetails {
  canRetry: boolean;
  error: string;
  fileName: string;
  operation: "convert" | "copy";
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

interface SyncProgress {
  bytesCompleted: number;
  currentFile: string;
  error?: string;
  errorDetails?: SyncErrorDetails;
  filesCompleted: number;
  status:
    | "completed"
    | "converting"
    | "copying"
    | "error"
    | "finalizing"
    | "preparing";
  totalBytes: number;
  totalFiles: number;
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
  syncProgress?: null | SyncProgress;
}

const SyncUpdateDialog: React.FC<SyncUpdateDialogProps> = ({
  isLoading = false,
  isOpen,
  kitName: _kitName,
  localChangeSummary,
  onClose,
  onConfirm,
  onGenerateChangeSummary,
  onSdCardPathChange,
  sdCardPath,
  syncProgress,
}) => {
  const [wipeSdCard, setWipeSdCard] = useState(false);
  const [localSdCardPath, setLocalSdCardPath] = useState<null | string>(
    sdCardPath || null,
  );
  const [changeSummary, setChangeSummary] = useState<null | SyncChangeSummary>(
    localChangeSummary,
  );
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    // Reset details view and generate summary when dialog opens
    if (isOpen) {
      setWipeSdCard(false);
      setLocalSdCardPath(sdCardPath || null);

      if (localChangeSummary) {
        setChangeSummary(localChangeSummary);
      } else if (onGenerateChangeSummary) {
        // Generate summary immediately when dialog opens (based on local store, not SD card)
        setIsGeneratingSummary(true);
        onGenerateChangeSummary("") // Pass empty string for SD card path since not needed for summary
          .then((summary) => {
            if (summary) {
              setChangeSummary(summary);
            }
          })
          .catch((error) => {
            console.error("Failed to generate change summary:", error);
          })
          .finally(() => {
            setIsGeneratingSummary(false);
          });
      }
    }
  }, [isOpen, sdCardPath, localChangeSummary, onGenerateChangeSummary]);

  const handleSdCardSelect = async () => {
    if (window.electronAPI?.selectSdCard) {
      const selectedPath = await window.electronAPI.selectSdCard();
      if (selectedPath) {
        setLocalSdCardPath(selectedPath);
        if (onSdCardPathChange) {
          onSdCardPathChange(selectedPath);
        }
      }
    }
  };

  const handleConfirm = () => {
    onConfirm({ sdCardPath: localSdCardPath, wipeSdCard });
  };

  if (!isOpen) return null;

  const kitCount = changeSummary?.kitCount || 0;
  const fileCount = changeSummary?.fileCount || 0;

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
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(80vh - 140px)" }}
        >
          {/* Error Section - Prioritized at top when present */}
          {syncProgress && syncProgress.status === "error" && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700">
              <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-red-800 dark:text-red-200">
                    Sync Failed
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Failed: 1 of {syncProgress.totalFiles} files
                  </div>
                </div>

                {/* Use structured error details if available, otherwise fallback to generic error */}
                {syncProgress.errorDetails ? (
                  <>
                    <div className="text-sm text-red-700 dark:text-red-300 mb-2">
                      <strong>Operation:</strong>{" "}
                      {syncProgress.errorDetails.operation === "copy"
                        ? "Copying"
                        : "Converting"}{" "}
                      file
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300 mb-2">
                      <strong>File:</strong>{" "}
                      <code className="bg-red-200 dark:bg-red-800 px-1 rounded text-xs">
                        {syncProgress.errorDetails.fileName}
                      </code>
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300 mb-2">
                      <strong>Error:</strong> {syncProgress.errorDetails.error}
                    </div>

                    {/* Actionable guidance */}
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded">
                      <div className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">
                        💡 What to do:
                      </div>
                      <div className="text-xs text-red-700 dark:text-red-300">
                        {syncProgress.errorDetails.canRetry
                          ? "This error might be temporary. You can try syncing again, or check if the SD card has enough space and proper permissions."
                          : "This error requires attention. Check that the source file exists and isn't corrupted, or verify the SD card is properly connected."}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-red-700 dark:text-red-300 mb-2">
                      {syncProgress.error ||
                        "An unexpected error occurred during sync."}
                    </div>
                    {syncProgress.currentFile && (
                      <div className="text-xs text-red-600 dark:text-red-400 mb-2">
                        Failed on file:{" "}
                        <code className="bg-red-200 dark:bg-red-800 px-1 rounded text-xs">
                          {syncProgress.currentFile}
                        </code>
                      </div>
                    )}
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded">
                      <div className="text-xs text-red-700 dark:text-red-300">
                        Try checking your SD card connection, available space,
                        and file permissions before retrying.
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Compact Sync Summary */}
            {changeSummary && (
              <div className="flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                <FiDatabase className="text-blue-600 dark:text-blue-400" />
                <div className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {kitCount} kits, {fileCount} samples
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    Ready to sync
                  </span>
                </div>
              </div>
            )}

            {/* Compact SD Card Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 border border-gray-200 dark:border-gray-600 rounded">
                <FiHardDrive className="text-gray-600 dark:text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    SD Card
                  </div>
                  {localSdCardPath ? (
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                      <span data-testid="sd-card-path">{localSdCardPath}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-500 italic">
                      No SD card selected
                    </div>
                  )}
                </div>
                <button
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                  data-testid="select-sd-card"
                  disabled={isLoading}
                  onClick={handleSdCardSelect}
                >
                  <FiFolder className="w-3 h-3" />
                  {localSdCardPath ? "Change" : "Select"}
                </button>
              </div>

              {/* Compact Wipe Option */}
              <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <input
                  checked={wipeSdCard}
                  className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  data-testid="wipe-sd-card-checkbox"
                  disabled={isLoading}
                  id="wipeSdCard"
                  onChange={(e) => setWipeSdCard(e.target.checked)}
                  type="checkbox"
                />
                <label className="flex-1 text-sm" htmlFor="wipeSdCard">
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">
                    Clear SD card before sync
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Sync Progress - Only for non-error states */}
          {syncProgress &&
            syncProgress.status !== "completed" &&
            syncProgress.status !== "error" && (
              <div className="p-4">
                <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {syncProgress.status === "preparing" &&
                        "Preparing sync..."}
                      {syncProgress.status === "copying" && "Copying files..."}
                      {syncProgress.status === "converting" &&
                        "Converting files..."}
                      {syncProgress.status === "finalizing" && "Finalizing..."}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {syncProgress.filesCompleted} / {syncProgress.totalFiles}{" "}
                      files
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300 bg-blue-600"
                      style={{
                        width: `${syncProgress.totalFiles > 0 ? (syncProgress.filesCompleted / syncProgress.totalFiles) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* Current file */}
                  {syncProgress.currentFile && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                      {syncProgress.currentFile}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Success notification */}
          {syncProgress && syncProgress.status === "completed" && (
            <div className="p-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <div className="flex items-center gap-3">
                  <FiCheckCircle className="text-green-600 dark:text-green-400 text-xl" />
                  <div>
                    <div className="font-medium text-green-800 dark:text-green-200">
                      Sync Complete!
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      Successfully synced {syncProgress.filesCompleted} files to
                      SD card
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              data-testid="cancel-sync"
              disabled={isLoading}
              onClick={onClose}
            >
              {syncProgress?.status === "error" ? "Close" : "Cancel"}
            </button>

            {/* Show retry button for retryable errors */}
            {syncProgress?.status === "error" &&
              syncProgress?.errorDetails?.canRetry && (
                <button
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  data-testid="retry-sync"
                  disabled={isLoading}
                  onClick={handleConfirm}
                >
                  <FiCheckCircle />
                  Retry Sync
                </button>
              )}

            {/* Show start sync button when not in error state or for non-retryable errors */}
            {(!syncProgress ||
              syncProgress.status !== "error" ||
              !syncProgress.errorDetails?.canRetry) && (
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                data-testid="confirm-sync"
                disabled={
                  isLoading ||
                  isGeneratingSummary ||
                  !changeSummary ||
                  fileCount === 0 ||
                  !localSdCardPath ||
                  (syncProgress?.status === "error" &&
                    !syncProgress?.errorDetails?.canRetry)
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
                    {syncProgress?.status === "error"
                      ? "Start New Sync"
                      : "Start Sync"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncUpdateDialog;
