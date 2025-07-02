import React from "react";

interface UnscannedKitPromptProps {
  kitName: string;
  onScan: () => void;
  onDismiss: () => void;
}

const UnscannedKitPrompt: React.FC<UnscannedKitPromptProps> = ({
  kitName,
  onScan,
  onDismiss,
}) => {
  return (
    <div className="p-4 mb-4 border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 dark:border-yellow-800 rounded-md">
      <div className="flex flex-col gap-2">
        <h3 className="font-bold text-yellow-800 dark:text-yellow-300">
          Kit needs scanning
        </h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-200">
          The kit <span className="font-mono font-bold">{kitName}</span> has not
          been fully scanned. Scanning helps infer voice types, analyze WAV
          files, and extract artist metadata.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            className="px-3 py-1 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow"
            onClick={onScan}
            data-testid="unscanned-scan-button"
          >
            Scan Now
          </button>
          <button
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md"
            onClick={onDismiss}
            data-testid="unscanned-dismiss-button"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnscannedKitPrompt;
