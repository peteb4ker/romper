import React from "react";
import { FaArchive, FaFolderOpen, FaSdCard } from "react-icons/fa";

import { config } from "../config";
import { useLocalStoreWizard } from "./hooks/useLocalStoreWizard";
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

  return (
    <div
      className="p-0 bg-white dark:bg-slate-900"
      data-testid="local-store-wizard"
    >
      <WizardStepNav stepLabels={stepLabels} currentStep={currentStep} />
      {currentStep === WizardStep.Source && (
        <WizardSourceStep
          sourceOptions={sourceOptions}
          stateSource={state.source}
          handleSourceSelect={handleSourceSelect}
          localStorePath={state.sdCardSourcePath}
          setSdCardPath={setSdCardPath}
          sourceConfirmed={state.sourceConfirmed}
          setSourceConfirmed={setSourceConfirmed}
        />
      )}
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
            currentStep === WizardStep.Initialize ? state.targetPath : undefined
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
      <div className="flex gap-2 mt-4">
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
