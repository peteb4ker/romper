import React from "react";

interface WizardSummaryStepProps {
  sourceName: string;
  sourceUrl: string;
  targetUrl?: string;
}

const WizardSummaryStep: React.FC<WizardSummaryStepProps> = ({
  sourceName,
  sourceUrl,
  targetUrl,
}) => (
  <div className="mb-4">
    <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
      Source:{" "}
      <span className="font-semibold" data-testid="wizard-source-name">
        {sourceName}
      </span>
    </div>
    {sourceUrl && (
      <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
        Source URL:{" "}
        <span className="font-mono" data-testid="wizard-source-url">
          {sourceUrl}
        </span>
      </div>
    )}
    {targetUrl && (
      <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
        Target:{" "}
        <span className="font-semibold" data-testid="wizard-target-url">
          {targetUrl}
        </span>
      </div>
    )}
  </div>
);

export default WizardSummaryStep;
