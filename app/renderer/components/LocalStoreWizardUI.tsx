import React, { useState } from "react";
import { FaArchive, FaFolderOpen, FaSdCard, FaSearch } from "react-icons/fa";

import { config } from "../config";
import { useLocalStoreWizard } from "./hooks/useLocalStoreWizard";
import FilePickerButton from "./utils/FilePickerButton";
import Spinner from "./utils/Spinner";
import WizardErrorMessage from "./wizard/WizardErrorMessage";
import WizardProgressBar from "./wizard/WizardProgressBar";
import WizardSourceStep from "./wizard/WizardSourceStep";
import WizardStepNav from "./wizard/WizardStepNav";
import WizardSummaryStep from "./wizard/WizardSummaryStep";
import WizardTargetStep from "./wizard/WizardTargetStep";

interface LocalStoreWizardUIProps {
  onClose: () => void;
  onSuccess?: () => void;
  setLocalStorePath: (path: string) => void;
}

enum WizardStep {
  Source = 0,
  Target = 1,
  Initialize = 2,
}

const LocalStoreWizardUI: React.FC<LocalStoreWizardUIProps> = ({
  onClose,
  onSuccess,
  setLocalStorePath,
}) => {
  console.log(
    "[LocalStoreWizardUI] Rendered with setLocalStorePath:",
    !!setLocalStorePath,
  );

  const [showExistingStoreSelector, setShowExistingStoreSelector] =
    useState(false);
  const [existingStoreError, setExistingStoreError] = useState<string | null>(
    null,
  );
  const [isSelectingExisting, setIsSelectingExisting] = useState(false);
  const {
    state,
    setTargetPath,
    setSdCardPath,
    initialize,
    defaultPath,
    progress,
    handleSourceSelect, // from hook
    errorMessage, // from hook
    canInitialize, // from hook
    setSourceConfirmed, // new setter from hook
  } = useLocalStoreWizard(undefined, setLocalStorePath);

  const safeSelectLocalStorePath =
    window.electronAPI?.selectLocalStorePath?.bind(window.electronAPI);

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

  const currentStep: WizardStep = !state.source
    ? WizardStep.Source
    : state.source === "sdcard" && !state.sourceConfirmed
      ? WizardStep.Source
      : !state.targetPath || state.targetPath === ""
        ? WizardStep.Target
        : WizardStep.Initialize;
  const stepLabels = ["Source", "Target", "Initialize"];

  const handleInitialize = async () => {
    const result = await initialize();
    if (result.success && onSuccess) {
      onSuccess();
    }
  };

  const handleChooseExistingStore = async () => {
    console.log("electronAPI available:", !!window.electronAPI);
    console.log(
      "selectExistingLocalStore method available:",
      !!window.electronAPI?.selectExistingLocalStore,
    );

    if (!window.electronAPI?.selectExistingLocalStore) {
      const errorMsg = !window.electronAPI
        ? "electronAPI not available (app may need restart)"
        : "selectExistingLocalStore method not found (preload issue)";
      setExistingStoreError(errorMsg);
      console.error("Debug info:", {
        electronAPI: !!window.electronAPI,
        selectExistingLocalStore:
          !!window.electronAPI?.selectExistingLocalStore,
        availableMethods: window.electronAPI
          ? Object.keys(window.electronAPI)
          : "none",
      });
      return;
    }

    setIsSelectingExisting(true);
    setExistingStoreError(null);

    try {
      console.log("Calling selectExistingLocalStore...");
      const result = await window.electronAPI.selectExistingLocalStore();
      console.log("selectExistingLocalStore result:", result);

      if (result.success && result.path) {
        // Save the selected path to settings and close wizard
        setLocalStorePath(result.path);
        if (onSuccess) {
          onSuccess();
        }
      } else if (result.error && result.error !== "Selection cancelled") {
        setExistingStoreError(result.error);
      }
    } catch (error) {
      console.error("Error selecting existing local store:", error);
      setExistingStoreError("Failed to select existing local store");
    } finally {
      setIsSelectingExisting(false);
    }
  };

  return (
    <div
      className="p-0 bg-white dark:bg-slate-900"
      data-testid="local-store-wizard"
    >
      {!showExistingStoreSelector && (
        <>
          <WizardStepNav stepLabels={stepLabels} currentStep={currentStep} />
          {currentStep === WizardStep.Source && (
            <WizardSourceStep
              sourceOptions={sourceOptions}
              stateSource={state.source}
              handleSourceSelect={handleSourceSelect}
              setSdCardPath={setSdCardPath}
              sourceConfirmed={state.sourceConfirmed}
              setSourceConfirmed={setSourceConfirmed}
            />
          )}
        </>
      )}

      {showExistingStoreSelector && (
        <div className="mb-4">
          <label className="block font-semibold mb-1">
            Choose Existing Local Store
          </label>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Select a folder that contains an existing Romper database (.romperdb
            directory).
          </p>

          {existingStoreError && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
              {existingStoreError}
            </div>
          )}

          <div className="flex gap-2">
            <FilePickerButton
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={handleChooseExistingStore}
              isSelecting={isSelectingExisting}
              data-testid="browse-existing-store-btn"
              icon={<FaSearch size={14} />}
            >
              Browse for Existing Store
            </FilePickerButton>

            <button
              className="bg-gray-400 text-white px-4 py-2 rounded"
              onClick={() => {
                setShowExistingStoreSelector(false);
                setExistingStoreError(null);
              }}
            >
              ← Back to Setup Wizard
            </button>
          </div>
        </div>
      )}

      {!showExistingStoreSelector && (
        <>
          {/* Show summary on both Target and Initialize steps */}
          {(currentStep === WizardStep.Target ||
            currentStep === WizardStep.Initialize) && (
            <WizardSummaryStep
              sourceName={
                state.source === "sdcard"
                  ? "Rample SD Card"
                  : state.source === "squarp"
                    ? "Squarp.net Factory Samples"
                    : "Blank Folder"
              }
              sourceUrl={
                state.source === "sdcard"
                  ? state.sdCardSourcePath || ""
                  : state.source === "squarp"
                    ? config.squarpArchiveUrl || ""
                    : ""
              }
              targetUrl={
                currentStep === WizardStep.Initialize
                  ? state.targetPath
                  : undefined
              }
            />
          )}
          {currentStep === WizardStep.Target && (
            <WizardTargetStep
              stateTargetPath={state.targetPath}
              defaultPath={defaultPath}
              setTargetPath={setTargetPath}
              safeSelectLocalStorePath={safeSelectLocalStorePath}
            />
          )}
          <WizardErrorMessage errorMessage={errorMessage} />
          <WizardProgressBar progress={progress} />
          <div className="flex justify-between items-end mt-4">
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={!canInitialize || state.isInitializing}
                onClick={handleInitialize}
                data-testid="wizard-initialize-btn"
              >
                {state.isInitializing ? (
                  <>
                    <Spinner size={18} className="mr-2" /> Initializing...
                  </>
                ) : (
                  "Initialize Local Store"
                )}
              </button>
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>

            {/* Choose Existing Local Store button - bottom right */}
            <button
              className="bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 hover:bg-green-700"
              onClick={() => setShowExistingStoreSelector(true)}
              data-testid="choose-existing-store-btn"
            >
              <FaSearch size={14} /> Choose Existing Store
            </button>
          </div>
        </>
      )}
      <button
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="wizard-next-step"
        onClick={() => {}}
      />
    </div>
  );
};

export default LocalStoreWizardUI;
