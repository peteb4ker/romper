import { GearSixIcon, XIcon } from "@phosphor-icons/react";
import React, { useEffect, useState } from "react";

import { useSettings } from "../../utils/SettingsContext";
import { useChooseExistingLocalStore } from "../hooks/shared/useChooseExistingLocalStore";
import { usePreferenceSaves } from "../hooks/shared/usePreferenceSaves";
import AdvancedTab from "../preferences/AdvancedTab";
import AppearanceTab from "../preferences/AppearanceTab";
import SampleManagementTab from "../preferences/SampleManagementTab";
import ModalDialog from "../shared/ModalDialog";

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesDialog: React.FC<PreferencesDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    confirmDestructiveActions,
    localStorePath,
    localStoreStatus,
    setLocalStorePath,
    themeMode,
  } = useSettings();
  // A setting that wasn't saved is reported (#570)
  const { saveConfirmDestructiveActions, saveThemeMode } = usePreferenceSaves();

  const [activeTab, setActiveTab] = useState<
    "advanced" | "appearance" | "samples"
  >("samples");

  // A folder that isn't a store, or a save that fails, is reported on the
  // Advanced tab (RE-78)
  const {
    chooseExistingStore,
    clearError: clearChangeError,
    error: changeError,
    isChoosing,
  } = useChooseExistingLocalStore(setLocalStorePath);

  useEffect(() => {
    if (!isOpen) clearChangeError();
  }, [isOpen, clearChangeError]);

  if (!isOpen) return null;

  return (
    <ModalDialog
      aria-labelledby="preferences-title"
      className="bg-surface-2 rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-border-subtle w-full max-w-2xl max-h-[80vh] overflow-hidden"
      closeOnBackdropClick
      data-testid="preferences-dialog"
      onClose={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <GearSixIcon size={18} />
          <h2
            className="text-lg font-semibold text-text-primary"
            id="preferences-title"
          >
            Preferences
          </h2>
        </div>
        <button
          aria-label="Close preferences"
          className="p-1 rounded hover:bg-surface-3 text-text-tertiary"
          onClick={onClose}
        >
          <XIcon size={18} />
        </button>
      </div>

      <div className="flex h-96">
        {/* Tabs Sidebar */}
        <div className="w-48 bg-surface-1 border-r border-border-subtle">
          <nav className="p-2">
            <button
              className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                activeTab === "samples"
                  ? "bg-accent-primary/15 text-accent-primary"
                  : "text-text-secondary hover:bg-surface-3"
              }`}
              onClick={() => setActiveTab("samples")}
            >
              Sample Management
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                activeTab === "appearance"
                  ? "bg-accent-primary/15 text-accent-primary"
                  : "text-text-secondary hover:bg-surface-3"
              }`}
              onClick={() => setActiveTab("appearance")}
            >
              Appearance
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                activeTab === "advanced"
                  ? "bg-accent-primary/15 text-accent-primary"
                  : "text-text-secondary hover:bg-surface-3"
              }`}
              onClick={() => setActiveTab("advanced")}
            >
              Advanced
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "samples" && (
            <SampleManagementTab
              confirmDestructiveActions={confirmDestructiveActions}
              onConfirmDestructiveActionsChange={(checked) =>
                void saveConfirmDestructiveActions(checked)
              }
            />
          )}

          {activeTab === "appearance" && (
            <AppearanceTab
              onThemeModeChange={(mode) => void saveThemeMode(mode)}
              themeMode={themeMode}
            />
          )}

          {activeTab === "advanced" && (
            <AdvancedTab
              changeError={changeError}
              isChanging={isChoosing}
              localStorePath={localStorePath}
              localStoreStatus={localStoreStatus}
              onChangeLocalStore={() => void chooseExistingStore()}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end p-4 border-t border-border-subtle">
        <button
          className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </ModalDialog>
  );
};

export default PreferencesDialog;
