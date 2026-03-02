import React from "react";

interface KitDialogsProps {
  duplicateKitDest: string;
  duplicateKitError: null | string;
  duplicateKitSource: null | string;
  newKitError: null | string;
  newKitSlot: string;
  onCancelDuplicateKit: () => void;
  onCancelNewKit: () => void;
  onCreateKit: () => void;
  onDuplicateKit: () => void;
  onDuplicateKitDestChange: (v: string) => void;
  onNewKitSlotChange: (v: string) => void;
  showDuplicateKit: boolean;
  showNewKit: boolean;
}

const KitDialogs: React.FC<KitDialogsProps> = ({
  duplicateKitDest,
  duplicateKitError,
  duplicateKitSource,
  newKitError,
  newKitSlot,
  onCancelDuplicateKit,
  onCancelNewKit,
  onCreateKit,
  onDuplicateKit,
  onDuplicateKitDestChange,
  onNewKitSlotChange,
  showDuplicateKit,
  showNewKit,
}) => (
  <>
    {showNewKit && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-surface-2 border border-border-subtle rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-6 w-full max-w-md mx-4">
          <h2 className="text-lg font-semibold mb-4 text-text-primary">
            Create New Kit
          </h2>
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-text-secondary mb-2"
                htmlFor="new-kit-slot"
              >
                Kit Slot (A0-Z99)
              </label>
              <input
                autoFocus
                className="w-full px-3 py-2 border border-border-default rounded-md shadow-sm bg-surface-3 text-text-primary focus:ring-2 focus:ring-accent-primary focus:border-accent-primary"
                id="new-kit-slot"
                maxLength={3}
                onChange={(e) =>
                  onNewKitSlotChange(e.target.value.toUpperCase())
                }
                placeholder="e.g. A1"
                value={newKitSlot}
              />
            </div>
            {newKitError && (
              <div className="text-sm text-accent-danger bg-accent-danger/10 p-3 rounded-md">
                {newKitError}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary/80 focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 font-medium transition-colors"
                onClick={onCreateKit}
              >
                Create Kit
              </button>
              <button
                className="flex-1 px-4 py-2 bg-surface-3 text-text-secondary rounded-md hover:bg-surface-4 focus:ring-2 focus:ring-border-default focus:ring-offset-2 font-medium transition-colors"
                onClick={onCancelNewKit}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
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
