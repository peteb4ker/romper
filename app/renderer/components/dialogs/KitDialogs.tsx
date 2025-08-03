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
      <div className="mb-2 flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-2 rounded">
        <label className="text-xs font-semibold">
          Kit Slot (A0-Z99):
          <input
            autoFocus
            className="ml-2 px-2 py-1 rounded border border-gray-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
            maxLength={3}
            onChange={(e) => onNewKitSlotChange(e.target.value.toUpperCase())}
            value={newKitSlot}
          />
        </label>
        {newKitError && (
          <div className="text-xs text-red-500">{newKitError}</div>
        )}
        <div className="flex gap-2">
          <button
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
            onClick={onCreateKit}
          >
            Create
          </button>
          <button
            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 font-semibold"
            onClick={onCancelNewKit}
          >
            Cancel
          </button>
        </div>
      </div>
    )}
    {showDuplicateKit && (
      <div className="mb-2 flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-2 rounded">
        <label className="text-xs font-semibold">
          Duplicate {duplicateKitSource} to:
          <input
            autoFocus
            className="ml-2 px-2 py-1 rounded border border-gray-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
            maxLength={3}
            onChange={(e) =>
              onDuplicateKitDestChange(e.target.value.toUpperCase())
            }
            value={duplicateKitDest}
          />
        </label>
        {duplicateKitError && (
          <div className="text-xs text-red-500">{duplicateKitError}</div>
        )}
        <div className="flex gap-2">
          <button
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
            onClick={onDuplicateKit}
          >
            Duplicate
          </button>
          <button
            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 font-semibold"
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
