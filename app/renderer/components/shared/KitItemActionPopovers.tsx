import { TrashIcon, WarningIcon } from "@phosphor-icons/react";
import React from "react";

/**
 * Confirmation popover bodies for the kit item delete and duplicate actions.
 * Rendered inside an ActionPopover anchored to the triggering button.
 */

export interface DeletePopoverContentProps {
  isDeleting: boolean;
  kitName: string;
  onCancel: () => void;
  onConfirm: () => void;
  sampleCount: number;
}

export interface DuplicatePopoverContentProps {
  duplicateDest: string;
  duplicateError: null | string;
  kitName: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDestChange: (value: string) => void;
}

export const DeletePopoverContent: React.FC<DeletePopoverContentProps> = ({
  isDeleting,
  kitName,
  onCancel,
  onConfirm,
  sampleCount,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-1.5">
      {sampleCount > 0 ? (
        <WarningIcon
          className="text-accent-warning flex-shrink-0"
          size={14}
          weight="bold"
        />
      ) : null}
      <span className="text-sm font-semibold text-text-primary">
        Delete kit {kitName}?
      </span>
    </div>
    {sampleCount > 0 && (
      <p className="text-xs text-text-secondary">
        {sampleCount} sample {sampleCount === 1 ? "reference" : "references"}{" "}
        will be removed. Files on disk are not affected.
      </p>
    )}
    {sampleCount === 0 && (
      <p className="text-xs text-text-tertiary">No samples. Safe to remove.</p>
    )}
    <div className="flex gap-2">
      <button
        className={`px-2 py-1 text-xs text-white rounded font-semibold inline-flex items-center gap-1 disabled:opacity-50 ${sampleCount > 0 ? "bg-accent-danger hover:bg-accent-danger/80" : "bg-accent-primary hover:bg-accent-primary/80"}`}
        data-testid="confirm-delete-button"
        disabled={isDeleting}
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
      >
        <TrashIcon size={13} />
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      <button
        className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
        disabled={isDeleting}
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      >
        Cancel
      </button>
    </div>
  </div>
);

export const DuplicatePopoverContent: React.FC<
  DuplicatePopoverContentProps
> = ({
  duplicateDest,
  duplicateError,
  kitName,
  onCancel,
  onConfirm,
  onDestChange,
}) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-semibold text-text-primary">
      Duplicate {kitName} to:
      <input
        autoFocus
        className="ml-2 px-2 py-1 rounded border border-border-default text-sm bg-surface-2 text-text-primary w-16"
        data-testid="duplicate-dest-input"
        maxLength={3}
        onChange={(e) => onDestChange(e.target.value.toUpperCase())}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm();
          }
        }}
        value={duplicateDest}
      />
    </label>
    {duplicateError && (
      <div className="text-xs text-accent-danger">{duplicateError}</div>
    )}
    <div className="flex gap-2">
      <button
        className="px-2 py-1 text-xs bg-accent-success text-white rounded hover:bg-accent-success/80 font-semibold"
        data-testid="confirm-duplicate-button"
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
      >
        Duplicate
      </button>
      <button
        className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      >
        Cancel
      </button>
    </div>
  </div>
);
