import { TrashIcon } from "@phosphor-icons/react";
import React, { useCallback, useRef, useState } from "react";

import { useConfirmDestructiveActions } from "../utils/SettingsContext";
import ActionPopover from "./shared/ActionPopover";

interface SampleDeleteButtonProps {
  onDelete: () => void;
  sampleName?: string;
}

const buttonStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: 24,
  minWidth: 24,
};

/**
 * A sample's trash button. With "Confirm destructive actions" on (the
 * default), it asks first in the same popover kit delete uses; with it off,
 * it deletes at once (RE-44).
 */
const SampleDeleteButton: React.FC<SampleDeleteButtonProps> = ({
  onDelete,
  sampleName,
}) => {
  const confirmFirst = useConfirmDestructiveActions();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const close = useCallback(() => setIsConfirming(false), []);

  return (
    <>
      <button
        aria-label="Delete sample"
        className="p-1 rounded hover:bg-accent-danger/15 text-xs text-accent-danger ml-2"
        onClick={(e) => {
          e.stopPropagation();
          if (confirmFirst) {
            setIsConfirming(true);
          } else {
            onDelete();
          }
        }}
        ref={anchorRef}
        style={buttonStyle}
        title="Delete sample"
      >
        <TrashIcon size={14} />
      </button>
      <ActionPopover
        anchorRef={anchorRef}
        isOpen={isConfirming}
        onClose={close}
      >
        {/* The popover is portalled, but React still bubbles its events to
            the sample row, whose click and Enter/Space select the sample */}
        <div
          className="flex flex-col gap-2"
          data-testid="confirm-delete-sample"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
          role="presentation"
        >
          <span className="text-sm font-semibold text-text-primary break-all">
            Delete {sampleName ? sampleName : "this sample"}?
          </span>
          <p className="text-xs text-text-secondary">
            The file on disk is not affected. Undo puts it back.
          </p>
          <div className="flex gap-2">
            <button
              className="px-2 py-1 text-xs text-white rounded font-semibold inline-flex items-center gap-1 bg-accent-danger hover:bg-accent-danger/80"
              data-testid="confirm-delete-sample-button"
              onClick={() => {
                close();
                onDelete();
              }}
            >
              <TrashIcon size={13} />
              Delete
            </button>
            {/* Focus starts on Cancel, so Escape closes the popover rather
                than leaving the kit */}
            <button
              autoFocus
              className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </div>
      </ActionPopover>
    </>
  );
};

export default SampleDeleteButton;
