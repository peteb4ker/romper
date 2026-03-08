import { GearSix, X } from "@phosphor-icons/react";
import React, { useEffect, useState } from "react";

import { useSettings } from "../../utils/SettingsContext";
import AdvancedTab from "../preferences/AdvancedTab";
import AppearanceTab from "../preferences/AppearanceTab";
import SampleManagementTab from "../preferences/SampleManagementTab";

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
    setConfirmDestructiveActions,
    setLocalStorePath,
    setThemeMode,
    themeMode,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<
    "advanced" | "appearance" | "samples"
  >("samples");

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleChangeLocalStore = async () => {
    try {
      const result = await window.electronAPI.selectExistingLocalStore?.();
      if (result?.success && result.path) {
        await setLocalStorePath(result.path);
      }
    } catch (error) {
      console.error("Failed to change local store:", error);
    }
  };

  return (
    <div
      aria-labelledby="preferences-title"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div className="bg-surface-2 rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-border-subtle w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <GearSix size={18} />
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
            <X size={18} />
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
                onConfirmDestructiveActionsChange={setConfirmDestructiveActions}
              />
            )}

            {activeTab === "appearance" && (
              <AppearanceTab
                onThemeModeChange={setThemeMode}
                themeMode={themeMode}
              />
            )}

            {activeTab === "advanced" && (
              <AdvancedTab
                localStorePath={localStorePath}
                localStoreStatus={localStoreStatus}
                onChangeLocalStore={handleChangeLocalStore}
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
      </div>
    </div>
  );
};

export default PreferencesDialog;
