import React from "react";

interface SampleManagementTabProps {
  confirmDestructiveActions: boolean;
  defaultToMonoSamples: boolean;
  onConfirmDestructiveActionsChange: (checked: boolean) => void;
  onDefaultToMonoSamplesChange: (checked: boolean) => void;
}

const SampleManagementTab: React.FC<SampleManagementTabProps> = ({
  confirmDestructiveActions,
  defaultToMonoSamples,
  onConfirmDestructiveActionsChange,
  onDefaultToMonoSamplesChange,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Sample Assignment
        </h3>

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label
                className="text-sm font-medium text-gray-900 dark:text-gray-100"
                htmlFor="default-mono-checkbox"
              >
                Default to mono samples
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Automatically assign stereo samples as mono to a single voice.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                When enabled, stereo samples will take 1 mono slot and will be
                converted to mono by averaging the left and right channel.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                When disabled, stereo samples will be assigned to adjacent
                voices, taking the same sample slot on both voices.
              </p>
            </div>
            <div className="flex items-center ml-4">
              <input
                checked={defaultToMonoSamples}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700"
                id="default-mono-checkbox"
                onChange={(e) => onDefaultToMonoSamplesChange(e.target.checked)}
                type="checkbox"
              />
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label
                className="text-sm font-medium text-gray-900 dark:text-gray-100"
                htmlFor="confirm-destructive-checkbox"
              >
                Confirm destructive actions
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Show confirmation prompts before replacing or deleting samples
              </p>
            </div>
            <div className="flex items-center ml-4">
              <input
                checked={confirmDestructiveActions}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700"
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
