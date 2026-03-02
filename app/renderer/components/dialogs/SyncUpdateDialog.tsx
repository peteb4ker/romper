import {
  CheckCircle,
  Database,
  DownloadSimple,
  Folder,
  HardDrive,
  X,
} from "@phosphor-icons/react";
import React, { useEffect, useState } from "react";

import type {
  SyncChangeSummary,
  SyncUpdateDialogProps,
} from "./SyncUpdateDialog.types.js";

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
      // Don't reset wipeSdCard - preserve user's choice across dialog openings
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className="bg-surface-2 rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-border-subtle w-full max-w-2xl max-h-[80vh] overflow-hidden"
        data-testid="sync-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <DownloadSimple className="text-accent-primary" size={18} />
            <h2 className="text-lg font-semibold text-text-primary">
              Sync All Kits to SD Card
            </h2>
          </div>
          <button
            aria-label="Close sync dialog"
            className="p-1 rounded hover:bg-surface-3 text-text-tertiary disabled:opacity-50"
            disabled={isLoading}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(80vh - 140px)" }}
        >
          {/* Error Section - Prioritized at top when present */}
          {syncProgress && syncProgress.status === "error" && (
            <div className="p-4 bg-accent-danger/10 border-b border-accent-danger/30">
              <div className="mb-3 p-3 bg-accent-danger/15 border border-accent-danger/30 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-accent-danger">
                    Sync Failed
                  </div>
                  <div className="text-xs text-accent-danger/80">
                    Failed: 1 of {syncProgress.totalFiles} files
                  </div>
                </div>

                {/* Use structured error details if available, otherwise fallback to generic error */}
                {syncProgress.errorDetails ? (
                  <>
                    <div className="text-sm text-accent-danger mb-2">
                      <strong>Operation:</strong>{" "}
                      {syncProgress.errorDetails.operation === "copy"
                        ? "Copying"
                        : "Converting"}{" "}
                      file
                    </div>
                    <div className="text-sm text-accent-danger mb-2">
                      <strong>File:</strong>{" "}
                      <code className="bg-accent-danger/20 px-1 rounded text-xs">
                        {syncProgress.errorDetails.fileName}
                      </code>
                    </div>
                    <div className="text-sm text-accent-danger mb-2">
                      <strong>Error:</strong> {syncProgress.errorDetails.error}
                    </div>

                    {/* Actionable guidance */}
                    <div className="mt-2 p-2 bg-accent-danger/10 border border-accent-danger/30 rounded">
                      <div className="text-xs font-medium text-accent-danger mb-1">
                        💡 What to do:
                      </div>
                      <div className="text-xs text-accent-danger/80">
                        {syncProgress.errorDetails.canRetry
                          ? "This error might be temporary. You can try syncing again, or check if the SD card has enough space and proper permissions."
                          : "This error requires attention. Check that the source file exists and isn't corrupted, or verify the SD card is properly connected."}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-accent-danger mb-2">
                      {syncProgress.error ||
                        "An unexpected error occurred during sync."}
                    </div>
                    {syncProgress.currentFile && (
                      <div className="text-xs text-accent-danger/80 mb-2">
                        Failed on file:{" "}
                        <code className="bg-accent-danger/20 px-1 rounded text-xs">
                          {syncProgress.currentFile}
                        </code>
                      </div>
                    )}
                    <div className="mt-2 p-2 bg-accent-danger/10 border border-accent-danger/30 rounded">
                      <div className="text-xs text-accent-danger/80">
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
              <div className="flex items-center gap-3 p-2 bg-accent-primary/10 rounded">
                <Database className="text-accent-primary" size={16} />
                <div className="text-sm">
                  <span className="font-medium text-text-primary">
                    {kitCount} kits, {fileCount} samples
                  </span>
                  <span className="text-text-tertiary ml-2">Ready to sync</span>
                </div>
              </div>
            )}

            {/* Compact SD Card Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 border border-border-default rounded">
                <HardDrive className="text-text-tertiary" size={16} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary">
                    SD Card
                  </div>
                  {localSdCardPath ? (
                    <div className="text-xs text-text-tertiary font-mono truncate">
                      <span data-testid="sd-card-path">{localSdCardPath}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-text-tertiary italic">
                      No SD card selected
                    </div>
                  )}
                </div>
                <button
                  className="px-2 py-1 text-xs bg-surface-3 text-text-secondary rounded hover:bg-surface-4 transition-colors flex items-center gap-1"
                  data-testid="select-sd-card"
                  disabled={isLoading}
                  onClick={handleSdCardSelect}
                >
                  <Folder size={12} />
                  {localSdCardPath ? "Change" : "Select"}
                </button>
              </div>

              {/* Compact Wipe Option */}
              <div className="flex items-center gap-2 p-2 bg-accent-warning/10 border border-accent-warning/30 rounded">
                <input
                  checked={wipeSdCard}
                  className="w-4 h-4 text-accent-warning bg-surface-3 border-border-default rounded focus:ring-accent-warning focus:ring-2"
                  data-testid="wipe-sd-card-checkbox"
                  disabled={isLoading}
                  id="wipeSdCard"
                  onChange={(e) => setWipeSdCard(e.target.checked)}
                  type="checkbox"
                />
                <label className="flex-1 text-sm" htmlFor="wipeSdCard">
                  <span className="font-medium text-accent-warning">
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
                <div className="bg-surface-3 p-3 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-text-primary">
                      {syncProgress.status === "preparing" &&
                        "Preparing sync..."}
                      {syncProgress.status === "copying" && "Copying files..."}
                      {syncProgress.status === "converting" &&
                        "Converting files..."}
                      {syncProgress.status === "finalizing" && "Finalizing..."}
                    </div>
                    <div className="text-sm text-text-tertiary">
                      {syncProgress.filesCompleted} / {syncProgress.totalFiles}{" "}
                      files
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-surface-3 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300 bg-accent-primary"
                      style={{
                        width: `${syncProgress.totalFiles > 0 ? (syncProgress.filesCompleted / syncProgress.totalFiles) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* Current file */}
                  {syncProgress.currentFile && (
                    <div className="mt-2 text-xs text-text-tertiary truncate">
                      {syncProgress.currentFile}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Success notification */}
          {syncProgress && syncProgress.status === "completed" && (
            <div className="p-4">
              <div className="p-3 bg-accent-success/10 border border-accent-success/30 rounded">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-accent-success" size={20} />
                  <div>
                    <div className="font-medium text-accent-success">
                      Sync Complete!
                    </div>
                    <div className="text-sm text-accent-success/80">
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
        <div className="flex justify-end items-center p-4 border-t border-border-subtle">
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-text-secondary border border-border-default rounded hover:bg-surface-3 transition-colors disabled:opacity-50"
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
                  className="px-4 py-2 bg-accent-warning text-white rounded hover:bg-accent-warning/80 transition-colors disabled:opacity-50 flex items-center gap-2"
                  data-testid="retry-sync"
                  disabled={isLoading}
                  onClick={handleConfirm}
                >
                  <CheckCircle size={16} />
                  Retry Sync
                </button>
              )}

            {/* Show start sync button when not in error state or for non-retryable errors */}
            {(!syncProgress ||
              syncProgress.status !== "error" ||
              !syncProgress.errorDetails?.canRetry) && (
              <button
                className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors disabled:opacity-50 flex items-center gap-2"
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
                    <CheckCircle size={16} />
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
