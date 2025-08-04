import React from "react";

interface WizardStepNavProps {
  currentStep: number;
  stepLabels: string[];
}

const WizardStepNav: React.FC<WizardStepNavProps> = ({
  currentStep,
  stepLabels,
}) => {
  const renderStepContent = (label: string, idx: number) => {
    const isComplete = idx < currentStep;
    const isCurrent = idx === currentStep;

    if (isComplete) {
      return (
        <div className="group flex items-center w-full">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 group-hover:bg-blue-800 p-2 text-sm">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                clipRule="evenodd"
                d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
                fillRule="evenodd"
              />
            </svg>
          </span>
          <span className="ml-2 text-blue-600 group-hover:text-blue-800 py-1">
            {label}
          </span>
        </div>
      );
    }

    if (isCurrent) {
      return (
        <div aria-current="step" className="flex items-center w-full">
          <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-blue-600 p-2 text-sm">
            <span className="text-blue-600">
              {String(idx + 1).padStart(2, "0")}
            </span>
          </span>
          <span className="ml-2 text-blue-600 py-1">{label}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center w-full">
        <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-300 dark:border-slate-700 p-2 text-sm">
          <span className="text-gray-400 dark:text-slate-500">
            {String(idx + 1).padStart(2, "0")}
          </span>
        </span>
        <span className="ml-2 text-gray-400 dark:text-slate-500 py-1">
          {label}
        </span>
      </div>
    );
  };

  return (
    <nav
      aria-label="Progress"
      className="mb-6 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900"
    >
      <ol className="flex items-center relative text-sm">
        {stepLabels.map((label, idx) => (
          <li className="relative flex-1 flex items-center pl-4" key={label}>
            {renderStepContent(label, idx)}
            {idx < stepLabels.length - 1 && (
              <div
                aria-hidden="true"
                className="flex items-center justify-center h-12 -mx-2 z-10"
                style={{ minWidth: 0 }}
              >
                <svg
                  className="w-4 h-12 text-gray-300 dark:text-slate-700"
                  fill="none"
                  height={48}
                  preserveAspectRatio="none"
                  viewBox="0 0 16 120"
                  width={16}
                >
                  <path
                    d="M0 -2L14 60L0 122"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default WizardStepNav;
