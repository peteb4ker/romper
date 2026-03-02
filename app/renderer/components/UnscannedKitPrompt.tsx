import React from "react";

interface UnscannedKitPromptProps {
  kitName: string;
  onDismiss: () => void;
  onScan: () => void;
}

const UnscannedKitPrompt: React.FC<UnscannedKitPromptProps> = ({
  kitName,
  onDismiss,
  onScan,
}) => {
  return (
    <div className="p-4 mb-4 border border-accent-warning bg-accent-warning/15 rounded-md">
      <div className="flex flex-col gap-2">
        <h3 className="font-bold text-accent-warning">Kit needs scanning</h3>
        <p className="text-sm text-accent-warning">
          The kit <span className="font-mono font-bold">{kitName}</span> has not
          been fully scanned. Scanning helps infer voice types, analyze WAV
          files, and extract artist metadata.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            className="px-3 py-1 text-sm bg-accent-warning hover:bg-accent-warning/80 text-white rounded-md shadow"
            data-testid="unscanned-scan-button"
            onClick={onScan}
          >
            Scan Now
          </button>
          <button
            className="px-3 py-1 text-sm bg-surface-3 hover:bg-surface-4 text-text-secondary rounded-md"
            data-testid="unscanned-dismiss-button"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnscannedKitPrompt;
