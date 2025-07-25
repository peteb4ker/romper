import React from "react";

interface WizardStepNavProps {
  stepLabels: string[];
  currentStep: number;
}

const WizardStepNav: React.FC<WizardStepNavProps> = ({
  stepLabels,
  currentStep,
}) => (
  <nav
    aria-label="Progress"
    className="mb-6 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900"
  >
    <ol role="list" className="flex items-center relative text-sm">
      {stepLabels.map((label, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent = idx === currentStep;
        return (
          <li key={label} className="relative flex-1 flex items-center pl-4">
            {isComplete ? (
              <a
                href="#"
                className="group flex items-center w-full cursor-default"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 group-hover:bg-blue-800 p-2 text-sm">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span className="ml-2 text-blue-600 group-hover:text-blue-800 py-1">
                  {label}
                </span>
              </a>
            ) : isCurrent ? (
              <a
                href="#"
                aria-current="step"
                className="flex items-center w-full cursor-default"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-blue-600 p-2 text-sm">
                  <span className="text-blue-600">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="ml-2 text-blue-600 py-1">{label}</span>
              </a>
            ) : (
              <a href="#" className="flex items-center w-full cursor-default">
                <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-300 dark:border-slate-700 p-2 text-sm">
                  <span className="text-gray-400 dark:text-slate-500">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="ml-2 text-gray-400 dark:text-slate-500 py-1">
                  {label}
                </span>
              </a>
            )}
            {idx < stepLabels.length - 1 && (
              <div
                aria-hidden="true"
                className="flex items-center justify-center h-12 -mx-2 z-10"
                style={{ minWidth: 0 }}
              >
                <svg
                  fill="none"
                  viewBox="0 0 16 120"
                  width={16}
                  height={48}
                  preserveAspectRatio="none"
                  className="w-4 h-12 text-gray-300 dark:text-slate-700"
                >
                  <path
                    d="M0 -2L14 60L0 122"
                    stroke="currentColor"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default WizardStepNav;
