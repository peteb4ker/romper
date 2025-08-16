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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Create New Kit
          </h2>
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                htmlFor="new-kit-slot"
              >
                Kit Slot (A0-Z99)
              </label>
              <input
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                {newKitError}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
                onClick={onCreateKit}
              >
                Create Kit
              </button>
              <button
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-slate-500 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-colors"
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
