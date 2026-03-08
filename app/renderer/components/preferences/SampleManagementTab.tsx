import React from "react";

interface SampleManagementTabProps {
  confirmDestructiveActions: boolean;
  onConfirmDestructiveActionsChange: (checked: boolean) => void;
}

const SampleManagementTab: React.FC<SampleManagementTabProps> = ({
  confirmDestructiveActions,
  onConfirmDestructiveActionsChange,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Sample Assignment
        </h3>

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label
                className="text-sm font-medium text-text-primary"
                htmlFor="confirm-destructive-checkbox"
              >
                Confirm destructive actions
              </label>
              <p className="text-sm text-text-tertiary mt-1">
                Show confirmation prompts before replacing or deleting samples
              </p>
            </div>
            <div className="flex items-center ml-4">
              <input
                checked={confirmDestructiveActions}
                className="rounded border-border-default text-accent-primary focus:ring-accent-primary"
                id="confirm-destructive-checkbox"
                onChange={(e) =>
                  onConfirmDestructiveActionsChange(e.target.checked)
                }
                type="checkbox"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SampleManagementTab;
