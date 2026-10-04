import {
  ArchiveIcon,
  FolderOpenIcon,
  HardDriveIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import type {
  StereoImportNotice,
  TruncationWarning,
} from "./hooks/wizard/useLocalStoreWizardState";

import { config } from "../config";
import { useChooseExistingLocalStore } from "./hooks/shared/useChooseExistingLocalStore";
import { useLocalStoreWizard } from "./hooks/wizard/useLocalStoreWizard";
import FilePickerButton from "./utils/FilePickerButton";
import Spinner from "./utils/Spinner";
import WizardErrorMessage from "./wizard/WizardErrorMessage";
import WizardPostInitGuidance from "./wizard/WizardPostInitGuidance";
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
  /** Saves the store path; resolves false if it couldn't */
  setLocalStorePath: (path: string) => Promise<boolean>;
}

const LocalStoreWizardUI: React.FC<LocalStoreWizardUIProps> = React.memo(
  ({ onClose, onInitializationChange, onSuccess, setLocalStorePath }) => {
    // Only log on development or if there's an issue
    const isDev = process.env.NODE_ENV === "development";
    isDev &&
      console.debug(
        "[LocalStoreWizardUI] Rendered with setLocalStorePath:",
        !!setLocalStorePath,
      );

    const [showExistingStoreSelector, setShowExistingStoreSelector] =
      useState(false);
    // Choose Existing Store, shared with Preferences: a folder that isn't a
    // store, or a save that fails, keeps the wizard open and says why
    const {
      chooseExistingStore,
      clearError: clearExistingStoreError,
      error: existingStoreError,
      isChoosing: isSelectingExisting,
    } = useChooseExistingLocalStore(setLocalStorePath);
    const [showPostInitGuidance, setShowPostInitGuidance] = useState(false);
    const [truncationWarnings, setTruncationWarnings] = useState<
      TruncationWarning[]
    >([]);
    const [stereoNotices, setStereoNotices] = useState<StereoImportNotice[]>(
      [],
    );
    const [isCancelling, setIsCancelling] = useState(false);
    const {
      cancelSetup,
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

    // Cancel stops setup first; the wizard closes once the work has stopped
    // and been cleaned up (RE-66). On first run, closing quits the app.
    useEffect(() => {
      if (isCancelling && !state.isInitializing) {
        setIsCancelling(false);
        onClose();
      }
    }, [isCancelling, state.isInitializing, onClose]);

    const safeSelectLocalStorePath = useCallback(async () => {
      if (globalThis.electronAPI?.selectLocalStorePath) {
        return await globalThis.electronAPI.selectLocalStorePath();
      }
      return undefined;
    }, []);

    const sourceOptions = [
      {
        icon: <HardDriveIcon className="mx-auto mb-2" size={30} />,
        label: "Rample SD Card",
        value: "sdcard",
      },
      {
        icon: <ArchiveIcon className="mx-auto mb-2" size={30} />,
        label: "Squarp.net Factory Samples",
        value: "squarp",
      },
      {
        icon: <FolderOpenIcon className="mx-auto mb-2" size={30} />,
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
      if (result.success) {
        // From this run's result: `state` here is the render before it ran
        const warnings = result.truncationWarnings ?? [];
        const stereo = result.stereoNotices ?? [];
        setTruncationWarnings(warnings);
        setStereoNotices(stereo);
        const hasWarnings = warnings.length > 0 || stereo.length > 0;
        const isBlankFolder = state.source === "blank";

        if (isBlankFolder || hasWarnings) {
          setShowPostInitGuidance(true);
        } else if (onSuccess) {
          onSuccess();
        }
      }
    }, [initialize, onSuccess, state.source]);

    const handleChooseExistingStore = useCallback(async () => {
      if ((await chooseExistingStore()) && onSuccess) onSuccess();
    }, [chooseExistingStore, onSuccess]);

    return (
      <div className="p-0 bg-surface-1" data-testid="local-store-wizard">
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
            <p className="text-text-tertiary text-sm mb-3">
              Select a folder that contains an existing Romper database
              (.romperdb directory).
            </p>

            {existingStoreError && (
              <div className="bg-accent-danger/15 border border-accent-danger text-accent-danger px-4 py-3 rounded mb-4">
                {existingStoreError}
              </div>
            )}

            <div className="flex gap-2">
              <FilePickerButton
                className="bg-accent-primary text-white px-4 py-2 rounded"
                data-testid="browse-existing-store-btn"
                icon={<MagnifyingGlassIcon size={14} />}
                isSelecting={isSelectingExisting}
                onClick={handleChooseExistingStore}
              >
                Browse for Existing Store
              </FilePickerButton>

              <button
                className="bg-surface-4 text-text-primary px-4 py-2 rounded"
                onClick={() => {
                  setShowExistingStoreSelector(false);
                  clearExistingStoreError();
                }}
              >
                ← Back to Setup Wizard
              </button>
            </div>
          </div>
        )}

        {showPostInitGuidance && (
          <WizardPostInitGuidance
            isBlankFolder={state.source === "blank"}
            onDismiss={() => {
              setShowPostInitGuidance(false);
              if (onSuccess) onSuccess();
            }}
            stereoNotices={stereoNotices}
            truncationWarnings={truncationWarnings}
          />
        )}

        {!showExistingStoreSelector && !showPostInitGuidance && (
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
                  className="bg-accent-primary text-white px-4 py-2 rounded disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="bg-surface-4 text-text-primary px-4 py-2 rounded disabled:opacity-50"
                  data-testid="wizard-cancel-btn"
                  disabled={isCancelling}
                  onClick={() => {
                    if (!state.isInitializing) {
                      onClose();
                      return;
                    }
                    const confirmed = globalThis.confirm(
                      "Setup is still running. Cancel will stop setup and remove what it has written so far. Stop setup now?",
                    );
                    if (!confirmed) return;
                    setIsCancelling(true);
                    void cancelSetup();
                  }}
                  type="button"
                >
                  {isCancelling ? "Stopping…" : "Cancel"}
                </button>
              </div>

              {/* Choose Existing Local Store button - bottom right */}
              <button
                className="bg-accent-success text-white px-4 py-2 rounded text-sm flex items-center gap-2 hover:bg-accent-success/80"
                data-testid="choose-existing-store-btn"
                onClick={() => setShowExistingStoreSelector(true)}
              >
                <MagnifyingGlassIcon size={14} /> Choose Existing Store
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
  },
);

export default LocalStoreWizardUI;
