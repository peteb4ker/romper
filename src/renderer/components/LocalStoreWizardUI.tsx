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

  // New: UI for SD card folder selection and validation
  const handleSdCardFolderPick = async () => {
    if (window.electronAPI?.selectLocalStorePath) {
      const folder = await window.electronAPI.selectLocalStorePath();
      if (folder) setSdCardPath(folder);
    }
  };

  // When SD card source is selected, immediately show folder picker
  React.useEffect(() => {
    if (state.source === "sdcard" && !state.sdCardPath) {
      (async () => {
        if (window.electronAPI?.selectLocalStorePath) {
          const folder = await window.electronAPI.selectLocalStorePath();
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

  return (
    <div>
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
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded h-4 overflow-hidden">
            <div
              className="bg-blue-600 h-4 transition-all duration-200"
              style={{
                width: `${progress.percent}%`,
              }}
              data-testid="wizard-progress-bar"
            />
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
      <div className="mb-4">
        <label className="block font-semibold mb-1">
          Choose local store target location:
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            className="border rounded px-2 py-1 w-full mb-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
            value={state.targetPath}
            placeholder={defaultPath}
            onChange={(e) => setTargetPath(e.target.value)}
            aria-label="Local store path"
          />
          <button
            type="button"
            className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={async () => {
              let path = await window.electronAPI.selectLocalStorePath();
              if (path) {
                if (!/romper\/?$/.test(path)) {
                  path = path.replace(/\/+$/, "") + "/romper";
                }
                setTargetPath(path);
              }
            }}
            aria-label="Choose folder"
          >
            Choose…
          </button>
          <button
            type="button"
            className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded ml-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setTargetPath(defaultPath)}
            aria-label="Use default folder"
          >
            Use Default
          </button>
        </div>
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">
          Choose source for initial kit data:
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
      {isSdCardSource && state.sdCardPath && (
        <div className="mb-2">
          <span className="ml-2 text-xs text-gray-700 dark:text-gray-300">
            {state.sdCardPath}
          </span>
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
