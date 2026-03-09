import {
  ArrowsClockwise,
  CheckCircle,
  Folder,
  HardDrive,
  Spinner,
  Trash,
  X,
} from "@phosphor-icons/react";
import React, { useEffect, useState } from "react";

import type {
  SyncChangeSummary,
  SyncUpdateDialogProps,
} from "./SyncUpdateDialog.types.js";

export type { SyncChangeSummary };

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
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setLocalSdCardPath(sdCardPath || null);

      if (localChangeSummary) {
        setChangeSummary(localChangeSummary);
      } else if (onGenerateChangeSummary) {
        setIsGeneratingSummary(true);
        onGenerateChangeSummary("")
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

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  if (!isOpen) return null;

  const kitCount = changeSummary?.kitCount || 0;
  const fileCount = changeSummary?.fileCount || 0;
  const banks = changeSummary?.banks || [];
  const conversionsNeeded = banks.some((b) => b.hasConversions);

  return (
    <div
      className={`fixed right-0 top-0 h-full w-[380px] z-50 flex flex-col card-grain border-l border-border-subtle shadow-[−8px_0_40px_rgba(0,0,0,0.3)] ${
        isClosing ? "animate-sync-panel-exit" : "animate-sync-panel-enter"
      }`}
      data-testid="sync-dialog"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <ArrowsClockwise
            className="text-accent-sync"
            size={16}
            weight="bold"
          />
          <h2 className="text-sm font-semibold text-text-primary">
            Write to SD Card
          </h2>
        </div>
        <button
          aria-label="Close sync dialog"
          className="p-1 rounded hover:bg-surface-3 text-text-tertiary disabled:opacity-50"
          disabled={isLoading}
          onClick={handleClose}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Summary */}
        {changeSummary && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <span className="font-medium text-text-secondary">
                {kitCount} {kitCount === 1 ? "kit" : "kits"}
              </span>
              <span>&middot;</span>
              <span>
                {fileCount} {fileCount === 1 ? "sample" : "samples"}
              </span>
              {conversionsNeeded && !syncProgress && (
                <>
                  <span>&middot;</span>
                  <span className="text-accent-warning font-medium">
                    conversions needed
                  </span>
                </>
              )}
              {syncProgress?.status === "completed" && (
                <>
                  <span>&middot;</span>
                  <span className="text-accent-success font-medium">Done</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isGeneratingSummary && (
          <div className="px-4 py-6 flex items-center justify-center gap-2 text-text-tertiary text-sm">
            <Spinner className="animate-spin" size={16} />
            <span>Scanning kits...</span>
          </div>
        )}

        {/* Bank Summary — compact row per bank (max 26) */}
        {banks.length > 0 && !syncProgress && (
          <div className="px-4 py-2" data-testid="bank-summary">
            <div className="flex flex-wrap gap-1.5">
              {banks.map((bank) => (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded bg-surface-3 text-xs"
                  data-testid={`bank-${bank.bank}`}
                  key={bank.bank}
                >
                  <span className="font-mono font-semibold text-text-primary">
                    {bank.bank}
                  </span>
                  <span className="text-text-tertiary tabular-nums">
                    {bank.kitCount}k/{bank.fileCount}f
                  </span>
                  {bank.hasConversions && (
                    <span className="text-[9px] px-1 rounded bg-accent-warning/15 text-accent-warning font-medium">
                      CVT
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inline Error */}
        {syncProgress?.status === "error" && (
          <div className="px-4 py-2">
            <div className="p-2.5 bg-accent-danger/10 border border-accent-danger/20 rounded text-xs">
              <div className="font-medium text-accent-danger mb-1">
                Sync Failed
                {syncProgress.errorDetails?.kitName && (
                  <span className="font-normal text-accent-danger/70">
                    {" "}
                    &middot; {syncProgress.errorDetails.kitName}
                  </span>
                )}
              </div>
              {syncProgress.errorDetails ? (
                <>
                  <div className="text-accent-danger/80 mb-1">
                    {syncProgress.errorDetails.operation === "copy"
                      ? "Copying"
                      : "Converting"}{" "}
                    <code className="bg-accent-danger/15 px-1 rounded">
                      {syncProgress.errorDetails.fileName}
                    </code>
                  </div>
                  <div className="text-accent-danger/70">
                    {syncProgress.errorDetails.error}
                  </div>
                  {syncProgress.errorDetails.canRetry && (
                    <div className="mt-1.5 text-text-tertiary">
                      This might be temporary. Try syncing again.
                    </div>
                  )}
                </>
              ) : (
                <div className="text-accent-danger/80">
                  {syncProgress.error || "An unexpected error occurred."}
                  {syncProgress.currentFile && (
                    <span>
                      {" "}
                      Failed on:{" "}
                      <code className="bg-accent-danger/15 px-1 rounded">
                        {syncProgress.currentFile}
                      </code>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sync Progress */}
        {syncProgress &&
          syncProgress.status !== "completed" &&
          syncProgress.status !== "error" && (
            <div className="px-4 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary font-medium">
                    {syncProgress.status === "preparing" && "Preparing..."}
                    {syncProgress.status === "copying" && "Copying files..."}
                    {syncProgress.status === "converting" && "Converting..."}
                    {syncProgress.status === "finalizing" && "Finalizing..."}
                  </span>
                  <span className="text-text-tertiary tabular-nums">
                    {syncProgress.filesCompleted}/{syncProgress.totalFiles}
                  </span>
                </div>
                {syncProgress.currentKitName && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Spinner
                      className="text-accent-sync animate-spin shrink-0"
                      size={11}
                    />
                    <span
                      className="text-accent-sync font-mono font-medium"
                      data-testid="current-kit-name"
                    >
                      {syncProgress.currentKitName}
                    </span>
                  </div>
                )}
                <div className="w-full bg-surface-3 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-300 bg-accent-sync"
                    style={{
                      width: `${syncProgress.totalFiles > 0 ? (syncProgress.filesCompleted / syncProgress.totalFiles) * 100 : 0}%`,
                    }}
                  />
                </div>
                {syncProgress.currentFile && (
                  <div className="text-[11px] text-text-tertiary truncate font-mono">
                    {syncProgress.currentFile}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Success State */}
        {syncProgress?.status === "completed" && (
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 p-2.5 bg-accent-success/10 border border-accent-success/20 rounded">
              <CheckCircle
                className="text-accent-success shrink-0"
                size={16}
                weight="fill"
              />
              <div className="text-xs">
                <span className="font-medium text-accent-success">
                  Sync Complete
                </span>
                <span className="text-accent-success/70 ml-1">
                  &middot; {syncProgress.filesCompleted} files
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SD Card Selection */}
        <div className="px-4 py-2 space-y-2">
          <div
            className={`flex items-center gap-2 p-2 rounded border transition-colors ${
              localSdCardPath
                ? "border-border-subtle bg-surface-3/50"
                : "border-accent-sync/30 bg-accent-sync/5"
            }`}
          >
            <HardDrive
              className={
                localSdCardPath ? "text-text-tertiary" : "text-accent-sync"
              }
              size={14}
            />
            <div className="flex-1 min-w-0">
              {localSdCardPath ? (
                <div
                  className="text-xs text-text-secondary font-mono truncate"
                  data-testid="sd-card-path"
                >
                  {localSdCardPath}
                </div>
              ) : (
                <div className="text-xs text-text-tertiary italic">
                  No SD card selected
                </div>
              )}
            </div>
            <button
              className="px-2 py-1 text-[11px] bg-surface-3 text-text-secondary rounded hover:bg-surface-4 transition-colors flex items-center gap-1 shrink-0"
              data-testid="select-sd-card"
              disabled={isLoading}
              onClick={handleSdCardSelect}
            >
              <Folder size={11} />
              {localSdCardPath ? "Change" : "Select"}
            </button>
          </div>

          {/* Wipe SD Card — always visible checkbox */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <input
              checked={wipeSdCard}
              className="w-3.5 h-3.5 text-accent-danger bg-surface-3 border-border-default rounded focus:ring-accent-danger focus:ring-1"
              data-testid="wipe-sd-card-checkbox"
              disabled={isLoading}
              id="wipeSdCard"
              onChange={(e) => setWipeSdCard(e.target.checked)}
              type="checkbox"
            />
            <label
              className="text-[11px] text-text-tertiary"
              htmlFor="wipeSdCard"
            >
              <span className="flex items-center gap-1">
                <Trash className="text-text-tertiary" size={11} />
                Clear SD card before sync
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
        <button
          className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded hover:bg-surface-3 transition-colors disabled:opacity-50"
          data-testid="cancel-sync"
          disabled={isLoading}
          onClick={handleClose}
        >
          {syncProgress?.status === "error" ||
          syncProgress?.status === "completed"
            ? "Close"
            : "Cancel"}
        </button>

        <div className="flex gap-2">
          {syncProgress?.status === "error" &&
            syncProgress?.errorDetails?.canRetry && (
              <button
                className="px-3 py-1.5 text-xs bg-accent-warning text-white rounded font-semibold hover:bg-accent-warning/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                data-testid="retry-sync"
                disabled={isLoading}
                onClick={handleConfirm}
              >
                <ArrowsClockwise size={12} weight="bold" />
                Retry
              </button>
            )}

          {(!syncProgress ||
            syncProgress.status !== "error" ||
            !syncProgress.errorDetails?.canRetry) && (
            <button
              className="px-3 py-1.5 text-xs bg-accent-sync text-white rounded font-semibold hover:bg-accent-sync/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
                  <Spinner className="animate-spin" size={12} />
                  Syncing...
                </>
              ) : (
                <>
                  <ArrowsClockwise size={12} weight="bold" />
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
  );
};

export default SyncUpdateDialog;
