import { TrashIcon } from "@phosphor-icons/react";
import {
  describeRemoveMissingSamples,
  describeRemoveMissingSamplesButton,
  REMOVE_MISSING_SAMPLES_LABEL,
} from "@romper/shared/storeCheckWording";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";

import { useConfirmDestructiveActions } from "../utils/SettingsContext";
import { usePopoverDismiss } from "./hooks/shared/usePopoverDismiss";

interface RemoveMissingSamplesButtonProps {
  /** This kit's removal is running */
  busy: boolean;
  /** How many missing samples the removal would take, for the question */
  count: number;
  "data-testid": string;
  /** Another fix is running: the button stays focusable but does nothing */
  disabled: boolean;
  kitName: string;
  onRemove: () => void;
}

/**
 * The "Remove missing samples" fix (#822, stage 5 of
 * docs/developer/store-check.md), in the Library check and the kit
 * editor's missing-files notice. It asks first in a popover that names the
 * kit and the count, as a sample delete does, unless "Confirm destructive
 * actions" is off (RE-44).
 *
 * The popover isn't portalled, unlike `ActionPopover`: inside the Library
 * check it must stay in the dialog, so Tab stays in the dialog and Escape
 * closes only the popover. Focus starts on Cancel and comes back to the
 * button when the popover closes.
 */
const RemoveMissingSamplesButton: React.FC<RemoveMissingSamplesButtonProps> = ({
  busy,
  count,
  "data-testid": testId,
  disabled,
  kitName,
  onRemove,
}) => {
  const confirmFirst = useConfirmDestructiveActions();
  const [isConfirming, setIsConfirming] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const questionId = useId();

  const close = useCallback(() => {
    setIsConfirming(false);
    buttonRef.current?.focus({ preventScroll: true });
  }, []);
  usePopoverDismiss(popoverRef, close, isConfirming);

  useEffect(() => {
    if (isConfirming) cancelRef.current?.focus();
  }, [isConfirming]);

  const inactive = busy || disabled;

  return (
    <div className="relative shrink-0">
      <button
        aria-busy={busy}
        aria-disabled={inactive}
        aria-expanded={confirmFirst ? isConfirming : undefined}
        aria-label={describeRemoveMissingSamplesButton(kitName)}
        className={`px-2 py-1 text-xs bg-accent-danger text-white rounded font-semibold flex items-center transition duration-150 ${
          inactive ? "opacity-60 cursor-wait" : "hover:bg-accent-danger/80"
        }`}
        data-testid={testId}
        onClick={() => {
          if (inactive) return;
          if (confirmFirst) setIsConfirming(true);
          else onRemove();
        }}
        ref={buttonRef}
        type="button"
      >
        <TrashIcon aria-hidden="true" className="inline-block mr-1" size={14} />
        {REMOVE_MISSING_SAMPLES_LABEL}
      </button>
      {isConfirming && (
        <div
          aria-labelledby={questionId}
          className="absolute right-0 top-full mt-1 z-10 w-[280px] bg-surface-2 border border-border-strong rounded-lg shadow-lg p-3 flex flex-col gap-2 text-left"
          data-testid={`${testId}-confirm`}
          onKeyDown={(e) => {
            // Escape closes the popover, not the dialog or the kit behind it
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          ref={popoverRef}
          role="dialog"
        >
          <p
            className="text-sm font-semibold text-text-primary"
            id={questionId}
          >
            {describeRemoveMissingSamples(count, kitName)}
          </p>
          <div className="flex gap-2">
            <button
              className="px-2 py-1 text-xs text-white rounded font-semibold inline-flex items-center gap-1 bg-accent-danger hover:bg-accent-danger/80"
              data-testid={`${testId}-confirm-button`}
              onClick={() => {
                close();
                onRemove();
              }}
              type="button"
            >
              <TrashIcon aria-hidden="true" size={13} />
              {REMOVE_MISSING_SAMPLES_LABEL}
            </button>
            <button
              className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
              onClick={close}
              ref={cancelRef}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoveMissingSamplesButton;
