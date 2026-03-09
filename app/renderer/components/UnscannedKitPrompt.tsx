import { X } from "@phosphor-icons/react";
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
    <div className="flex items-center gap-3 px-3 py-1.5 mb-2 border border-accent-warning/30 bg-accent-warning/10 rounded-md text-sm">
      <span className="text-text-secondary">
        {"Kit "}
        <span className="font-mono font-bold text-text-primary">{kitName}</span>
        {" hasn't been scanned yet"}
      </span>
      <button
        className="px-2 py-0.5 text-xs bg-accent-warning hover:bg-accent-warning/80 text-white rounded font-semibold"
        data-testid="unscanned-scan-button"
        onClick={onScan}
      >
        Scan Now
      </button>
      <button
        className="p-0.5 text-text-tertiary hover:text-text-primary ml-auto"
        data-testid="unscanned-dismiss-button"
        onClick={onDismiss}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default UnscannedKitPrompt;
