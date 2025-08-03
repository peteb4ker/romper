import React from "react";

interface WizardErrorMessageProps {
  errorMessage: null | string;
}

const WizardErrorMessage: React.FC<WizardErrorMessageProps> = ({
  errorMessage,
}) => {
  if (!errorMessage) return null;
  return (
    <div
      className="mb-2 text-red-600 dark:text-red-400"
      data-testid="wizard-error"
    >
      {errorMessage}
    </div>
  );
};

export default WizardErrorMessage;
