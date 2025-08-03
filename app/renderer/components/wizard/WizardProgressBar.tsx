import React from "react";

interface WizardProgressBarProps {
  progress: { file?: string; percent?: number; phase: string } | null;
}

const WizardProgressBar: React.FC<WizardProgressBarProps> = ({ progress }) => {
  if (!progress || progress?.percent == null) return null;
  return (
    <div className="mb-4">
      <label className="block font-semibold mb-1">
        {progress.phase || "Working..."}
      </label>
      <div className="relative h-3 w-full rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
          data-complete={progress.percent === 100 ? "true" : undefined}
          data-testid="wizard-progress-bar"
          style={{ width: `${progress.percent}%` }}
        />
        <div className="absolute left-0 top-0 h-full w-full flex items-center justify-center">
          <span className="text-xs font-medium text-blue-900 dark:text-blue-100 drop-shadow-sm">
            {progress.percent}%
          </span>
        </div>
      </div>
      {progress.file && (
        <div
          className="text-xs mt-1 text-gray-700 dark:text-gray-300 truncate"
          data-testid="wizard-progress-file"
        >
          {progress.file}
        </div>
      )}
    </div>
  );
};

export default WizardProgressBar;
