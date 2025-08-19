import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaArchive, FaFolderOpen, FaSdCard, FaSearch } from "react-icons/fa";

import { config } from "../config";
import { useLocalStoreWizard } from "./hooks/wizard/useLocalStoreWizard";
import FilePickerButton from "./utils/FilePickerButton";
import Spinner from "./utils/Spinner";
import WizardErrorMessage from "./wizard/WizardErrorMessage";
import WizardProgressBar from "./wizard/WizardProgressBar";
import WizardSourceStep from "./wizard/WizardSourceStep";
import WizardStepNav from "./wizard/WizardStepNav";
import WizardSummaryStep from "./wizard/WizardSummaryStep";
import WizardTargetStep from "./wizard/WizardTargetStep";

enum WizardStep {
  Initialize = 2,
  Source = 0,
  Target = 1,
}

interface LocalStoreWizardUIProps {
  onClose: () => void;
  onInitializationChange?: (isInitializing: boolean) => void;
  onSuccess?: () => void;
  setLocalStorePath: (path: string) => void;
}

const LocalStoreWizardUI: React.FC<LocalStoreWizardUIProps> = React.memo(
  ({ onClose, onInitializationChange, onSuccess, setLocalStorePath }) => {
    // Only log on development or if there's an issue
    const isDev = process.env.NODE_ENV === "development";
    isDev &&
      console.debug(
        "[LocalStoreWizardUI] Rendered with setLocalStorePath:",
        !!setLocalStorePath
      );

    const [showExistingStoreSelector, setShowExistingStoreSelector] =
      useState(false);
    const [existingStoreError, setExistingStoreError] = useState<null | string>(
      null
    );
    const [isSelectingExisting, setIsSelectingExisting] = useState(false);
    const {
      canInitialize, // from hook
      defaultPath,
      errorMessage, // from hook
      handleSourceSelect, // from hook
      initialize,
      progress,
      setSdCardPath,
      setSourceConfirmed, // new setter from hook
      setTargetPath,
      state,
    } = useLocalStoreWizard(undefined, setLocalStorePath);

    // Notify parent when initialization state changes
    useEffect(() => {
      onInitializationChange?.(state.isInitializing);
    }, [state.isInitializing, onInitializationChange]);

    const safeSelectLocalStorePath = useCallback(async () => {
      if (window.electronAPI?.selectLocalStorePath) {
        return await window.electronAPI.selectLocalStorePath();
      }
      return undefined;
    }, []);

    const sourceOptions = [
      {
        icon: <FaSdCard className="text-3xl mx-auto mb-2" />,
        label: "Rample SD Card",
        value: "sdcard",
      },
      {
        icon: <FaArchive className="text-3xl mx-auto mb-2" />,
        label: "Squarp.net Factory Samples",
        value: "squarp",
      },
      {
        icon: <FaFolderOpen className="text-3xl mx-auto mb-2" />,
        label: "Blank Folder",
        value: "blank",
      },
    ];

    const currentStep = useMemo((): WizardStep => {
      if (!state.source) {
        return WizardStep.Source;
      }
      if (state.source === "sdcard" && !state.sourceConfirmed) {
        return WizardStep.Source;
      }
      if (!state.targetPath || state.targetPath === "") {
        return WizardStep.Target;
      }
      return WizardStep.Initialize;
    }, [state.source, state.sourceConfirmed, state.targetPath]);
    const stepLabels = useMemo(() => ["Source", "Target", "Initialize"], []);

    const handleInitialize = useCallback(async () => {
      const result = await initialize();
      if (result.success && onSuccess) {
        onSuccess();
      }
    }, [initialize, onSuccess]);

    // Helper function to validate electronAPI availability
    const validateElectronAPI = useCallback(() => {
      if (!window.electronAPI?.selectExistingLocalStore) {
        const errorMsg = !window.electronAPI
          ? "electronAPI not available (app may need restart)"
          : "selectExistingLocalStore method not found (preload issue)";

        console.error("Debug info:", {
          availableMethods: window.electronAPI
            ? Object.keys(window.electronAPI)
            : "none",
          electronAPI: !!window.electronAPI,
          selectExistingLocalStore:
            !!window.electronAPI?.selectExistingLocalStore,
        });

        return { error: errorMsg, isValid: false };
      }
      return { error: null, isValid: true };
    }, []);

    // Helper function to handle successful store selection
    const handleStoreSelectionSuccess = useCallback(
      (path: string) => {
        setLocalStorePath(path);
        if (onSuccess) {
          onSuccess();
        }
      },
      [setLocalStorePath, onSuccess]
    );

    const handleChooseExistingStore = useCallback(async () => {
      isDev && console.debug("electronAPI available:", !!window.electronAPI);
      isDev &&
        console.debug(
          "selectExistingLocalStore method available:",
          !!window.electronAPI?.selectExistingLocalStore
        );

      const validation = validateElectronAPI();
      if (!validation.isValid) {
        setExistingStoreError(validation.error);
        return;
      }

      setIsSelectingExisting(true);
      setExistingStoreError(null);

      try {
        isDev && console.debug("Calling selectExistingLocalStore...");
        const result = await window.electronAPI.selectExistingLocalStore?.();
        isDev && console.debug("selectExistingLocalStore result:", result);

        if (result?.success && result.path) {
          handleStoreSelectionSuccess(result.path);
        } else if (result?.error && result.error !== "Selection cancelled") {
          setExistingStoreError(result.error);
        }
      } catch (error) {
        console.error("Error selecting existing local store:", error);
        setExistingStoreError("Failed to select existing local store");
      } finally {
        setIsSelectingExisting(false);
      }
    }, [isDev, validateElectronAPI, handleStoreSelectionSuccess]);

    return (
      <div
        className="p-0 bg-white dark:bg-slate-900"
        data-testid="local-store-wizard"
      >
        {!showExistingStoreSelector && (
          <>
            <WizardStepNav currentStep={currentStep} stepLabels={stepLabels} />
            {currentStep === WizardStep.Source && (
              <WizardSourceStep
                handleSourceSelect={handleSourceSelect}
                setSdCardPath={setSdCardPath}
                setSourceConfirmed={setSourceConfirmed}
                sourceConfirmed={state.sourceConfirmed}
                sourceOptions={sourceOptions}
                stateSource={state.source}
              />
            )}
          </>
        )}

        {showExistingStoreSelector && (
          <div className="mb-4">
            <label
              className="block font-semibold mb-1"
              htmlFor="existing-store-selector"
            >
              Choose Existing Local Store
            </label>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
              Select a folder that contains an existing Romper database
              (.romperdb directory).
            </p>

            {existingStoreError && (
              <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
                {existingStoreError}
              </div>
            )}

            <div className="flex gap-2">
              <FilePickerButton
                className="bg-blue-600 text-white px-4 py-2 rounded"
                data-testid="browse-existing-store-btn"
                icon={<FaSearch size={14} />}
                isSelecting={isSelectingExisting}
                onClick={handleChooseExistingStore}
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
              currentStep === WizardStep.Initialize) &&
              (() => {
                let sourceName: string;
                if (state.source === "sdcard") {
                  sourceName = "Rample SD Card";
                } else if (state.source === "squarp") {
                  sourceName = "Squarp.net Factory Samples";
                } else {
                  sourceName = "Blank Folder";
                }

                let sourceUrl: string;
                if (state.source === "sdcard") {
                  sourceUrl = state.sdCardSourcePath || "";
                } else if (state.source === "squarp") {
                  sourceUrl = config.squarpArchiveUrl || "";
                } else {
                  sourceUrl = "";
                }

                return (
                  <WizardSummaryStep
                    sourceName={sourceName}
                    sourceUrl={sourceUrl}
                    targetUrl={
                      currentStep === WizardStep.Initialize
                        ? state.targetPath
                        : undefined
                    }
                  />
                );
              })()}
            {currentStep === WizardStep.Target && (
              <WizardTargetStep
                defaultPath={defaultPath}
                safeSelectLocalStorePath={safeSelectLocalStorePath}
                setTargetPath={setTargetPath}
                stateTargetPath={state.targetPath}
              />
            )}
            <WizardErrorMessage errorMessage={errorMessage} />
            <WizardProgressBar progress={progress} />
            <div className="flex justify-between items-end mt-4">
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="wizard-initialize-btn"
                  disabled={!canInitialize || state.isInitializing}
                  onClick={handleInitialize}
                >
                  {state.isInitializing ? (
                    <>
                      <Spinner className="mr-2" size={18} /> Initializing...
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
                data-testid="choose-existing-store-btn"
                onClick={() => setShowExistingStoreSelector(true)}
              >
                <FaSearch size={14} /> Choose Existing Store
              </button>
            </div>
          </>
        )}
        <button
          aria-hidden="true"
          className="hidden"
          data-testid="wizard-next-step"
          onClick={() => {}}
          tabIndex={-1}
        />
      </div>
    );
  }
);

export default LocalStoreWizardUI;
