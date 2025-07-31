import React from "react";

import { config } from "../../config";

interface SourceOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

interface WizardSourceStepProps {
  sourceOptions: SourceOption[];
  stateSource: string | null;
  handleSourceSelect: (value: string) => void;
  setSdCardPath?: (path: string) => void;
  sourceConfirmed?: boolean;
  setSourceConfirmed?: (confirmed: boolean) => void;
}

const WizardSourceStep: React.FC<WizardSourceStepProps> = ({
  sourceOptions,
  stateSource,
  handleSourceSelect,
  setSdCardPath,
  sourceConfirmed: _sourceConfirmed,
  setSourceConfirmed,
}) => {
  // Only show SD card path if source is sdcard
  const isEnvSdCardPath = !!config.sdCardPath;

  // Unified click handler for SD card button
  const handleSdCardClick = async () => {
    if (stateSource !== "sdcard") {
      handleSourceSelect("sdcard");
    }
    if (isEnvSdCardPath) {
      setSourceConfirmed?.(true);
      if (setSdCardPath) setSdCardPath(config.sdCardPath!);
      return;
    }
    if (window.electronAPI?.selectSdCard) {
      const pickedPath = await window.electronAPI.selectSdCard();
      if (pickedPath && setSdCardPath) {
        setSdCardPath(pickedPath);
        setSourceConfirmed?.(true);
      }
    }
  };

  return (
    <div className="mb-4">
      <label className="block font-semibold mb-1">Choose source</label>
      <div className="flex gap-4">
        {sourceOptions.map((opt) => {
          const isSdCard = opt.value === "sdcard";
          const isSelected = stateSource === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`flex flex-col items-center border rounded-lg px-4 py-3 flex-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSelected
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              }`}
              onClick={
                isSdCard
                  ? handleSdCardClick
                  : () => handleSourceSelect(opt.value)
              }
              aria-pressed={isSelected}
              data-testid={`wizard-source-${opt.value}`}
            >
              {opt.icon}
              <span className="mt-1 text-sm font-medium text-center">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WizardSourceStep;
