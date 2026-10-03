import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CheckIcon,
  DownloadSimpleIcon,
  FolderIcon,
  HardDriveIcon,
  SpinnerIcon,
  TrashIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type {
  SyncChangeSummary,
  SyncProgress,
  SyncUpdateDialogProps,
} from "./SyncUpdateDialog.types.js";

export type { SyncChangeSummary };

interface DismissButtonProps {
  canCancelWrite: boolean;
  isCancelling: boolean;
  isWriting: boolean;
  onCancelWrite: () => void;
  onClose: () => void;
  status?: SyncProgress["status"];
}

const DISMISS_BUTTON_CLASS =
  "px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded hover:bg-surface-3 transition-colors disabled:opacity-50";

/**
 * While a write runs, Cancel stops it after the file in progress (RE-07).
 * Otherwise the button closes the panel.
 */
const DismissButton: React.FC<DismissButtonProps> = ({
  canCancelWrite,
  isCancelling,
  isWriting,
  onCancelWrite,
  onClose,
  status,
}) => {
  if (isWriting) {
    return (
      <button
        className={DISMISS_BUTTON_CLASS}
        data-testid="cancel-write"
        disabled={isCancelling || !canCancelWrite}
        onClick={onCancelWrite}
      >
        {isCancelling ? "Cancelling..." : "Cancel"}
      </button>
    );
  }
  const finished =
    status === "error" || status === "completed" || status === "cancelled";
  return (
    <button
      className={DISMISS_BUTTON_CLASS}
      data-testid="cancel-sync"
      onClick={onClose}
    >
      {finished ? "Close" : "Cancel"}
    </button>
  );
};

