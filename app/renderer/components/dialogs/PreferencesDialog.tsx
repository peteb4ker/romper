import React, { useEffect, useState } from "react";
import { FiSettings, FiX } from "react-icons/fi";

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
    defaultToMonoSamples,
    localStorePath,
    localStoreStatus,
    setConfirmDestructiveActions,
    setDefaultToMonoSamples,
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FiSettings className="text-lg" />
            <h2
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              id="preferences-title"
            >
              Preferences
            </h2>
          </div>
          <button
            aria-label="Close preferences"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
            onClick={onClose}
          >
            <FiX />
          </button>
        </div>

        <div className="flex h-96">
          {/* Tabs Sidebar */}
          <div className="w-48 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-gray-700">
            <nav className="p-2">
              <button
                className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                  activeTab === "samples"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => setActiveTab("samples")}
              >
                Sample Management
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                  activeTab === "appearance"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => setActiveTab("appearance")}
              >
                Appearance
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  activeTab === "advanced"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
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
                defaultToMonoSamples={defaultToMonoSamples}
                onConfirmDestructiveActionsChange={setConfirmDestructiveActions}
                onDefaultToMonoSamplesChange={setDefaultToMonoSamples}
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
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
