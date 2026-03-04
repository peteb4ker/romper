import React from "react";

interface KitDialogsProps {
  duplicateKitDest: string;
  duplicateKitError: null | string;
  duplicateKitSource: null | string;
  onCancelDuplicateKit: () => void;
  onDuplicateKit: () => void;
  onDuplicateKitDestChange: (v: string) => void;
  showDuplicateKit: boolean;
}

const KitDialogs: React.FC<KitDialogsProps> = ({
  duplicateKitDest,
  duplicateKitError,
  duplicateKitSource,
  onCancelDuplicateKit,
  onDuplicateKit,
  onDuplicateKitDestChange,
  showDuplicateKit,
}) => (
  <>
    {showDuplicateKit && (
      <div className="mb-2 flex flex-col gap-2 bg-surface-3 p-2 rounded">
        <label className="text-xs font-semibold">
          Duplicate {duplicateKitSource} to:
          <input
            autoFocus
            className="ml-2 px-2 py-1 rounded border border-border-default text-sm bg-surface-2 text-text-primary"
            maxLength={3}
            onChange={(e) =>
              onDuplicateKitDestChange(e.target.value.toUpperCase())
            }
            value={duplicateKitDest}
          />
        </label>
        {duplicateKitError && (
          <div className="text-xs text-accent-danger">{duplicateKitError}</div>
        )}
        <div className="flex gap-2">
          <button
            className="px-2 py-1 text-xs bg-accent-success text-white rounded hover:bg-accent-success/80 font-semibold"
            onClick={onDuplicateKit}
          >
            Duplicate
          </button>
          <button
            className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
            onClick={onCancelDuplicateKit}
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </>
);

export default KitDialogs;
