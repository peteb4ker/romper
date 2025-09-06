import React from "react";
import { FiFolder } from "react-icons/fi";

import { type LocalStoreValidationDetailedResult } from "../../utils/SettingsContext";

interface AdvancedTabProps {
  localStorePath: string | null;
  localStoreStatus: LocalStoreValidationDetailedResult | null;
  onChangeLocalStore: () => void;
}

const AdvancedTab: React.FC<AdvancedTabProps> = ({
  localStorePath,
  localStoreStatus,
  onChangeLocalStore,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Local Store
        </h3>

        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
              htmlFor="local-store-path"
            >
              Local Store Path
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm text-gray-700 dark:text-gray-300"
                id="local-store-path"
              >
                {localStorePath || "No local store configured"}
              </div>
              <button
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                onClick={onChangeLocalStore}
              >
                <FiFolder className="text-sm" />
                Change...
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Location of your sample database and kit storage
            </p>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
              htmlFor="local-store-status"
            >
              Status
            </label>
            <div
              className="p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-300 dark:border-gray-600 text-sm"
              id="local-store-status"
            >
              {localStoreStatus?.isValid ? (
                <span className="text-green-600 dark:text-green-400">
                  ✓ Valid local store
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  ✗ {localStoreStatus?.error || "Invalid local store"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedTab;