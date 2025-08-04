import React, { useEffect, useState } from "react";
import {
  FiFolder,
  FiMonitor,
  FiMoon,
  FiSettings,
  FiSun,
  FiX,
} from "react-icons/fi";

import { type ThemeMode, useSettings } from "../../utils/SettingsContext";

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

  const themeOptions: Array<{
    icon: React.ReactNode;
    label: string;
    value: ThemeMode;
  }> = [
    { icon: <FiSun className="w-4 h-4" />, label: "Light", value: "light" },
    {
      icon: <FiMonitor className="w-4 h-4" />,
      label: "System",
      value: "system",
    },
    { icon: <FiMoon className="w-4 h-4" />, label: "Dark", value: "dark" },
  ];

  return (
    <div
      aria-labelledby="preferences-title"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          handleBackdropClick(e as any);
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
            {/* Sample Management Tab */}
            {activeTab === "samples" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Sample Assignment
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label
                          className="text-sm font-medium text-gray-900 dark:text-gray-100"
                          htmlFor="default-mono-checkbox"
                        >
                          Default to mono samples
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Automatically assign stereo samples as mono to a
                          single voice.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          When enabled, stereo samples will take 1 mono slot and
                          will be converted to mono by averaging the left and
                          right channel.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          When disabled, stereo samples will be assigned to
                          adjacent voices, taking the same sample slot on both
                          voices.
                        </p>
                      </div>
                      <div className="flex items-center ml-4">
                        <input
                          checked={defaultToMonoSamples}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700"
                          id="default-mono-checkbox"
                          onChange={(e) =>
                            setDefaultToMonoSamples(e.target.checked)
                          }
                          type="checkbox"
                        />
                      </div>
                    </div>

                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label
                          className="text-sm font-medium text-gray-900 dark:text-gray-100"
                          htmlFor="confirm-destructive-checkbox"
                        >
                          Confirm destructive actions
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Show confirmation prompts before replacing or deleting
                          samples
                        </p>
                      </div>
                      <div className="flex items-center ml-4">
                        <input
                          checked={confirmDestructiveActions}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700"
                          id="confirm-destructive-checkbox"
                          onChange={(e) =>
                            setConfirmDestructiveActions(e.target.checked)
                          }
                          type="checkbox"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                        Appearance
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        {themeOptions.map((option) => {
                          const isSelected = themeMode === option.value;

                          return (
                            <div
                              className="flex flex-col items-center gap-2"
                              key={option.value}
                            >
                              <button
                                className={`relative w-16 h-16 rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                                  isSelected
                                    ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                                }`}
                                onClick={() => setThemeMode(option.value)}
                              >
                                {option.value === "light" && (
                                  <div className="w-full h-full bg-white flex items-center justify-center">
                                    <FiSun className="w-6 h-6 text-yellow-500" />
                                  </div>
                                )}

                                {option.value === "dark" && (
                                  <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                    <FiMoon className="w-6 h-6 text-blue-400" />
                                  </div>
                                )}

                                {option.value === "system" && (
                                  <>
                                    {/* Split background - light left, dark right */}
                                    <div className="absolute inset-0 flex">
                                      <div className="w-1/2 bg-white"></div>
                                      <div className="w-1/2 bg-gray-900"></div>
                                    </div>
                                    {/* Split monitor icon using two overlapping icons with clipping */}
                                    <div className="relative w-full h-full flex items-center justify-center">
                                      <div className="relative w-6 h-6">
                                        {/* Left half - dark icon on light background */}
                                        <div className="absolute inset-0 w-1/2 overflow-hidden">
                                          <FiMonitor className="w-6 h-6 text-gray-800" />
                                        </div>
                                        {/* Right half - light icon on dark background */}
                                        <div className="absolute inset-0 w-1/2 left-1/2 overflow-hidden">
                                          <FiMonitor className="w-6 h-6 text-gray-100 -ml-3" />
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </button>

                              <span
                                className={`text-sm font-medium ${
                                  isSelected
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {option.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Choose how Romper looks. System matches your operating
                        system's appearance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === "advanced" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Local Store
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
                        htmlFor="local-store-path"
                      >
                        Local Store Path
                      </label>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm text-gray-700 dark:text-gray-300"
                          id="local-store-path"
                        >
                          {localStorePath || "No local store configured"}
                        </div>
                        <button
                          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                          onClick={handleChangeLocalStore}
                        >
                          <FiFolder className="text-sm" />
                          Change...
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Location of your sample database and kit storage
                      </p>
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
                        htmlFor="local-store-status"
                      >
                        Status
                      </label>
                      <div
                        className="p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-300 dark:border-gray-600 text-sm"
                        id="local-store-status"
                      >
                        {localStoreStatus?.isValid ? (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ Valid local store
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">
                            ✗ {localStoreStatus?.error || "Invalid local store"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
