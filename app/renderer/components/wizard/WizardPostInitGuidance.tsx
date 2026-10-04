import React from "react";

import type {
  StereoImportNotice,
  TruncationWarning,
} from "../hooks/wizard/useLocalStoreWizardState";

interface WizardPostInitGuidanceProps {
  isBlankFolder: boolean;
  onDismiss: () => void;
  // Both lists are used: destructured and rendered below. NOSONAR
  // suppresses the S6767 false positive on them.
  /** Setup summary lines for pairs setup linked automatically (#537) */
  stereoNotices?: StereoImportNotice[]; // NOSONAR
  truncationWarnings?: TruncationWarning[]; // NOSONAR
}

const WizardPostInitGuidance: React.FC<WizardPostInitGuidanceProps> =
  React.memo(
    ({ isBlankFolder, onDismiss, stereoNotices, truncationWarnings }) => {
      const hasWarnings = truncationWarnings && truncationWarnings.length > 0;
      const hasStereoNotices = stereoNotices && stereoNotices.length > 0;

      return (
        <div data-testid="wizard-post-init-guidance">
          <h3 className="text-lg font-semibold text-text-primary mb-3">
            Local Store Initialized
          </h3>

          {hasWarnings && (
            <div
              className="bg-accent-warning/15 border border-accent-warning text-text-primary px-4 py-3 rounded mb-4"
              data-testid="truncation-warnings"
            >
              <p className="font-medium mb-2">
                Some samples were skipped (max 12 per voice):
              </p>
              <ul className="text-sm space-y-1">
                {truncationWarnings.map((w) => (
                  <li key={`${w.kitName}-${w.voiceNumber}`}>
                    Kit <strong>{w.kitName}</strong>, Voice {w.voiceNumber}:{" "}
                    {w.skipped} of {w.total} samples skipped (kept first{" "}
                    {w.kept})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasStereoNotices && (
            <ul
              className="text-sm text-text-primary space-y-1 mb-4"
              data-testid="stereo-summary"
            >
              {stereoNotices.map((n) => (
                <li key={`${n.kitName}-${n.voiceNumber}`}>{n.message}</li>
              ))}
            </ul>
          )}

          {isBlankFolder && (
            <div data-testid="blank-folder-guidance">
              <p className="text-text-secondary mb-4">
                Your local store is ready. To get started, you can:
              </p>
              <div className="space-y-2">
                <p className="text-text-tertiary text-sm">
                  Add kits later by using the Kit Browser to create new kits, or
                  use the Preferences menu to change your local store to an SD
                  card location.
                </p>
              </div>
            </div>
          )}

          <button
            className="bg-accent-primary text-white px-4 py-2 rounded mt-4"
            data-testid="post-init-continue-btn"
            onClick={onDismiss}
          >
            {isBlankFolder ? "Open Kit Browser" : "Continue"}
          </button>
        </div>
      );
    },
  );

WizardPostInitGuidance.displayName = "WizardPostInitGuidance";

export default WizardPostInitGuidance;
