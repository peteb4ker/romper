import React from "react";
import { FaArchive, FaFolderOpen, FaSdCard } from "react-icons/fa";

import { useLocalStoreWizard } from "./hooks/useLocalStoreWizard";

interface LocalStoreWizardUIProps {
  onClose: () => void;
}

const LocalStoreWizardUI: React.FC<LocalStoreWizardUIProps> = ({ onClose }) => {
  const {
    state,
    setTargetPath,
    setSource,
    setSdCardMounted,
    setError,
    setIsInitializing,
    setSdCardPath,
    validateSdCardFolder,
    initialize,
    defaultPath,
    progress,
    handleSourceSelect, // from hook
    errorMessage, // from hook
    canInitialize, // from hook
    isSdCardSource, // from hook
  } = useLocalStoreWizard();

  // Safe wrapper for selectLocalStorePath
  const safeSelectLocalStorePath =
    window.electronAPI?.selectLocalStorePath?.bind(window.electronAPI);

  // New: UI for SD card folder selection and validation
  const handleSdCardFolderPick = async () => {
    if (safeSelectLocalStorePath) {
      const folder = await safeSelectLocalStorePath();
      if (folder) setSdCardPath(folder);
    }
  };

  // When SD card source is selected, immediately show folder picker
  React.useEffect(() => {
    if (state.source === "sdcard" && !state.sdCardPath) {
      (async () => {
        if (safeSelectLocalStorePath) {
          const folder = await safeSelectLocalStorePath();
          if (folder) setSdCardPath(folder);
        }
      })();
    }
  }, [state.source]);

  const sourceOptions = [
    {
      value: "sdcard",
      label: "Rample SD Card",
      icon: <FaSdCard className="text-3xl mx-auto mb-2" />,
    },
    {
      value: "squarp",
      label: "Squarp.net Factory Samples",
      icon: <FaArchive className="text-3xl mx-auto mb-2" />,
    },
    {
      value: "blank",
      label: "Blank Folder",
      icon: <FaFolderOpen className="text-3xl mx-auto mb-2" />,
    },
  ];

  // Step logic
  const currentStep = !state.source
    ? 0
    : !state.targetPath || state.targetPath === ""
    ? 1
    : 2;
  const stepLabels = ["Source", "Target", "Initialize"];

  // Show chosen source label and path in the Source step indicator if selected
  const showSourceLabel = currentStep === 0 && state.source;
  const sourceLabel = sourceOptions.find((opt) => opt.value === state.source)?.label;
  const sourcePath = state.source === "sdcard" ? state.sdCardPath : state.source === "squarp" ? "Squarp.net" : state.source === "blank" ? "Blank folder" : undefined;

  return (
    <div className="p-0 bg-white dark:bg-slate-900">
      <nav aria-label="Progress" className="mb-6 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
        <ol role="list" className="flex items-center relative text-sm">
          {stepLabels.map((label, idx) => {
            const isComplete = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <li key={label} className="relative flex-1 flex items-center pl-4">
                {isComplete ? (
                  <a href="#" className="group flex items-center w-full cursor-default">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 group-hover:bg-blue-800 p-2 text-sm">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="ml-2 text-blue-600 group-hover:text-blue-800 py-1">{label}</span>
                  </a>
                ) : isCurrent ? (
                  <a href="#" aria-current="step" className="flex items-center w-full cursor-default">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-blue-600 p-2 text-sm">
                      <span className="text-blue-600">{String(idx + 1).padStart(2, "0")}</span>
                    </span>
                    <span className="ml-2 text-blue-600 py-1">{label}</span>
                  </a>
                ) : (
                  <a href="#" className="flex items-center w-full cursor-default">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-300 dark:border-slate-700 p-2 text-sm">
                      <span className="text-gray-400 dark:text-slate-500">{String(idx + 1).padStart(2, "0")}</span>
                    </span>
                    <span className="ml-2 text-gray-400 dark:text-slate-500 py-1">{label}</span>
                  </a>
                )}
                {/* Chevron SVG between steps */}
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
      {/* Step 1: Source selection */}
      {currentStep === 0 && (
        <div className="mb-4">
          <label className="block font-semibold mb-1">
            Choose source
          </label>
          <div className="flex gap-4">
            {sourceOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`flex flex-col items-center border rounded-lg px-4 py-3 flex-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  state.source === opt.value
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900"
                    : "border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                }`}
                onClick={() => handleSourceSelect(opt.value)}
                aria-pressed={state.source === opt.value}
              >
                {opt.icon}
                <span className="mt-1 text-sm font-medium text-center">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Step 2: Target selection (after source is chosen) */}
      {currentStep === 1 && (
        <div className="mb-4">
         <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
            Source:{" "}
            <span className="font-semibold">
              {sourceOptions.find((opt) => opt.value === state.source)?.label}
            </span>
          </div>
          <label className="block font-semibold mb-1" htmlFor="local-store-path-input">
            Choose target
          </label>
          <div className="flex gap-2 items-center">
            <input
              id="local-store-path-input"
              type="text"
              className="border rounded px-2 py-1 w-full mb-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
              value={state.targetPath}
              placeholder={defaultPath}
              onChange={(e) => setTargetPath(e.target.value)}
              aria-label="Local store path"
              disabled={!state.source}
            />
            <button
              type="button"
              className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={async () => {
                if (!safeSelectLocalStorePath)
                  throw new Error("selectLocalStorePath is not available");
                let path = await safeSelectLocalStorePath();
                if (path) {
                  if (!/romper\/?$/.test(path)) {
                    path = path.replace(/\/+$/, "") + "/romper";
                  }
                  setTargetPath(path);
                }
              }}
              aria-label="Choose folder"
              disabled={!state.source}
            >
              Choose…
            </button>
            <button
              type="button"
              className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded ml-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setTargetPath(defaultPath)}
              aria-label="Use default folder"
              disabled={!state.source}
            >
              Use Default
            </button>
          </div>
        </div>
      )}
      {/* Step 3: Initialize (after source and target are chosen) */}
      {currentStep === 2 && (
        <div className="mb-4">
          <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
            Source:{" "}
            <span className="font-semibold">
              {sourceOptions.find((opt) => opt.value === state.source)?.label}
            </span>
          </div>
          <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
            Target: <span className="font-semibold">{state.targetPath}</span>
          </div>
        </div>
      )}
      {errorMessage && (
        <div
          className="mb-2 text-red-600 dark:text-red-400"
          data-testid="wizard-error"
        >
          {errorMessage}
        </div>
      )}
      {state.isInitializing && progress && progress.percent != null && (
        <div className="mb-4">
          <label className="block font-semibold mb-1">
            {progress.phase || "Working..."}
          </label>
          <div className="relative h-3 w-full rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
              data-testid="wizard-progress-bar"
            />
            <div className="absolute left-0 top-0 h-full w-full flex items-center justify-center">
              <span className="text-xs font-medium text-blue-900 dark:text-blue-100 drop-shadow-sm">
                {progress.percent}%
              </span>
            </div>
          </div>
          {progress.file && (
            <div
              className="text-xs mt-1 text-gray-700 dark:text-gray-300 truncate"
              data-testid="wizard-progress-file"
            >
              {progress.file}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 mt-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={!canInitialize || state.isInitializing}
          onClick={initialize}
        >
          {state.isInitializing ? "Initializing..." : "Initialize Local Store"}
        </button>
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default LocalStoreWizardUI;
