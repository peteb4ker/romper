import {
  ArrowsClockwise,
  Check,
  CheckCircle,
  DownloadSimple,
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
    if (!isOpen) return;

    setIsClosing(false);
    setLocalSdCardPath(sdCardPath || null);

    if (localChangeSummary) {
      setChangeSummary(localChangeSummary);
      return;
    }

    if (!onGenerateChangeSummary) return;

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
  }, [isOpen, sdCardPath, localChangeSummary, onGenerateChangeSummary]);

  const handleSdCardSelect = async () => {
    if (!window.electronAPI?.selectSdCard) return;

    const selectedPath = await window.electronAPI.selectSdCard();
    if (!selectedPath) return;

    setLocalSdCardPath(selectedPath);
    onSdCardPathChange?.(selectedPath);
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
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-subtle relative z-10"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--accent-primary) 8%, var(--surface-2))",
        }}
      >
        <div className="flex items-center gap-2">
          <DownloadSimple
            className="text-accent-primary"
            size={16}
            weight="bold"
          />
          <h2 className="text-sm font-semibold text-text-primary">
            Write to SD Card
          </h2>
        </div>
        <button
          aria-label="Close write dialog"
          className="p-1 rounded hover:bg-surface-3 text-text-tertiary disabled:opacity-50"
          disabled={isLoading}
          onClick={handleClose}
        >
          <X size={16} />
        </button>
      </div>

      {/* Write Progress — pinned at top */}
      {syncProgress && syncProgress.status !== "error" && (
        <div className="px-4 py-2 border-b border-border-subtle">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary font-medium">
                {syncProgress.status === "preparing" && (
                  <span className="flex items-center gap-1">
                    <Spinner className="animate-spin" size={12} />
                    Preparing...
                  </span>
                )}
                {(syncProgress.status === "copying" ||
                  syncProgress.status === "converting") && (
                  <span className="flex items-center gap-1">
                    <Spinner className="animate-spin" size={12} />
                    Writing{" "}
                    {syncProgress.currentKitName && (
                      <span
                        className="font-mono"
                        data-testid="current-kit-name"
                      >
                        {syncProgress.currentKitName}
                      </span>
                    )}
                  </span>
                )}
                {syncProgress.status === "finalizing" && "Finalizing..."}
                {syncProgress.status === "completed" && (
                  <span className="text-accent-success flex items-center gap-1">
                    <CheckCircle size={12} weight="fill" />
                    Write Complete
                  </span>
                )}
              </span>
              <span className="text-text-tertiary tabular-nums">
                {syncProgress.filesCompleted}/{syncProgress.totalFiles}
              </span>
            </div>
            <div className="w-full bg-surface-3 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  syncProgress.status === "completed"
                    ? "bg-accent-success"
                    : "bg-accent-primary"
                }`}
                style={{
                  width: `${syncProgress.totalFiles > 0 ? (syncProgress.filesCompleted / syncProgress.totalFiles) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Inline Error — pinned at top */}
      {syncProgress?.status === "error" && (
        <div className="px-4 py-2 border-b border-border-subtle">
          <div className="p-2.5 bg-accent-danger/10 border border-accent-danger/20 rounded text-xs">
            <div className="font-medium text-accent-danger mb-1">
              Write Failed
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
                    This might be temporary. Try writing again.
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {isGeneratingSummary && (
          <div className="px-4 py-6 flex items-center justify-center gap-2 text-text-tertiary text-sm">
            <Spinner className="animate-spin" size={16} />
            <span>Scanning kits...</span>
          </div>
        )}

        {/* Bank Summary — table with totals */}
        {banks.length > 0 && (
          <div className="px-4 py-2" data-testid="bank-summary">
            <div className="rounded border border-border-subtle overflow-hidden">
              <div className="flex items-center px-2.5 py-1 text-[10px] text-text-tertiary uppercase tracking-wider bg-surface-3/50 border-b border-border-subtle">
                <span className="w-10 shrink-0">Bank</span>
                <span className="flex-1 text-right">Kits</span>
                <span className="flex-1 text-right">Samples</span>
                {conversionsNeeded && <span className="w-14 text-right" />}
              </div>
              <div className="divide-y divide-border-subtle">
                {banks.map((bank) => (
                  <div
                    className="flex items-center px-2.5 py-1.5 text-xs bg-surface-3/30"
                    data-testid={`bank-${bank.bank}`}
                    key={bank.bank}
                  >
                    <span className="font-mono font-bold text-text-primary w-10 shrink-0">
                      {bank.bank}
                    </span>
                    <span className="text-text-secondary tabular-nums flex-1 text-right">
                      {bank.kitCount}
                    </span>
                    <span className="text-text-tertiary tabular-nums flex-1 text-right">
                      {bank.fileCount}
                    </span>
                    {conversionsNeeded && (
                      <span className="w-14 text-right">
                        {bank.hasConversions && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-accent-warning">
                            <span className="w-1 h-1 rounded-full bg-accent-warning" />{" "}
                            convert
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="flex items-center px-2.5 py-1.5 text-xs border-t border-border-subtle bg-surface-3/50">
                <span className="w-10 shrink-0" />
                <span
                  className="font-semibold text-text-primary tabular-nums flex-1 text-right"
                  data-testid="total-kits"
                >
                  {kitCount}
                </span>
                <span
                  className="font-semibold text-text-primary tabular-nums flex-1 text-right"
                  data-testid="total-samples"
                >
                  {fileCount}
                </span>
                {conversionsNeeded && <span className="w-14" />}
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
                : "border-accent-primary/30 bg-accent-primary/5"
            }`}
          >
            <HardDrive
              className={
                localSdCardPath ? "text-text-tertiary" : "text-accent-primary"
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

          {/* Wipe SD Card */}
          <label
            className="flex items-center gap-2 px-2 py-1.5 cursor-pointer group"
            htmlFor="wipeSdCard"
          >
            <input
              checked={wipeSdCard}
              className="sr-only peer"
              data-testid="wipe-sd-card-checkbox"
              disabled={isLoading}
              id="wipeSdCard"
              onChange={(e) => setWipeSdCard(e.target.checked)}
              type="checkbox"
            />
            <div className="w-3.5 h-3.5 rounded-sm border border-border-default bg-surface-3 shrink-0 flex items-center justify-center peer-checked:bg-accent-danger peer-checked:border-accent-danger transition-colors">
              {wipeSdCard && (
                <Check className="text-white" size={10} weight="bold" />
              )}
            </div>
            <span className="text-[11px] text-text-tertiary flex items-center gap-1 group-hover:text-text-secondary transition-colors">
              <Trash size={11} />
              Clear SD card before writing
            </span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-3 border-t border-border-subtle relative z-10"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--accent-primary) 8%, var(--surface-2))",
        }}
      >
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

          {(syncProgress?.status !== "error" ||
            !syncProgress?.errorDetails?.canRetry) && (
            <button
              className="px-3 py-1.5 text-xs bg-accent-primary text-white rounded font-semibold hover:bg-accent-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
                  Writing...
                </>
              ) : (
                <>
                  <DownloadSimple size={12} weight="bold" />
                  {syncProgress?.status === "error"
                    ? "Start New Write"
                    : "Start Write"}
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