const SyncUpdateDialog: React.FC<SyncUpdateDialogProps> = ({
  isLoading = false,
  isOpen,
  kitName: _kitName,
  localChangeSummary,
  onCancelSync,
  onClose,
  onConfirm,
  onGenerateChangeSummary,
  onSdCardPathChange,
  sdCardPath,
  syncProgress,
}) => {
  const [skipInvalidFiles, setSkipInvalidFiles] = useState(false);
  const [localSdCardPath, setLocalSdCardPath] = useState<null | string>(
    sdCardPath || null,
  );
  const [changeSummary, setChangeSummary] = useState<null | SyncChangeSummary>(
    localChangeSummary,
  );
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<null | string>(null);
  const [isClosing, setIsClosing] = useState(false);
  // Cancel was pressed during a write; main stops after the current file
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isLoading) setIsCancelling(false);
  }, [isLoading]);

  // The summary reads the card (to list what sync will remove), so it is
  // regenerated whenever the card changes. Only the latest request counts:
  // an earlier one (say, before the saved card path loaded) can finish last.
  const latestSummaryRequest = useRef(0);
  const loadSummary = useCallback(
    (cardPath: string) => {
      if (!onGenerateChangeSummary) return;

      const request = ++latestSummaryRequest.current;
      const isCurrent = () => request === latestSummaryRequest.current;
      setIsGeneratingSummary(true);
      setSummaryError(null);
      onGenerateChangeSummary(cardPath)
        .then((summary) => {
          if (!isCurrent()) return;
          if (summary) {
            setChangeSummary(summary);
          } else {
            // A null summary means generation failed — distinguish it from a
            // genuine "nothing to sync" so the user doesn't confirm a write
            // against a summary that never loaded.
            setSummaryError(
              "Could not scan kits for changes. Please check the SD card and try again.",
            );
          }
        })
        .catch((error) => {
          if (!isCurrent()) return;
          console.error("Failed to generate change summary:", error);
          setSummaryError(
            error instanceof Error
              ? `Could not scan kits for changes: ${error.message}`
              : "Could not scan kits for changes.",
          );
        })
        .finally(() => {
          if (isCurrent()) setIsGeneratingSummary(false);
        });
    },
    [onGenerateChangeSummary],
  );

  useEffect(() => {
    if (!isOpen) return;

    setIsClosing(false);
    setSummaryError(null);
    setSkipInvalidFiles(false);
    setLocalSdCardPath(sdCardPath || null);

    if (localChangeSummary) {
      setChangeSummary(localChangeSummary);
      return;
    }

    loadSummary(sdCardPath || "");
  }, [isOpen, sdCardPath, localChangeSummary, loadSummary]);

  const handleSdCardSelect = async () => {
    if (!globalThis.electronAPI?.selectSdCard) return;

    const selectedPath = await globalThis.electronAPI.selectSdCard();
    if (!selectedPath) return;

    setLocalSdCardPath(selectedPath);
    onSdCardPathChange?.(selectedPath);
    loadSummary(selectedPath);
  };

  const handleConfirm = () => {
    onConfirm({ sdCardPath: localSdCardPath, skipInvalidFiles });
  };

  const handleCancelWrite = () => {
    setIsCancelling(true);
    onCancelSync?.();
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
  const invalidFiles = changeSummary?.validationErrors || [];
  const warnings = changeSummary?.warnings || [];
  const removals = changeSummary?.removals || [];
  // Samples that can't be written are skipped only once the user says so.
  const needsSkipConfirmation = invalidFiles.length > 0 && !skipInvalidFiles;
  // A write with nothing to copy still removes what the library no longer
  // has, such as every kit after they've all been deleted (RE-76)
  const nothingToDo = fileCount === 0 && removals.length === 0;

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
          <DownloadSimpleIcon
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
          <XIcon size={16} />
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
                    <SpinnerIcon className="animate-spin" size={12} />
                    Preparing...
                  </span>
                )}
                {(syncProgress.status === "copying" ||
                  syncProgress.status === "converting") && (
                  <span className="flex items-center gap-1">
                    <SpinnerIcon className="animate-spin" size={12} />
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
                {syncProgress.status === "cancelled" && (
                  <span
                    className="text-text-secondary"
                    data-testid="write-cancelled"
                  >
                    Write cancelled
                  </span>
                )}
                {syncProgress.status === "completed" && (
                  <span className="text-accent-success flex items-center gap-1">
                    <CheckCircleIcon size={12} weight="fill" />
                    Write Complete
                    {invalidFiles.length > 0 && (
                      <span
                        className="text-accent-warning font-normal"
                        data-testid="skipped-count"
                      >
                        &middot; {invalidFiles.length} skipped
                      </span>
                    )}
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
            <SpinnerIcon className="animate-spin" size={16} />
            <span>Scanning kits...</span>
          </div>
        )}

        {/* Summary generation failure */}
        {!isGeneratingSummary && summaryError && (
          <div
            className="px-4 py-3 m-3 rounded border border-accent-danger bg-accent-danger/10 text-accent-danger text-sm"
            data-testid="summary-error"
            role="alert"
          >
            {summaryError}
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

        {/* Samples that can't be written */}
        {invalidFiles.length > 0 && (
          <div className="px-4 py-2" data-testid="invalid-files">
            <div className="p-2.5 rounded border border-accent-danger/30 bg-accent-danger/10 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-accent-danger">
                <WarningIcon size={12} weight="bold" />
                {invalidFiles.length === 1
                  ? "1 sample can't be written"
                  : `${invalidFiles.length} samples can't be written`}
              </div>
              <ul className="max-h-32 overflow-y-auto space-y-1">
                {invalidFiles.map((file) => (
                  <li
                    className="text-accent-danger/80"
                    key={`${file.kitName}/${file.filename}/${file.sourcePath}`}
                  >
                    {file.kitName && (
                      <span className="font-mono">
                        {file.kitName} &middot;{" "}
                      </span>
                    )}
                    <code className="bg-accent-danger/15 px-1 rounded">
                      {file.filename}
                    </code>
                    <div className="text-accent-danger/60 break-all">
                      {file.error}
                    </div>
                  </li>
                ))}
              </ul>
              <label
                className="flex items-center gap-2 pt-1 cursor-pointer"
                htmlFor="skipInvalidFiles"
              >
                <input
                  checked={skipInvalidFiles}
                  className="sr-only peer"
                  data-testid="skip-invalid-files-checkbox"
                  disabled={isLoading}
                  id="skipInvalidFiles"
                  onChange={(e) => setSkipInvalidFiles(e.target.checked)}
                  type="checkbox"
                />
                <div className="w-3.5 h-3.5 rounded-sm border border-border-default bg-surface-3 shrink-0 flex items-center justify-center peer-checked:bg-accent-danger peer-checked:border-accent-danger transition-colors">
                  {skipInvalidFiles && (
                    <CheckIcon className="text-white" size={10} weight="bold" />
                  )}
                </div>
                <span className="text-text-secondary">
                  Write the other samples and skip{" "}
                  {invalidFiles.length === 1 ? "this one" : "these"}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Informational warnings */}
        {warnings.length > 0 && (
          <div className="px-4 py-2" data-testid="sync-warnings">
            <ul className="p-2.5 rounded border border-accent-warning/30 bg-accent-warning/10 text-[11px] text-text-secondary space-y-1 max-h-24 overflow-y-auto">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* What the card no longer needs */}
        {removals.length > 0 && (
          <div className="px-4 py-2" data-testid="card-removals">
            <div className="p-2.5 rounded border border-border-subtle bg-surface-3/30 text-[11px] space-y-1.5">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <TrashIcon size={11} />
                {removals.length === 1
                  ? "1 item no longer in your library will be removed from the card"
                  : `${removals.length} items no longer in your library will be removed from the card`}
              </div>
              <ul className="max-h-24 overflow-y-auto space-y-0.5 font-mono text-text-tertiary">
                {removals.map((entry) => (
                  <li className="break-all" key={entry}>
                    {entry}
                  </li>
                ))}
              </ul>
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
            <HardDriveIcon
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
              <FolderIcon size={11} />
              {localSdCardPath ? "Change" : "Select"}
            </button>
          </div>
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
        <DismissButton
          canCancelWrite={Boolean(onCancelSync)}
          isCancelling={isCancelling}
          isWriting={isLoading}
          onCancelWrite={handleCancelWrite}
          onClose={handleClose}
          status={syncProgress?.status}
        />

        <div className="flex gap-2">
          {syncProgress?.status === "error" &&
            syncProgress?.errorDetails?.canRetry && (
              <button
                className="px-3 py-1.5 text-xs bg-accent-warning text-white rounded font-semibold hover:bg-accent-warning/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                data-testid="retry-sync"
                disabled={isLoading}
                onClick={handleConfirm}
              >
                <ArrowsClockwiseIcon size={12} weight="bold" />
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
                nothingToDo ||
                needsSkipConfirmation ||
                !localSdCardPath ||
                (syncProgress?.status === "error" &&
                  !syncProgress?.errorDetails?.canRetry)
              }
              onClick={handleConfirm}
            >
              {isLoading ? (
                <>
                  <SpinnerIcon className="animate-spin" size={12} />
                  Writing...
                </>
              ) : (
                <>
                  <DownloadSimpleIcon size={12} weight="bold" />
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
