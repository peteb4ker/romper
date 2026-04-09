import React from "react";

interface WizardProgressBarProps {
  progress: {
    currentKit?: number;
    file?: string;
    kitName?: string;
    percent?: number;
    phase: string;
    totalKits?: number;
  } | null;
}

const WizardProgressBar: React.FC<WizardProgressBarProps> = ({ progress }) => {
  if (progress?.percent == null) return null;
  return (
    <div className="mb-4">
      <label className="block font-semibold mb-1">
        {progress.phase || "Working..."}
      </label>
      <div className="relative h-3 w-full rounded-full bg-surface-3 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-accent-primary transition-all duration-300"
          data-complete={progress.percent === 100 ? "true" : undefined}
          data-testid="wizard-progress-bar"
          style={{ width: `${progress.percent}%` }}
        />
        <div className="absolute left-0 top-0 h-full w-full flex items-center justify-center">
          <span className="text-xs font-medium text-text-primary drop-shadow-sm">
            {progress.percent}%
          </span>
        </div>
      </div>
      {progress.currentKit && progress.totalKits ? (
        <div
          className="text-xs mt-1 text-text-secondary"
          data-testid="wizard-progress-kit"
        >
          Kit {progress.kitName || progress.currentKit} ({progress.currentKit}{" "}
          of {progress.totalKits})
        </div>
      ) : (
        progress.file && (
          <div
            className="text-xs mt-1 text-text-secondary truncate"
            data-testid="wizard-progress-file"
          >
            {progress.file}
          </div>
        )
      )}
    </div>
  );
};

export default WizardProgressBar;
