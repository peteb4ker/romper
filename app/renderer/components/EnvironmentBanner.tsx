import React from "react";

interface EnvironmentBannerProps {
  localStorePath?: null | string;
  onDismiss: () => void;
}

/**
 * Dismissible banner shown when the local store path is overridden via the
 * ROMPER_LOCAL_PATH environment variable (test mode).
 */
export const EnvironmentBanner: React.FC<EnvironmentBannerProps> = ({
  localStorePath,
  onDismiss,
}) => (
  <div className="bg-accent-warning/10 border-l-4 border-accent-warning p-3 mb-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <span className="text-accent-warning text-sm font-medium">
          🧪 Test Mode: Using ROMPER_LOCAL_PATH environment override
        </span>
        <span className="ml-2 text-accent-warning/70 text-xs font-mono">
          {localStorePath}
        </span>
      </div>
      <button
        className="text-accent-warning/70 hover:text-accent-warning text-sm"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  </div>
);
