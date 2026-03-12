import { Folder } from "@phosphor-icons/react";
import React from "react";

import { type LocalStoreValidationDetailedResult } from "../../utils/SettingsContext";

interface AdvancedTabProps {
  localStorePath: null | string;
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
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Local Store
        </h3>

        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium text-text-primary mb-2"
              htmlFor="local-store-path"
              id="local-store-path-label"
            >
              Local Store Path
            </label>
            <div className="flex items-center gap-2">
              <div
                aria-labelledby="local-store-path-label"
                aria-readonly="true"
                className="flex-1 p-2 bg-surface-2 rounded border border-border-default font-mono text-sm text-text-secondary"
                id="local-store-path"
                role="textbox"
              >
                {localStorePath || "No local store configured"}
              </div>
              <button
                className="px-3 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors flex items-center gap-2"
                onClick={onChangeLocalStore}
              >
                <Folder size={14} />
                Change...
              </button>
            </div>
            <p className="text-sm text-text-tertiary mt-1">
              Location of your sample database and kit storage
            </p>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-text-primary mb-2"
              htmlFor="local-store-status"
              id="local-store-status-label"
            >
              Status
            </label>
            <div
              aria-labelledby="local-store-status-label"
              aria-live="polite"
              className="p-2 bg-surface-2 rounded border border-border-default text-sm"
              id="local-store-status"
              role="status"
            >
              {localStoreStatus?.isValid ? (
                <span className="text-accent-success">✓ Valid local store</span>
              ) : (
                <span className="text-accent-danger">
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
