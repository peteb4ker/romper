import { Info, Trash, Warning } from "@phosphor-icons/react";
import React from "react";

interface DeleteKitDialogProps {
  isDeleting: boolean;
  kitName: string;
  onCancel: () => void;
  onConfirm: () => void;
  sampleCount: number;
}

const DeleteKitDialog: React.FC<DeleteKitDialogProps> = ({
  isDeleting,
  kitName,
  onCancel,
  onConfirm,
  sampleCount,
}) => {
  const hasSamples = sampleCount > 0;

  return (
    <div
      className={`mb-2 flex flex-col gap-2 bg-surface-3 p-3 rounded border ${hasSamples ? "border-accent-warning/30" : "border-border-subtle"}`}
    >
      <div className="flex items-center gap-1.5">
        {hasSamples ? (
          <Warning
            className="text-accent-warning flex-shrink-0"
            size={14}
            weight="bold"
          />
        ) : (
          <Info
            className="text-text-tertiary flex-shrink-0"
            size={14}
            weight="bold"
          />
        )}
        <span className="text-sm font-semibold text-text-primary">
          Delete kit {kitName}?
        </span>
      </div>
      <div className="text-xs text-text-secondary ml-5">
        {hasSamples ? (
          <p>
            {sampleCount} sample{" "}
            {sampleCount === 1 ? "reference" : "references"} will be removed.
            Original files on disk are not affected.
          </p>
        ) : (
          <p className="text-text-tertiary">
            This kit has no samples. Safe to remove.
          </p>
        )}
      </div>
      <div className="flex gap-2 ml-5">
        <button
          className={`px-2 py-1 text-xs text-white rounded font-semibold inline-flex items-center gap-1 disabled:opacity-50 ${hasSamples ? "bg-accent-danger hover:bg-accent-danger/80" : "bg-accent-primary hover:bg-accent-primary/80"}`}
          disabled={isDeleting}
          onClick={onConfirm}
        >
          <Trash size={13} />
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
        <button
          className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
          disabled={isDeleting}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DeleteKitDialog;
